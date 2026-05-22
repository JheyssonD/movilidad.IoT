using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using SimonMovilidad.IoT.Infrastructure.Simulation;
using System.Net.Http.Json;

namespace SimonMovilidad.IoT.API.Services
{
    public sealed class TelemetrySimulator : BackgroundService
    {
        private readonly ILogger<TelemetrySimulator> _logger;
        private readonly IHttpClientFactory _httpClientFactory;
        private readonly Random _random = new();
        private readonly Dictionary<string, VehicleRouteState> _vehicleStates = new();

        private const int TelemetryIntervalSeconds = 10;

        public TelemetrySimulator(
            ILogger<TelemetrySimulator> logger,
            IHttpClientFactory httpClientFactory)
        {
            _logger = logger;
            _httpClientFactory = httpClientFactory;
            InitializeFleet();
        }

        private void InitializeFleet()
        {
            foreach (var def in FleetSimulationRoutes.All)
            {
                try
                {
                    var densePath = RouteLoader.Load(def.GeoJsonFile);
                    var state = new VehicleRouteState(def, densePath, _random);
                    _vehicleStates[def.VehicleId] = state;
                    _logger.LogInformation(
                        "Ruta {City} [{Route}] vehículo {Vehicle}: {Points} puntos, combustible {Fuel:F1} L (autonomía {Autonomy:F2} h)",
                        def.City, def.RouteName, def.VehicleId, densePath.Length,
                        state.CurrentFuelLevel, state.AutonomyHours);
                    if (state.IsCriticallyLow)
                    {
                        _logger.LogWarning(
                            "ALERTA DEMO activa al arranque — {Vehicle} ({City})",
                            def.VehicleId, def.City);
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogError(
                        ex,
                        "No se pudo cargar ruta {File} para {Vehicle} ({City})",
                        def.GeoJsonFile, def.VehicleId, def.City);
                }
            }

            if (_vehicleStates.Count == 0)
                throw new InvalidOperationException(
                    "No hay vehículos en el simulador. Verifique Data/OsmRoutes/GeoJson y reinicie la API.");
        }

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            _logger.LogInformation("Simulador IoT iniciado: {Count} vehículos.", _vehicleStates.Count);

            await Task.Delay(800, stoppingToken);
            await RunTelemetryCycleAsync(advanceAlongPath: false, stoppingToken);

            while (!stoppingToken.IsCancellationRequested)
            {
                try
                {
                    await RunTelemetryCycleAsync(advanceAlongPath: true, stoppingToken);
                }
                catch (Exception ex)
                {
                    _logger.LogWarning("Error en simulador: {Message}", ex.Message);
                }

                await Task.Delay(TimeSpan.FromSeconds(TelemetryIntervalSeconds), stoppingToken);
            }
        }

        private async Task RunTelemetryCycleAsync(bool advanceAlongPath, CancellationToken stoppingToken)
        {
            var client = _httpClientFactory.CreateClient("IngestClient");

            foreach (var state in _vehicleStates.Values)
            {
                double lat, lng, speedKmh, distanceKm, fuelLevel;

                if (advanceAlongPath)
                {
                    (lat, lng, speedKmh, distanceKm) = state.AdvanceAlongPath();
                    fuelLevel = state.UpdateFuel(distanceKm, speedKmh);
                    if (state.JustRefueled)
                    {
                        _logger.LogInformation(
                            "Recarga en {City} — {Vehicle}: tanque {Fuel:F1} L",
                            state.City, state.VehicleId, fuelLevel);
                    }
                }
                else
                {
                    var pos = state.CurrentPosition;
                    lat = pos.Lat;
                    lng = pos.Lng;
                    speedKmh = 0;
                    distanceKm = 0;
                    fuelLevel = state.CurrentFuelLevel;
                }

                var payload = new
                {
                    vehicleId = state.VehicleId,
                    latitude = lat,
                    longitude = lng,
                    speed = Math.Round(speedKmh, 1),
                    fuelLevel,
                    averageConsumptionPerHour = state.ConsumptionPerHour,
                    temperature = Math.Round(78 + _random.NextDouble() * 22, 1)
                };

                _logger.LogInformation(
                    "Sim [{City}] {Vehicle} ({Lat:F5},{Lng:F5}) {Speed:F1} km/h fuel {Fuel:F1}L dist {Dist:F0}m",
                    state.City, state.VehicleId, lat, lng, speedKmh, fuelLevel, distanceKm * 1000);

                var response = await client.PostAsJsonAsync("/api/telemetry/ingest", payload, stoppingToken);
                if (!response.IsSuccessStatusCode)
                {
                    _logger.LogWarning(
                        "Ingest rechazado para {Vehicle}: HTTP {Status}",
                        state.VehicleId, response.StatusCode);
                }
            }
        }

