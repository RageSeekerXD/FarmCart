using System.Text.RegularExpressions;

namespace FarmCart.Core;

public interface ISmsGateway
{
    void Send(string phone, string text);
}

/// <summary>Імітація SMS-провайдера: зберігає надіслані повідомлення (тести й режим розробки).</summary>
public sealed partial class InMemorySmsGateway : ISmsGateway
{
    private readonly List<(string Phone, string Text)> _messages = [];
    private readonly Lock _sync = new();

    public void Send(string phone, string text)
    {
        lock (_sync)
        {
            _messages.Add((phone, text));
        }
    }

    public string? LastCodeFor(string phone)
    {
        lock (_sync)
        {
            var text = _messages.LastOrDefault(m => m.Phone == phone).Text;
            return text is null ? null : SixDigits().Match(text).Value;
        }
    }

    [GeneratedRegex(@"\d{6}")]
    private static partial Regex SixDigits();
}
