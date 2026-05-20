using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using SimonMovilidad.IoT.API.Hubs;
using SimonMovilidad.IoT.Core.Models;
using SimonMovilidad.IoT.Core.Services;
using SimonMovilidad.IoT.Infrastructure.Persistence;
using System;
using System.Linq;
using System.Threading.Tasks;

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

            // WebSockets live broadcast
            await _hubContext.Clients.All.SendAsync("ReceiveTelemetry", telemetry);

            // Prediction alerting logic
            if (_predictionService.IsAlertTriggered(telemetry))
            {
                await _hubContext.Clients.Group("Admin").SendAsync("ReceiveAlert", new 
                { 
                    VehicleId = telemetry.VehicleId, 
                    Message = $"Alerta Combustible Crítico! Autonomía menor a 1 hora para vehículo {telemetry.VehicleId}.",
                    Autonomy = _predictionService.CalculateAutonomyHours(telemetry)
                });
            }

            return Ok(new { success = true, telemetryId = telemetry.Id });
        }

        [HttpGet("history")]
        public IActionResult GetHistory()
        {
            var role = HttpContext.Items["UserRole"] as string ?? "User";
            var data = _context.Telemetries
                .OrderByDescending(t => t.Timestamp)
                .Take(50)
                .ToList();

            // Mask IDs for regular standard users
            var response = data.Select(t => new Telemetry
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
