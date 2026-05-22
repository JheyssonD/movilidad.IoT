namespace SimonMovilidad.IoT.Infrastructure.Simulation
{
    public static class FleetSimulationRoutes
    {
        public static IReadOnlyList<FleetVehicleDefinition> All { get; } = new FleetVehicleDefinition[]
        {
            new("DEV-A549-XC54", "Bogotá", "calle72-deportiva-universidad.geojson",
                "Avenida Calle 72", 55, 1.05, 0.02, 52, 68),
            new("DEV-B811-LK89", "Bogotá", "carrera7-norte.geojson",
                "Avenida Carrera 7", 42, 0.85, 0.08, 28, 48),
            new("DEV-C304-RE21", "Bogotá", "carrera15-norte.geojson",
                "Carrera 15", 68, 1.15, 0.01, 45, 62),
            new("DEV-D492-ZP43", "Bogotá", "calle79-occidente.geojson",
                "Calle 79", 0, 0.75, 0.12, 22, 40, StartWithCriticalAutonomy: true),
            new("DEV-E201-MD01", "Medellín", "medellin-avenida-oriental.geojson",
                "Avenida Oriental", 60, 0.95, 0.05, 35, 55),
            new("DEV-F118-CA02", "Cali", "cali-carrera-1.geojson",
                "Carrera 1", 50, 1.20, 0.03, 40, 70),
            new("DEV-G302-BA03", "Barranquilla", "barranquilla-calle-45.geojson",
                "Calle 45", 45, 0.80, 0.10, 30, 50),
            new("DEV-H445-CT04", "Cartagena", "cartagena-avenida-santander.geojson",
                "Av. Santander", 52, 0.70, 0.06, 25, 45),
            new("DEV-I567-BU05", "Bucaramanga", "bucaramanga-calle-35.geojson",
                "Calle 35", 48, 1.00, 0.04, 32, 58),
            new("DEV-J789-PE06", "Pereira", "pereira-carrera-14.geojson",
                "Carrera 14", 44, 0.90, 0.07, 28, 52)
        };
    }

    public sealed record FleetVehicleDefinition(
        string VehicleId,
        string City,
        string GeoJsonFile,
        string RouteName,
        double InitialFuelLiters,
        double SpeedFactor,
        double StopProbabilityPerTick,
        double MinSpeedKmh,
        double MaxSpeedKmh,
        bool StartWithCriticalAutonomy = false);
}
