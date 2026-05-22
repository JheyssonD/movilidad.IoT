using Microsoft.AspNetCore.SignalR;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using SimonMovilidad.IoT.API.Hubs;
using SimonMovilidad.IoT.Core.Models;
using SimonMovilidad.IoT.Core.Services;
using SimonMovilidad.IoT.Infrastructure.Persistence;
using System;
using System.Threading;
using System.Threading.Tasks;

namespace SimonMovilidad.IoT.API.Services
{
    public class TelemetrySimulator : BackgroundService
    {
        private readonly ILogger<TelemetrySimulator> _logger;
        private readonly IServiceScopeFactory _scopeFactory;
        private readonly IHubContext<TelemetryHub> _hubContext;
        private readonly string[] _vehicles = { "DEV-A549-XC54", "DEV-B811-LK89", "DEV-C304-RE21", "DEV-D492-ZP43" };
        private readonly Random _random = new Random();

        public TelemetrySimulator(
            ILogger<TelemetrySimulator> logger,
            IServiceScopeFactory scopeFactory,
            IHubContext<TelemetryHub> hubContext)
        {
            _logger = logger;
            _scopeFactory = scopeFactory;
            _hubContext = hubContext;
        }

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            _logger.LogInformation("IoT Telemetry Simulator Service is starting in-process.");
            
            // Wait for Web Server to warm up and database migrations to complete
            await Task.Delay(5000, stoppingToken);

            while (!stoppingToken.IsCancellationRequested)
            {
                try
                {
                    using (var scope = _scopeFactory.CreateScope())
                    {
                        var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
                        var predictionService = scope.ServiceProvider.GetRequiredService<IPredictionService>();

                        foreach (var vehicle in _vehicles)
                        {
                            // 25% chance to simulate a critical fuel level (< 1h autonomy), otherwise normal
                            double fuelLevel = _random.NextDouble() < 0.25 
                                ? _random.NextDouble() * 5.0 + 1.0 // 1.0 - 6.0 Litres (Critical autonomy for 6.5 L/h consumption)
                                : _random.NextDouble() * 70.0 + 15.0; // 15.0 - 85.0 Litres (Normal)

                            var telemetry = new Telemetry
                            {
                                VehicleId = vehicle,
                                Latitude = 4.7110 + (_random.NextDouble() - 0.5) * 0.05,
                                Longitude = -74.0721 + (_random.NextDouble() - 0.5) * 0.05,
                                Speed = _random.NextDouble() * 120,
                                FuelLevel = fuelLevel,
                                AverageConsumptionPerHour = 6.5,
                                Temperature = 80 + _random.NextDouble() * 25,
                                Timestamp = DateTime.UtcNow
                            };

                            _logger.LogInformation($"Simulator processing in-process telemetry for {vehicle} (Fuel: {fuelLevel:F2}L)...");

                            context.Telemetries.Add(telemetry);
                            await context.SaveChangesAsync(stoppingToken);

                            // WebSockets live broadcast
                            await _hubContext.Clients.All.SendAsync("ReceiveTelemetry", telemetry, cancellationToken: stoppingToken);

                            // Prediction alerting logic
                            if (predictionService.IsAlertTriggered(telemetry))
                            {
                                var autonomy = predictionService.CalculateAutonomyHours(telemetry);
                                _logger.LogWarning($"ALERT TRIGGERED: Vehicle {vehicle} has critical fuel autonomy ({autonomy:F2} hours)!");

                                await _hubContext.Clients.Group("Admin").SendAsync("ReceiveAlert", new 
                                { 
                                    VehicleId = telemetry.VehicleId, 
                                    Message = $"Alerta Combustible Crítico! Autonomía menor a 1 hora ({autonomy:F2}h) para vehículo {telemetry.VehicleId}.",
                                    Autonomy = autonomy
                                }, cancellationToken: stoppingToken);
                            }
                        }
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogWarning($"Failed to process simulated telemetry: {ex.Message}");
                }

                await Task.Delay(10000, stoppingToken); // Update every 10 seconds
            }
        }
    }
}
