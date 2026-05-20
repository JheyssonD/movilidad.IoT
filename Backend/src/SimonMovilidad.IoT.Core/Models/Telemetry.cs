using System;

namespace SimonMovilidad.IoT.Core.Models
{
    public class Telemetry
    {
        public int Id { get; set; }
        public string VehicleId { get; set; } = string.Empty;
        public double Latitude { get; set; }
        public double Longitude { get; set; }
        public double Speed { get; set; } // km/h
        public double FuelLevel { get; set; } // Litros
        public double AverageConsumptionPerHour { get; set; } // Litros/hora
        public double Temperature { get; set; } // °C
        public DateTime Timestamp { get; set; }
    }
}
