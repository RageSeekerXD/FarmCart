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
}
