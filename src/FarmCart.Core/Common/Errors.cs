namespace FarmCart.Core;

/// <summary>Категорії доменних помилок; API відображає їх на HTTP-статуси.</summary>
public enum ErrorKind
{
    Validation,
    Unauthorized,
    Forbidden,
    NotFound,
    Conflict,
    PaymentDeclined,
    TooManyAttempts,
}

/// <summary>Порушення бізнес-правила: машинний код і повідомлення для користувача.</summary>
public sealed class DomainException(ErrorKind kind, string code, string message) : Exception(message)
{
    public ErrorKind Kind { get; } = kind;

    public string Code { get; } = code;
}

/// <summary>Короткі фабрики доменних помилок: <c>throw Fail.NotFound(...)</c>.</summary>
public static class Fail
{
    public static DomainException Validation(string code, string message) => new(ErrorKind.Validation, code, message);

    public static DomainException Unauthorized(string code, string message) => new(ErrorKind.Unauthorized, code, message);

    public static DomainException Forbidden(string code, string message) => new(ErrorKind.Forbidden, code, message);

    public static DomainException NotFound(string code, string message) => new(ErrorKind.NotFound, code, message);

    public static DomainException Conflict(string code, string message) => new(ErrorKind.Conflict, code, message);

    public static DomainException PaymentDeclined(string code, string message) => new(ErrorKind.PaymentDeclined, code, message);

    public static DomainException TooManyAttempts(string code, string message) => new(ErrorKind.TooManyAttempts, code, message);
}
