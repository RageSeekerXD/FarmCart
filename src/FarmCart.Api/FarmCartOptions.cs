namespace FarmCart.Api;

/// <summary>Налаштування FarmCart з розділу «FarmCart» конфігурації (appsettings*.json, змінні середовища FarmCart__*).</summary>
public sealed class FarmCartOptions
{
    public const string Section = "FarmCart";

    /// <summary>Завантажити демонстраційні дані під час запуску (режим розробки).</summary>
    public bool SeedDemoData { get; set; }

    /// <summary>Повертати код із SMS у відповіді <c>POST /api/auth/code</c> (поле devCode): у режимі розробки SMS не надсилаються.</summary>
    public bool ExposeSmsCodes { get; set; }

    /// <summary>
    /// BE-7: зафіксований час сервера для наскрізних тестів веб-клієнта (сезонність і слоти не залежать від дня запуску).
    /// Як і <see cref="ExposeSmsCodes"/>, у Production заборонено.
    /// </summary>
    public DateTimeOffset? FixedTime { get; set; }

    /// <summary>Тека зібраного веб-клієнта (vite build); за замовчуванням - <c>web/dist</c> поруч із рішенням.</summary>
    public string? WebRoot { get; set; }
}
