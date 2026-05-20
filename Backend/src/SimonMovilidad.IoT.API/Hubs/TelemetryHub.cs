using Microsoft.AspNetCore.SignalR;
using SimonMovilidad.IoT.Core.Models;
using System.Threading.Tasks;

namespace SimonMovilidad.IoT.API.Hubs
{
    public class TelemetryHub : Hub
    {
        public async Task SendTelemetryUpdate(Telemetry telemetry)
        {
            await Clients.All.SendAsync("ReceiveTelemetry", telemetry);
        }

        public async Task BroadcastAlert(string vehicleId, string message)
        {
            await Clients.Group("Admin").SendAsync("ReceiveAlert", new { VehicleId = vehicleId, Message = message });
        }

        public override async Task OnConnectedAsync()
        {
            // Join groups based on roles or claims if authenticated
            var role = Context.User?.FindFirst(System.Security.Claims.ClaimTypes.Role)?.Value;
            if (role == "Admin")
            {
                await Groups.AddToGroupAsync(Context.ConnectionId, "Admin");
            }
            await base.OnConnectedAsync();
        }
    }
}
