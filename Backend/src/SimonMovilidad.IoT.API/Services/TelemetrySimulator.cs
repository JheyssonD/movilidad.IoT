using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using SimonMovilidad.IoT.Core.Models;
using System;
using System.Net.Http;
using System.Net.Http.Json;
using System.Threading;
using System.Threading.Tasks;

namespace SimonMovilidad.IoT.API.Services
{
    public class TelemetrySimulator : BackgroundService
    {
        private readonly ILogger<TelemetrySimulator> _logger;
        private readonly HttpClient _httpClient;
        private readonly string[] _vehicles = { "DEV-A549-XC54", "DEV-B811-LK89", "DEV-C304-RE21", "DEV-D492-ZP43" };
        private readonly Random _random = new Random();

        public TelemetrySimulator(ILogger<TelemetrySimulator> logger)
        {
            _logger = logger;
            _httpClient = new HttpClient { BaseAddress = new Uri("http://localhost:8080/") };
        }

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            _logger.LogInformation("IoT Telemetry Simulator Service is starting.");
            
            // Wait for Web Server to warm up
            await Task.Delay(5000, stoppingToken);

            while (!stoppingToken.IsCancellationRequested)
            {
                try
                {
                    foreach (var vehicle in _vehicles)
                    {
                        var telemetry = new Telemetry
                        {
                            VehicleId = vehicle,
                            Latitude = 4.7110 + (_random.NextDouble() - 0.5) * 0.05,
                            Longitude = -74.0721 + (_random.NextDouble() - 0.5) * 0.05,
                            Speed = _random.NextDouble() * 120,
                            FuelLevel = _random.NextDouble() * 80 + 5, // Liter
                            AverageConsumptionPerHour = 6.5, // L/h
                            Temperature = 80 + _random.NextDouble() * 25,
                            Timestamp = DateTime.UtcNow
                        };

                        _logger.LogInformation($"Simulator sending telemetry for {vehicle}...");
                        await _httpClient.PostAsJsonAsync("api/telemetry/ingest", telemetry, stoppingToken);
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogWarning($"Failed to send simulated telemetry: {ex.Message}");
                }

                await Task.Delay(10000, stoppingToken); // Update every 10 seconds
            }
        }
    }
}
