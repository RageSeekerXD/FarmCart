using System.Text;
using System.Text.Json.Serialization;
using FarmCart.Api;
using Microsoft.Extensions.Options;

Console.OutputEncoding = Encoding.UTF8;
var builder = WebApplication.CreateBuilder(args);
builder.Logging.AddSimpleConsole(options =>
{
    options.SingleLine = true;
    options.TimestampFormat = "HH:mm:ss ";
});
builder.Services.AddFarmCart(builder.Configuration);
builder.Services.ConfigureHttpJsonOptions(options => options.SerializerOptions.Converters.Add(new JsonStringEnumConverter()));
builder.Services.Configure<RouteHandlerOptions>(options => options.ThrowOnBadRequest = true);

var app = builder.Build();
var settings = app.Services.GetRequiredService<IOptions<FarmCartOptions>>().Value;
if (settings.ExposeSmsCodes && app.Environment.IsProduction())
{
    throw new InvalidOperationException("FarmCart:ExposeSmsCodes заборонено в Production: коди входу потрапили б у відповіді API");
}

app.UseRequestLog();
app.UseFarmCartErrors();
app.UseCardDataGuard();
if (settings.SeedDemoData)
{
    DemoData.Seed(app.Services);
}

app.MapFarmCartApi();
app.Run();
