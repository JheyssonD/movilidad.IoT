using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using SimonMovilidad.IoT.API.Hubs;
using SimonMovilidad.IoT.Core.Models;
using SimonMovilidad.IoT.Core.Services;
using SimonMovilidad.IoT.Infrastructure.Persistence;

namespace SimonMovilidad.IoT.API.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class TelemetryController : ControllerBase
    {
        private readonly ApplicationDbContext _context;
        private readonly IPredictionService _predictionService;
        private readonly IHubContext<TelemetryHub> _hubContext;

        public TelemetryController(
            ApplicationDbContext context,
            IPredictionService predictionService,
            IHubContext<TelemetryHub> hubContext)
        {
            _context = context;
            _predictionService = predictionService;
            _hubContext = hubContext;
        }

        [HttpPost("ingest")]
        public async Task<IActionResult> IngestTelemetry([FromBody] Telemetry telemetry)
        {
            telemetry.Timestamp = DateTime.UtcNow;
            _context.Telemetries.Add(telemetry);
            await _context.SaveChangesAsync();

            await _hubContext.Clients.All.SendAsync("ReceiveTelemetry", telemetry);

            var autonomy = _predictionService.CalculateAutonomyHours(telemetry);
            if (_predictionService.IsAlertTriggered(telemetry))
            {
                await _hubContext.Clients.Group("Admin").SendAsync("ReceiveAlert", new
                {
                    vehicleId = telemetry.VehicleId,
                    message = $"Alerta combustible crítico ({autonomy:F2} h autonomía) — {telemetry.VehicleId}.",
                    autonomy
                });
            }

            return Ok(new { success = true, telemetryId = telemetry.Id });
        }

        [HttpGet("fleet")]
        public async Task<IActionResult> GetFleet()
        {
            var role = HttpContext.Items["UserRole"] as string ?? "User";
            var vehicleIds = await _context.Telemetries.Select(t => t.VehicleId).Distinct().ToListAsync();
            var latest = new List<Telemetry>();
            foreach (var vid in vehicleIds)
            {
                var top = await _context.Telemetries
                    .Where(t => t.VehicleId == vid)
                    .OrderByDescending(t => t.Timestamp)
                    .FirstOrDefaultAsync();
                if (top != null) latest.Add(top);
            }

            var fleet = latest.Select(t => new
            {
                vehicleId = _predictionService.MaskVehicleId(t.VehicleId, role),
                latitude = t.Latitude,
                longitude = t.Longitude,
                fuelLevel = t.FuelLevel,
                speed = t.Speed
            });

            return Ok(fleet);
        }

        [HttpGet("history")]
        public async Task<IActionResult> GetHistory()
        {
            var role = HttpContext.Items["UserRole"] as string ?? "User";
            var vehicleIds = await _context.Telemetries.Select(t => t.VehicleId).Distinct().ToListAsync();
            var data = new List<Telemetry>();
            foreach (var vid in vehicleIds)
            {
                var top = await _context.Telemetries
                    .Where(t => t.VehicleId == vid)
                    .OrderByDescending(t => t.Timestamp)
                    .FirstOrDefaultAsync();
                if (top != null) data.Add(top);
            }

            var response = data.OrderBy(t => t.VehicleId).Select(t => new Telemetry
            {
                Id = t.Id,
                VehicleId = _predictionService.MaskVehicleId(t.VehicleId, role),
                Latitude = t.Latitude,
                Longitude = t.Longitude,
                Speed = t.Speed,
                FuelLevel = t.FuelLevel,
                AverageConsumptionPerHour = t.AverageConsumptionPerHour,
                Temperature = t.Temperature,
                Timestamp = t.Timestamp
            });

            return Ok(response);
        }
    }
}
