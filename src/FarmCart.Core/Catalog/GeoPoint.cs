namespace FarmCart.Core;

/// <summary>Географічна точка; відстань між точками - за формулою гаверсинуса.</summary>
public readonly record struct GeoPoint(double Lat, double Lon)
{
    private const double EarthRadiusKm = 6371.0;

    public bool IsValid => Lat is >= -90 and <= 90 && Lon is >= -180 and <= 180;

    public double DistanceKmTo(GeoPoint other)
    {
        var dLat = ToRadians(other.Lat - Lat);
        var dLon = ToRadians(other.Lon - Lon);
        var h = Math.Pow(Math.Sin(dLat / 2), 2)
            + (Math.Cos(ToRadians(Lat)) * Math.Cos(ToRadians(other.Lat)) * Math.Pow(Math.Sin(dLon / 2), 2));
        return 2 * EarthRadiusKm * Math.Asin(Math.Sqrt(h));
    }

    private static double ToRadians(double degrees) => degrees * Math.PI / 180;
}
