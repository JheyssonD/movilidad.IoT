using SimonMovilidad.IoT.Core.Models;
using SimonMovilidad.IoT.Infrastructure.Services;
using Xunit;

namespace SimonMovilidad.IoT.Tests
{
    public class PredictionServiceTests
    {
        private readonly PredictionService _service;

        public PredictionServiceTests()
        {
            _service = new PredictionService();
        }

        [Fact]
        public void CalculateAutonomyHours_ShouldReturnCorrectValue()
        {
            var telemetry = new Telemetry { FuelLevel = 45.0, AverageConsumptionPerHour = 5.0 };
            double autonomy = _service.CalculateAutonomyHours(telemetry);
            Assert.Equal(9.0, autonomy);
        }

        [Fact]
        public void IsAlertTriggered_ShouldBeTrue_WhenAutonomyLessThanOneHour()
        {
            var telemetry = new Telemetry { FuelLevel = 3.5, AverageConsumptionPerHour = 5.0 }; // 0.7 hours autonomy
            bool alert = _service.IsAlertTriggered(telemetry);
            Assert.True(alert);
        }

        [Fact]
        public void IsAlertTriggered_ShouldBeFalse_WhenAutonomyMoreThanOneHour()
        {
            var telemetry = new Telemetry { FuelLevel = 10.0, AverageConsumptionPerHour = 5.0 }; // 2 hours autonomy
            bool alert = _service.IsAlertTriggered(telemetry);
            Assert.False(alert);
        }

        [Theory]
        [InlineData("DEV-A549-XC54", "Admin", "DEV-A549-XC54")]
        [InlineData("DEV-A549-XC54", "User", "DEV-****-XC54")]
        public void MaskVehicleId_ShouldMaskCorrectlyBasedOnRole(string vehicleId, string role, string expected)
        {
            string masked = _service.MaskVehicleId(vehicleId, role);
            Assert.Equal(expected, masked);
        }
    }
}
