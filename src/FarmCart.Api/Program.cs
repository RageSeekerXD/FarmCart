using System.Text;
using System.Text.Json.Serialization;
using FarmCart.Api;

Console.OutputEncoding = Encoding.UTF8;
var builder = WebApplication.CreateBuilder(args);
builder.Logging.AddSimpleConsole(options =>
{
    options.SingleLine = true;
    options.TimestampFormat = "HH:mm:ss ";
});
builder.Services.AddFarmCart();
builder.Services.ConfigureHttpJsonOptions(options => options.SerializerOptions.Converters.Add(new JsonStringEnumConverter()));
builder.Services.Configure<RouteHandlerOptions>(options => options.ThrowOnBadRequest = true);

var app = builder.Build();
app.UseRequestLog();
app.UseFarmCartErrors();
app.UseCardDataGuard();
if (app.Configuration.GetValue<bool>("FarmCart:SeedDemoData"))
{
    DemoData.Seed(app.Services);
}

app.MapFarmCartApi();
app.Run();
