using SimonMovilidad.IoT.Core.Models;
using SimonMovilidad.IoT.Core.Services;

namespace SimonMovilidad.IoT.Infrastructure.Services
{
    public class PredictionService : IPredictionService
    {
        public double CalculateAutonomyHours(Telemetry telemetry)
        {
            if (telemetry.AverageConsumptionPerHour <= 0) return 999.0;
            return telemetry.FuelLevel / telemetry.AverageConsumptionPerHour;
        }

        public bool IsAlertTriggered(Telemetry telemetry)
        {
            double autonomy = CalculateAutonomyHours(telemetry);
            return autonomy < 1.0;
        }

        public string MaskVehicleId(string vehicleId, string userRole)
        {
            if (string.IsNullOrEmpty(vehicleId)) return string.Empty;
            if (userRole.Equals("Admin", StringComparison.OrdinalIgnoreCase)) return vehicleId;

            // Mask format: DEV-****-XC54 (masks center segment)
            var parts = vehicleId.Split('-');
            if (parts.Length >= 3)
            {
                parts[1] = "****";
                return string.Join("-", parts);
            }
            return vehicleId.Length > 4 ? vehicleId.Substring(0, 4) + "****" : "****";
        }
    }
}
