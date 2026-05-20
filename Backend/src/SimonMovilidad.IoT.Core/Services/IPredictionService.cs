using SimonMovilidad.IoT.Core.Models;

namespace SimonMovilidad.IoT.Core.Services
{
    public interface IPredictionService
    {
        double CalculateAutonomyHours(Telemetry telemetry);
        bool IsAlertTriggered(Telemetry telemetry);
        string MaskVehicleId(string vehicleId, string userRole);
    }
}
