using System.Text.Json;

namespace SimonMovilidad.IoT.Infrastructure.Simulation
{
    public static class RouteLoader
    {
        public static (double Lat, double Lng)[] Load(string geoJsonFileName)
        {
            var path = ResolveGeoJsonPath(geoJsonFileName)
                ?? throw new FileNotFoundException(
                    $"No se encontró '{geoJsonFileName}'.",
                    geoJsonFileName);

            using var doc = JsonDocument.Parse(File.ReadAllText(path));
            var coordinates = doc.RootElement
                .GetProperty("features")[0]
                .GetProperty("geometry")
                .GetProperty("coordinates");

            var raw = new List<(double Lat, double Lng)>();
            foreach (var coord in coordinates.EnumerateArray())
                raw.Add((coord[1].GetDouble(), coord[0].GetDouble()));

            if (raw.Count < 2)
                throw new InvalidDataException($"Ruta '{geoJsonFileName}' inválida.");

            return RoutePathProcessor.BuildDrivePath(raw.ToArray());
        }

        public static string? ResolveGeoJsonPath(string geoJsonFileName)
        {
            var seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            var dir = AppContext.BaseDirectory;

            for (var depth = 0; depth < 8 && !string.IsNullOrEmpty(dir); depth++)
            {
                var candidate = Path.Combine(dir, "Data", "OsmRoutes", "GeoJson", geoJsonFileName);
                if (seen.Add(candidate) && File.Exists(candidate))
                    return candidate;

                var candidateWithSimulation = Path.Combine(dir, "Simulation", "Data", "OsmRoutes", "GeoJson", geoJsonFileName);
                if (seen.Add(candidateWithSimulation) && File.Exists(candidateWithSimulation))
                    return candidateWithSimulation;

                dir = Directory.GetParent(dir)?.FullName;
            }

            return null;
        }
    }
}
