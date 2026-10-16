using System.Text;

namespace FarmCart.Demo;

/// <summary>Протокол роботи програми: друкує кроки сценарію в консоль і накопичує їх для файлу.</summary>
internal sealed class Protocol
{
    private readonly StringBuilder _text = new();
    private int _steps;
    private int _checks;

    public int Failures { get; private set; }

    public string Text => _text.ToString();

    public void Title(string text)
    {
        Line(text);
        Line(new string('=', 100));
    }

    public void Step(string title)
    {
        _steps++;
        Line("");
        Line($"[{_steps:D2}] {title}");
    }

    public void Info(string text) => Line($"     {text}");

    public void Detail(string text) => Line($"       • {text}");

    /// <summary>Очікуваний результат кроку; невиконане очікування позначається в протоколі.</summary>
    public void Check(bool condition, string expectation)
    {
        _checks++;
        if (!condition)
        {
            Failures++;
            Line($"     !!! Очікування не виконано: {expectation}");
        }
    }

    public void Summary()
    {
        Line("");
        Line(new string('=', 100));
        var steps = Plural(_steps, "крок", "кроки", "кроків");
        var checks = Plural(_checks, "перевірка", "перевірки", "перевірок");
        Line(Failures == 0
            ? $"Сценарій виконано: {steps}, {checks} - усі очікування справдилися."
            : $"Сценарій завершився з помилками: не пройшли {Failures} з {checks}.");
    }

    /// <summary>Українська форма множини: 1 крок, 2 кроки, 5 кроків, 22 кроки.</summary>
    private static string Plural(int n, string one, string few, string many)
    {
        var last = n % 10;
        var lastTwo = n % 100;
        var word = last == 1 && lastTwo != 11 ? one
            : last is >= 2 and <= 4 && lastTwo is < 12 or > 14 ? few
            : many;
        return $"{n} {word}";
    }

    private void Line(string text)
    {
        Console.WriteLine(text);
        _text.AppendLine(text);
    }
}
