namespace FarmCart.Core.Tests.Catalog;

public sealed class GeoPointTests
{
    [Fact]
    public void Distance_ToSamePoint_IsZero() =>
        Assert.Equal(0, TestWorld.LvivCenter.DistanceKmTo(TestWorld.LvivCenter), precision: 6);

    [Fact]
    public void Distance_OneDegreeOfLatitude_IsAbout111Km() =>
        Assert.Equal(111.195, new GeoPoint(50, 24).DistanceKmTo(new GeoPoint(51, 24)), precision: 3);

    [Fact]
    public void Distance_IsSymmetric()
    {
        var kyiv = new GeoPoint(50.4501, 30.5234);

        Assert.Equal(TestWorld.LvivCenter.DistanceKmTo(kyiv), kyiv.DistanceKmTo(TestWorld.LvivCenter), precision: 9);
        Assert.InRange(TestWorld.LvivCenter.DistanceKmTo(kyiv), 465, 471);
    }

    [Theory]
    [InlineData(91, 0)]
    [InlineData(-91, 0)]
    [InlineData(0, 181)]
    public void IsValid_RejectsOutOfRangeCoordinates(double lat, double lon) =>
        Assert.False(new GeoPoint(lat, lon).IsValid);
}
