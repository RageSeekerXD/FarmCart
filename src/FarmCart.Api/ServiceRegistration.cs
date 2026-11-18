using Anthropic;
using FarmCart.Core;
using Microsoft.Extensions.Options;

namespace FarmCart.Api;

public static class ServiceRegistration
{
    /// <summary>Реєструє налаштування й доменні сервіси FarmCart; сховище в пам'яті є одним на процес.</summary>
    public static IServiceCollection AddFarmCart(this IServiceCollection services, IConfiguration configuration)
    {
        services.Configure<FarmCartOptions>(configuration.GetSection(FarmCartOptions.Section));
        services.AddSingleton<IClock>(sp =>
            sp.GetRequiredService<Microsoft.Extensions.Options.IOptions<FarmCartOptions>>().Value.FixedTime is { } fixedTime
                ? new ManualClock(fixedTime)
                : new SystemClock());

        services.AddSingleton<InMemoryStore>();
        services.AddSingleton<InMemorySmsGateway>();
        services.AddSingleton<ISmsGateway>(sp => sp.GetRequiredService<InMemorySmsGateway>());
        services.AddSingleton<SandboxPaymentGateway>();
        services.AddSingleton<IPaymentGateway>(sp => sp.GetRequiredService<SandboxPaymentGateway>());
        services.AddSingleton<InMemoryNotifier>();
        services.AddSignalR();
        services.AddSingleton<INotifier, HubNotifier>();
        services.AddSingleton<AuthService>();
        services.AddSingleton<AuditLog>();
        services.AddSingleton<AdminService>();
        services.AddSingleton<FarmerService>();
        services.AddSingleton<CatalogService>();
        services.AddSingleton<CartService>();
        services.AddSingleton<OrderService>();
        services.AddSingleton<OrderWorkflow>();
        services.AddSingleton<FulfillmentService>();
        services.AddSingleton<DeliveryService>();
        services.AddSingleton<ReviewService>();
        services.AddSingleton<IProductTranslator>(sp => ChooseAi<IProductTranslator>(
            sp, configuration, new EchoProductTranslator(), new UnavailableProductTranslator(), claude => new ClaudeProductTranslator(claude)));
        services.AddSingleton<ProductTranslationService>();
        services.AddSingleton<ICatalogSearchInterpreter>(sp => ChooseAi<ICatalogSearchInterpreter>(
            sp, configuration, new KeywordCatalogSearchInterpreter(), new UnavailableCatalogSearchInterpreter(), claude => new ClaudeCatalogSearchInterpreter(claude)));
        services.AddSingleton<SmartSearchService>();
        services.AddSingleton<IFarmCartAi>(sp => ChooseAi<IFarmCartAi>(
            sp, configuration, new FakeFarmCartAi(), new UnavailableFarmCartAi(), claude => new ClaudeFarmCartAi(claude)));
        services.AddSingleton<AiAssistantService>();
        return services;
    }

    /// <summary>Без ключа API функції ШІ вимкнено, а решта застосунку працює як звичайно.</summary>
    private static T ChooseAi<T>(IServiceProvider services, IConfiguration configuration, T fake, T off, Func<ClaudeJsonClient, T> real)
    {
        if (services.GetRequiredService<IOptions<FarmCartOptions>>().Value.FakeAi)
        {
            return fake;
        }

        var apiKey = configuration[ClaudeJsonClient.ApiKeySetting];
        if (string.IsNullOrWhiteSpace(apiKey))
        {
            return off;
        }

        var client = new AnthropicClient { ApiKey = apiKey, Timeout = TimeSpan.FromSeconds(30), MaxRetries = 1 };
        return real(new ClaudeJsonClient(client, services.GetRequiredService<ILogger<ClaudeJsonClient>>()));
    }
}
