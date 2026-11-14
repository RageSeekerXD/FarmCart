namespace FarmCart.Core.Tests.Catalog;

/// <summary>Фото товарів: формат за сигнатурою файлу, межа розміру, версія в адресі, лише власні товари.</summary>
public sealed class ProductPhotoTests
{
    private static readonly byte[] Jpeg = [0xFF, 0xD8, 0xFF, 0xE0, 1, 2, 3];
    private static readonly byte[] Png = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0, 0];
    private static readonly byte[] Webp = [.. "RIFF"u8, 0, 0, 0, 0, .. "WEBP"u8, 1];

    private readonly TestWorld _world = new();
    private readonly User _farm;
    private readonly Product _apples;

    public ProductPhotoTests()
    {
        (_farm, _) = _world.NewFarmer();
        _apples = _world.NewProduct(_farm);
    }

    [Fact]
    public void DetectImageType_RecognisesJpegPngWebpOnly()
    {
        Assert.Equal(
            ["image/jpeg", "image/png", "image/webp", null],
            new[] { Jpeg, Png, Webp, "GIF89a"u8.ToArray() }.Select(data => FarmerService.DetectImageType(data)));
    }

    [Fact]
    public void SetPhoto_StoresItAndVersionsTheUrl()
    {
        _world.Farmers.SetPhoto(_farm, _apples.Id, Jpeg);
        var first = _apples.PhotoUrl;
        _world.Farmers.SetPhoto(_farm, _apples.Id, Png);

        Assert.Equal($"/img/products/{_apples.Id}?v=1", first);
        Assert.Equal($"/img/products/{_apples.Id}?v=2", _apples.PhotoUrl);
        Assert.Equal("image/png", _world.Farmers.Photo(_apples.Id)!.ContentType);
        Assert.Equal(_apples.PhotoUrl, _world.Catalog.Search(new CatalogQuery()).Single().PhotoUrl);
    }

    [Fact]
    public void SetPhoto_RejectsWrongFormatTooLargeAndForeignProducts()
    {
        var (stranger, _) = _world.NewFarmer("Інша ферма");
        var tooLarge = new byte[FarmerService.PhotoMaxBytes + 1];
        Jpeg.CopyTo(tooLarge, 0);

        Assert.Equal("photo_type_invalid", Assert.Throws<DomainException>(() => _world.Farmers.SetPhoto(_farm, _apples.Id, "not an image"u8.ToArray())).Code);
        Assert.Equal("photo_too_large", Assert.Throws<DomainException>(() => _world.Farmers.SetPhoto(_farm, _apples.Id, tooLarge)).Code);
        Assert.Equal("not_your_product", Assert.Throws<DomainException>(() => _world.Farmers.SetPhoto(stranger, _apples.Id, Jpeg)).Code);
        Assert.Null(_apples.PhotoUrl);
    }

    [Fact]
    public void RemovePhoto_ClearsUrlAndContent()
    {
        _world.Farmers.SetPhoto(_farm, _apples.Id, Webp);

        _world.Farmers.RemovePhoto(_farm, _apples.Id);

        Assert.Null(_apples.PhotoUrl);
        Assert.Null(_world.Farmers.Photo(_apples.Id));
    }
}
