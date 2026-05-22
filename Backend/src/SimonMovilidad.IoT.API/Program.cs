using Microsoft.EntityFrameworkCore;
using SimonMovilidad.IoT.API.Hubs;
using SimonMovilidad.IoT.API.Middleware;
using SimonMovilidad.IoT.API.Services;
using SimonMovilidad.IoT.Core.Services;
using SimonMovilidad.IoT.Infrastructure.Persistence;
using SimonMovilidad.IoT.Infrastructure.Services;

var builder = WebApplication.CreateBuilder(args);

// Explicitly bind to port 5100 to avoid default occupied ports and ensure local matching config
builder.WebHost.UseUrls("http://localhost:5100");

// Add Database
var dbPath = Environment.GetEnvironmentVariable("DB_PATH") ?? "fleet.db";
builder.Services.AddDbContext<ApplicationDbContext>(options =>
    options.UseSqlite($"Data Source={dbPath}"));

// Add Services
builder.Services.AddScoped<IPredictionService, PredictionService>();
builder.Services.AddSingleton<IHttpContextAccessor, HttpContextAccessor>();

// Register Simulator
builder.Services.AddHostedService<TelemetrySimulator>();

builder.Services.AddControllers();
builder.Services.AddSignalR();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

// CORS Settings
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowAngular", policy =>
    {
        policy.WithOrigins("http://localhost:4220", "http://localhost:4200")
              .AllowAnyHeader()
              .AllowAnyMethod()
              .AllowCredentials();
    });
});

var app = builder.Build();

// Run migrations and seed data automatically
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
    db.Database.EnsureCreated();
}

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseCors("AllowAngular");

// Register custom manual JWT parsing middleware
app.UseMiddleware<JwtMiddleware>();

app.MapControllers();
app.MapHub<TelemetryHub>("/telemetryHub");

// Health check endpoint
app.MapGet("/health", () => Results.Ok(new { status = "Healthy", time = DateTime.UtcNow }));

app.Run();
