using System.Text;
using FarmCart.Demo;

// Демонстраційний клієнт FarmCart: проходить наскрізний сценарій релізу 1.0 через REST API так,
// як це роблять застосунки адміністратора, фермера, покупця й кур'єра, і друкує протокол роботи.
// Запуск: dotnet run --project tools/FarmCart.Demo -- [адреса сервера] [файл протоколу]
Console.OutputEncoding = Encoding.UTF8;
var server = new Uri(args.Length > 0 ? args[0] : "http://localhost:5080");
var scenario = new DemoScenario(server);
var succeeded = await scenario.RunAsync();
if (args.Length > 1)
{
    await File.WriteAllTextAsync(args[1], scenario.Protocol, new UTF8Encoding(encoderShouldEmitUTF8Identifier: false));
}

return succeeded ? 0 : 1;
