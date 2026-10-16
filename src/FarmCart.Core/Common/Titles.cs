namespace FarmCart.Core;

/// <summary>Назви значень перелічень українською для повідомлень користувачам.</summary>
public static class Titles
{
    public static string Title(this Role role) => role switch
    {
        Role.Buyer => "покупець",
        Role.Farmer => "фермер",
        Role.Courier => "кур'єр",
        Role.Admin => "адміністратор",
        _ => role.ToString(),
    };

    public static string Title(this OrderStatus status) => status switch
    {
        OrderStatus.Placed => "оформлено",
        OrderStatus.Accepted => "прийнято",
        OrderStatus.Assembling => "збирається",
        OrderStatus.InTransit => "в дорозі",
        OrderStatus.Delivered => "доставлено",
        OrderStatus.Rejected => "відхилено",
        _ => status.ToString(),
    };

    public static string Title(this PaymentStatus status) => status switch
    {
        PaymentStatus.Paid => "оплачено",
        PaymentStatus.PayOnDelivery => "оплата при отриманні",
        PaymentStatus.PaidOnDelivery => "оплачено при отриманні",
        PaymentStatus.Refunded => "кошти повернено",
        _ => status.ToString(),
    };
}
