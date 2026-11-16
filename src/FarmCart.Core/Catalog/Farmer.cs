namespace FarmCart.Core;

/// <summary>Продавець-фермер: «прилавок» на ярмарку FarmCart.</summary>
public sealed class Farmer
{
    public required int Id { get; init; }

    public required int UserId { get; init; }

    public required LocalizedText Name { get; init; }

    public required GeoPoint Location { get; init; }

    /// <summary>Має органічний сертифікат.</summary>
    public bool Certified { get; init; }

    /// <summary>Посилання на документи для верифікації.</summary>
    public string? Documents { get; init; }

    public bool Verified { get; set; }

    /// <summary>Причина, з якою адміністратор відхилив заявку; null - заявка чекає перевірки або вже верифікована.</summary>
    public string? RejectionReason { get; set; }

    public double? Rating { get; set; }

    public int ReviewCount { get; set; }

    /// <summary>Історія господарства двома мовами для сторінки ферми; null - фермер її ще не розповів.</summary>
    public LocalizedText? Story { get; set; }

    /// <summary>Дні тижня, коли ферма возить замовлення; порожня множина - щодня.</summary>
    public IReadOnlySet<DayOfWeek> DeliveryDays { get; set; } = new HashSet<DayOfWeek>();

    public bool DeliversOn(DayOfWeek day) => DeliveryDays.Count == 0 || DeliveryDays.Contains(day);
}

/// <summary>Скан документа для верифікації (сертифікат, витяг з реєстру): бачать лише власник і адміністратор.</summary>
public sealed record FarmDocument(int Id, int FarmerId, string Name, string ContentType, byte[] Data, DateTimeOffset UploadedAt)
{
    public int Size => Data.Length;
}
