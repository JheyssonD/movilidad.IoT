namespace SimonMovilidad.IoT.Infrastructure.Simulation
{
    public static class RoutePathProcessor
    {
        private const double MaxStepMeters = 95;
        private const double MinStepMeters = 40;

        public static (double Lat, double Lng)[] BuildDrivePath((double Lat, double Lng)[] raw)
        {
            if (raw.Length < 2) return raw;

            var cleaned = RemoveDuplicates(raw, 8);
            cleaned = RemoveBacktracking(cleaned);
            cleaned = TrimClosingLoop(cleaned, 60);
            return Densify(cleaned, MaxStepMeters);
        }

        private static List<(double Lat, double Lng)> RemoveDuplicates(
            (double Lat, double Lng)[] path, double minMeters)
        {
            var result = new List<(double Lat, double Lng)> { path[0] };
            for (var i = 1; i < path.Length; i++)
            {
                if (HaversineM(result[^1], path[i]) >= minMeters)
                    result.Add(path[i]);
            }
            return result;
        }

        private static List<(double Lat, double Lng)> RemoveBacktracking(List<(double Lat, double Lng)> path)
        {
            if (path.Count < 3) return path;

            var result = new List<(double Lat, double Lng)> { path[0], path[1] };
            for (var i = 2; i < path.Count; i++)
            {
                var a = result[^2];
                var b = result[^1];
                var c = path[i];
                if (IsBackward(a, b, c))
                    continue;
                result.Add(c);
            }
            return result;
        }

        private static bool IsBackward(
            (double Lat, double Lng) a,
            (double Lat, double Lng) b,
            (double Lat, double Lng) c)
        {
            var abLat = b.Lat - a.Lat;
            var abLng = b.Lng - a.Lng;
            var bcLat = c.Lat - b.Lat;
            var bcLng = c.Lng - b.Lng;
            var dot = abLat * bcLat + abLng * bcLng;
            var magAb = Math.Sqrt(abLat * abLat + abLng * abLng);
            var magBc = Math.Sqrt(bcLat * bcLat + bcLng * bcLng);
            if (magAb < 1e-9 || magBc < 1e-9) return false;
            var cos = dot / (magAb * magBc);
            return cos < -0.25;
        }

        private static List<(double Lat, double Lng)> TrimClosingLoop(List<(double Lat, double Lng)> path, double minMeters)
        {
            if (path.Count < 4) return path;
            var start = path[0];
            for (var i = path.Count - 1; i >= 2; i--)
            {
                if (HaversineM(start, path[i]) < minMeters)
                    return path.Take(i + 1).ToList();
            }
            return path;
        }

        private static (double Lat, double Lng)[] Densify(List<(double Lat, double Lng)> path, double maxStepM)
        {
            if (path.Count < 2) return path.ToArray();

            var dense = new List<(double Lat, double Lng)> { path[0] };
            for (var i = 1; i < path.Count; i++)
            {
                var from = path[i - 1];
                var to = path[i];
                var segM = HaversineM(from, to);
                if (segM < MinStepMeters)
                {
                    if (HaversineM(dense[^1], to) >= 5) dense.Add(to);
                    continue;
                }

                var steps = Math.Max(1, (int)Math.Ceiling(segM / maxStepM));
                for (var s = 1; s <= steps; s++)
                {
                    var t = (double)s / steps;
                    var p = (
                        Lat: from.Lat + (to.Lat - from.Lat) * t,
                        Lng: from.Lng + (to.Lng - from.Lng) * t
                    );
                    if (HaversineM(dense[^1], p) >= 5) dense.Add(p);
                }
            }
            return dense.ToArray();
        }

        public static double HaversineM((double Lat, double Lng) a, (double Lat, double Lng) b)
        {
            const double R = 6371000;
            var dLat = (b.Lat - a.Lat) * Math.PI / 180;
            var dLon = (b.Lng - a.Lng) * Math.PI / 180;
            var x = Math.Sin(dLat / 2) * Math.Sin(dLat / 2) +
                    Math.Cos(a.Lat * Math.PI / 180) * Math.Cos(b.Lat * Math.PI / 180) *
                    Math.Sin(dLon / 2) * Math.Sin(dLon / 2);
            return R * 2 * Math.Atan2(Math.Sqrt(x), Math.Sqrt(1 - x));
        }
    }
}
