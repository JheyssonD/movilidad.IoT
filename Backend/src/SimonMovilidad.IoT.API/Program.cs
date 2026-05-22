using Microsoft.EntityFrameworkCore;
using SimonMovilidad.IoT.API.Hubs;
using SimonMovilidad.IoT.API.Middleware;
using SimonMovilidad.IoT.API.Services;
using SimonMovilidad.IoT.Core.Services;
using SimonMovilidad.IoT.Infrastructure.Persistence;
using SimonMovilidad.IoT.Infrastructure.Services;

var builder = WebApplication.CreateBuilder(args);

var dbPath = Environment.GetEnvironmentVariable("DB_PATH") ?? "data/fleet.db";
Directory.CreateDirectory(Path.GetDirectoryName(Path.GetFullPath(dbPath))!);
builder.Services.AddDbContext<ApplicationDbContext>(options =>
    options.UseSqlite($"Data Source={dbPath}"));

builder.Services.AddScoped<IPredictionService, PredictionService>();
builder.Services.AddSingleton<IHttpContextAccessor, HttpContextAccessor>();

var simulatorEnabled = !string.Equals(
    Environment.GetEnvironmentVariable("ENABLE_SIMULATOR"),
    "false",
    StringComparison.OrdinalIgnoreCase);

var apiBaseUrl = Environment.GetEnvironmentVariable("API_BASE_URL") ?? "http://localhost:5100";

if (simulatorEnabled)
{
    builder.Services.AddHttpClient("IngestClient", client =>
    {
        client.BaseAddress = new Uri(apiBaseUrl);
    });
    builder.Services.AddHostedService<TelemetrySimulator>();
}

builder.Services.AddControllers()
    .AddJsonOptions(options =>
    {
        options.JsonSerializerOptions.PropertyNamingPolicy = System.Text.Json.JsonNamingPolicy.CamelCase;
    });
builder.Services.AddSignalR()
    .AddJsonProtocol(options =>
    {
        options.PayloadSerializerOptions.PropertyNamingPolicy = System.Text.Json.JsonNamingPolicy.CamelCase;
    });
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

var corsOrigins = (builder.Configuration["CORS_ORIGINS"]
    ?? "http://localhost:4220,http://localhost:4200,http://localhost:8082")
    .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);

builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowAngular", policy =>
    {
        policy.WithOrigins(corsOrigins)
              .AllowAnyHeader()
              .AllowAnyMethod()
              .AllowCredentials();
    });
});

var app = builder.Build();

using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
    db.Database.EnsureCreated();
}

app.UseSwagger();
app.UseSwaggerUI();

app.UseCors("AllowAngular");
app.UseMiddleware<JwtMiddleware>();
app.MapControllers();
app.MapHub<TelemetryHub>("/telemetryHub");

app.MapGet("/health", () => Results.Ok(new { status = "Healthy", time = DateTime.UtcNow }));

app.Run();
