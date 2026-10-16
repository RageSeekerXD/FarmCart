namespace FarmCart.Core;

public enum Role
{
    Buyer,
    Farmer,
    Courier,
    Admin,
}

public sealed class User
{
    public required int Id { get; init; }

    public required string Phone { get; init; }

    public string Name { get; set; } = "";

    public HashSet<Role> Roles { get; } = [Role.Buyer];

    public bool Is(Role role) => Roles.Contains(role);

    public void Require(Role role)
    {
        if (!Is(role))
        {
            throw Fail.Forbidden("role_required", $"Дія доступна лише для ролі «{role.Title()}»");
        }
    }
}
