namespace FarmCart.Api;

/// <summary>Налаштування FarmCart з розділу «FarmCart» конфігурації (appsettings*.json, змінні середовища FarmCart__*).</summary>
public sealed class FarmCartOptions
{
    public const string Section = "FarmCart";

    /// <summary>Завантажити демонстраційні дані під час запуску (режим розробки).</summary>
    public bool SeedDemoData { get; set; }

    /// <summary>Повертати код із SMS у відповіді <c>POST /api/auth/code</c> (поле devCode): у режимі розробки SMS не надсилаються.</summary>
    public bool ExposeSmsCodes { get; set; }
}
