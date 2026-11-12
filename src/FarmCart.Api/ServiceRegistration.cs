using FarmCart.Core;

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
        return services;
    }
}