        private sealed class VehicleRouteState
        {
            private const double TankCapacityLiters = 72.0;
            private const double RefuelThresholdLiters = 0.5;

            private readonly FleetVehicleDefinition _def;
            private readonly (double Lat, double Lng)[] _path;
            private readonly Random _rng;
            private int _index;
            private int _direction = 1;
            private int _stopTicksRemaining;
            private double _fuelLevel;
            private (double Lat, double Lng) _lastPos;

            public string VehicleId => _def.VehicleId;
            public string City => _def.City;
            public string RouteName => _def.RouteName;
            public double ConsumptionPerHour => 6.5 * (0.85 + _def.SpeedFactor * 0.12);
            public bool JustRefueled { get; private set; }
            public (double Lat, double Lng) CurrentPosition => _path[_index];
            public double CurrentFuelLevel => _fuelLevel;
            public double AutonomyHours => _fuelLevel / Math.Max(ConsumptionPerHour, 0.1);
            public bool IsCriticallyLow => AutonomyHours < 1.0;

            public VehicleRouteState(
                FleetVehicleDefinition def,
                (double Lat, double Lng)[] densePath,
                Random rng)
            {
                _def = def;
                _path = densePath;
                _rng = rng;
                _fuelLevel = def.StartWithCriticalAutonomy
                    ? Math.Round(ConsumptionPerHour * 0.42, 2)
                    : Math.Clamp(def.InitialFuelLiters, 0, TankCapacityLiters);
                _index = 0;
                _lastPos = _path[0];
            }

            public (double Lat, double Lng, double SpeedKmh, double DistanceKm) AdvanceAlongPath()
            {
                JustRefueled = false;
                var current = _path[_index];

                if (_stopTicksRemaining > 0)
                {
                    _stopTicksRemaining--;
                    return (current.Lat, current.Lng, 0, 0);
                }

                if (_rng.NextDouble() < _def.StopProbabilityPerTick)
                {
                    _stopTicksRemaining = _rng.Next(1, 3);
                    return (current.Lat, current.Lng, 0, 0);
                }

                var nextIndex = _index + _direction;
                if (nextIndex >= _path.Length)
                {
                    _direction = -1;
                    nextIndex = _index + _direction;
                }
                else if (nextIndex < 0)
                {
                    _direction = 1;
                    nextIndex = _index + _direction;
                }

                var next = _path[nextIndex];
                var distanceKm = RoutePathProcessor.HaversineM(current, next) / 1000.0;
                var speedKmh = ComputeSpeedKmh(distanceKm);
                _lastPos = current;
                _index = nextIndex;

                return (next.Lat, next.Lng, speedKmh, distanceKm);
            }

            private double ComputeSpeedKmh(double distanceKm)
            {
                if (distanceKm < 0.0001) return 0;

                var intervalHours = TelemetryIntervalSeconds / 3600.0;
                var physicsSpeed = distanceKm / intervalHours;
                var scaled = physicsSpeed * _def.SpeedFactor * (0.92 + _rng.NextDouble() * 0.16);
                return Math.Clamp(scaled, _def.MinSpeedKmh, _def.MaxSpeedKmh);
            }

            public double UpdateFuel(double distanceKm, double speedKmh)
            {
                JustRefueled = false;
                double liters;

                if (speedKmh < 0.5)
                    liters = ConsumptionPerHour * (TelemetryIntervalSeconds / 3600.0) * 0.1;
                else
                {
                    var hours = distanceKm / Math.Max(speedKmh, 1);
                    liters = ConsumptionPerHour * hours;
                }

                _fuelLevel = Math.Max(0, _fuelLevel - liters);

                if (_fuelLevel <= RefuelThresholdLiters)
                {
                    if (_def.StartWithCriticalAutonomy)
                        _fuelLevel = Math.Round(ConsumptionPerHour * 0.38, 2);
                    else
                    {
                        _fuelLevel = TankCapacityLiters;
                        JustRefueled = true;
                    }
                }

                return Math.Round(_fuelLevel, 2);
            }
        }
    }
}
