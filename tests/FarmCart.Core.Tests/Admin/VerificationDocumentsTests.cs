namespace FarmCart.Core.Tests.Admin;

/// <summary>
/// Верифікація з документами: фермер завантажує скани сертифікатів і реєстраційних документів, адміністратор
/// переглядає їх перед рішенням, а фермер дізнається про рішення сповіщенням.
/// </summary>
public sealed class VerificationDocumentsTests
{
    private static readonly byte[] Pdf = [.. "%PDF-1.7\n"u8, 1, 2, 3];
    private static readonly byte[] Png = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0];
    private readonly TestWorld _world = new();

    [Fact]
    public void AddDocument_AcceptsPdfAndImages_AndAdminCanReadThem()
    {
        var (farm, farmer) = _world.NewFarmer(verified: false);
        var admin = _world.NewUser(Role.Admin);

        var certificate = _world.Farmers.AddDocument(farm, " Органічний сертифікат.pdf ", Pdf);
        _world.Farmers.AddDocument(farm, "Витяг з ЄДР", Png);

        Assert.Equal("application/pdf", certificate.ContentType);
        Assert.Equal(["Органічний сертифікат.pdf", "Витяг з ЄДР"], _world.Admin.FarmerDocuments(admin, farmer.Id).Select(d => d.Name));
        Assert.Equal(Pdf, _world.Admin.FarmerDocument(admin, farmer.Id, certificate.Id).Data);
        Assert.Equal(2, _world.Farmers.Documents(farm).Count);
    }

    [Fact]
    public void AddDocument_OfUnsupportedTypeOrTooLarge_IsRejected()
    {
        var (farm, _) = _world.NewFarmer(verified: false);
        byte[] huge = [.. Pdf, .. new byte[FarmerService.DocumentMaxBytes]];

        Assert.Equal("document_type_invalid", Assert.Throws<DomainException>(() => _world.Farmers.AddDocument(farm, "script.exe", [0x4D, 0x5A, 0])).Code);
        Assert.Equal("document_too_large", Assert.Throws<DomainException>(() => _world.Farmers.AddDocument(farm, "big.pdf", huge)).Code);
    }

    [Fact]
    public void Documents_AreForTheirFarmerAndAdminsOnly()
    {
        var (farm, farmer) = _world.NewFarmer(verified: false);
        var (other, _) = _world.NewFarmer("Інша", verified: false);
        var document = _world.Farmers.AddDocument(farm, "Сертифікат", Pdf);

        Assert.Throws<DomainException>(() => _world.Admin.FarmerDocuments(other, farmer.Id));
        Assert.Equal("document_not_found", Assert.Throws<DomainException>(() => _world.Farmers.RemoveDocument(other, document.Id)).Code);

        _world.Farmers.RemoveDocument(farm, document.Id);
        Assert.Empty(_world.Farmers.Documents(farm));
    }

    [Fact]
    public void VerifyAndReject_NotifyTheFarmer()
    {
        var admin = _world.NewUser(Role.Admin);
        var (approved, approvedFarm) = _world.NewFarmer(verified: false);
        var (refused, refusedFarm) = _world.NewFarmer("Друга", verified: false);

        _world.Admin.VerifyFarmer(admin, approvedFarm.Id);
        _world.Admin.RejectFarmer(admin, refusedFarm.Id, "Нечитабельний сертифікат");

        Assert.Equal(NotificationKind.FarmVerified, Assert.Single(_world.Notifier.For(approved.Id)).Kind);
        var rejected = Assert.Single(_world.Notifier.For(refused.Id));
        Assert.Equal((NotificationKind.FarmRejected, "Нечитабельний сертифікат"), (rejected.Kind, rejected.Params["reason"]));
    }
}
