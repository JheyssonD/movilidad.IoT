using Microsoft.AspNetCore.SignalR;
using SimonMovilidad.IoT.Core.Models;
using System;
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
            var role = Context.User?.FindFirst(System.Security.Claims.ClaimTypes.Role)?.Value
                ?? Context.User?.FindFirst("role")?.Value;

            if (string.Equals(role, "Admin", StringComparison.OrdinalIgnoreCase))
            {
                await Groups.AddToGroupAsync(Context.ConnectionId, "Admin");
            }

            await base.OnConnectedAsync();
        }

        public override async Task OnDisconnectedAsync(Exception? exception)
        {
            await Groups.RemoveFromGroupAsync(Context.ConnectionId, "Admin");
            await base.OnDisconnectedAsync(exception);
        }
    }
}
