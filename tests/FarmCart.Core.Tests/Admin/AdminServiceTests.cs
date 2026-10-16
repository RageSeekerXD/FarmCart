namespace FarmCart.Core.Tests.Admin;

/// <summary>US-02 (B-FR-07, B-FR-12): верифікація продавців і журнал аудиту.</summary>
public sealed class AdminServiceTests
{
    private readonly TestWorld _world = new();

    [Fact]
    public void VerifyFarmer_MarksFarmerVerifiedAndWritesAudit()
    {
        var admin = _world.NewUser(Role.Admin);
        var (_, farmer) = _world.NewFarmer(verified: false);

        _world.Admin.VerifyFarmer(admin, farmer.Id);

        Assert.True(farmer.Verified);
        var entry = Assert.Single(_world.Audit.Entries(admin));
        Assert.Equal(("farmer.verify", $"farmer#{farmer.Id}", admin.Id), (entry.Action, entry.Target, entry.AdminId));
        Assert.Equal(_world.Clock.Now, entry.At);
    }

    [Fact]
    public void VerifyFarmer_ByNonAdmin_IsForbiddenAndNotAudited()
    {
        var (_, farmer) = _world.NewFarmer(verified: false);

        var error = Assert.Throws<DomainException>(() => _world.Admin.VerifyFarmer(_world.NewUser(), farmer.Id));

        Assert.Equal(ErrorKind.Forbidden, error.Kind);
        Assert.False(farmer.Verified);
        Assert.Empty(_world.Store.Audit);
    }

    [Fact]
    public void VerifyFarmer_Unknown_IsNotFound()
    {
        var error = Assert.Throws<DomainException>(() => _world.Admin.VerifyFarmer(_world.NewUser(Role.Admin), 404));

        Assert.Equal("farmer_not_found", error.Code);
    }

    [Fact]
    public void PendingFarmers_ListsOnlyUnverifiedForAdmin()
    {
        var admin = _world.NewUser(Role.Admin);
        _world.NewFarmer("Перевірена");
        var (_, pending) = _world.NewFarmer("Нова", verified: false);

        Assert.Equal([pending.Id], _world.Admin.PendingFarmers(admin).Select(f => f.Id));
        Assert.Equal(ErrorKind.Forbidden, Assert.Throws<DomainException>(() => _world.Admin.PendingFarmers(_world.NewUser())).Kind);
    }

    [Fact]
    public void AuditEntries_AreVisibleOnlyToAdmin()
    {
        var error = Assert.Throws<DomainException>(() => _world.Audit.Entries(_world.NewUser()));

        Assert.Equal("role_required", error.Code);
    }
}
