using FarmCart.Demo;

namespace FarmCart.AcceptanceTests;

/// <summary>
/// DEF-03 (ЛР3): демонстраційний сценарій релізу є наскрізним димовим тестом, тож він має проходити в будь-який день року,
/// а не лише в серпні-жовтні, коли збігалися сезони демонстраційних товарів. Сценарій виконується тим самим клієнтом,
/// що й demo.cmd, але проти сервера в пам'яті з керованим годинником.
/// </summary>
public sealed class DemoScenarioTests
{
    public static TheoryData<int> Months => new(Enumerable.Range(1, 12));

    [Theory(DisplayName = "DEMO-2 Сценарій релізу проходить у будь-якому місяці року")]
    [MemberData(nameof(Months))]
    public async Task ReleaseScenarioPassesInEveryMonth(int month)
    {
        using var app = new FarmCartApp(seedDemoData: true, start: new DateTimeOffset(2026, month, 15, 10, 0, 0, TimeSpan.FromHours(2)));
        using var output = new StringWriter();
        var scenario = new DemoScenario(app.CreateClient(), output);

        var passed = await scenario.RunAsync();

        Assert.True(passed, scenario.Protocol);
    }
}
