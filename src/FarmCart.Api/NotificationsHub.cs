using FarmCart.Core;
using Microsoft.AspNetCore.SignalR;

namespace FarmCart.Api;

/// <summary>
/// BE-3: хаб сповіщень у реальному часі. Клієнт підключається з токеном сесії в параметрі <c>access_token</c>
/// (браузер не може додати заголовок Authorization до WebSocket) і потрапляє в групу свого користувача.
/// Хаб лише надсилає події «notification»; методів, які викликає клієнт, немає.
/// </summary>
public sealed class NotificationsHub(AuthService auth) : Hub
{
    public const string Path = "/hubs/notifications";

    /// <summary>Назва події, яку отримує клієнт; тіло - <see cref="Notification"/>.</summary>
    public const string Event = "notification";

    public static string GroupOf(int userId) => $"user-{userId}";

    public override async Task OnConnectedAsync()
    {
        if (TokenOf(Context.GetHttpContext()) is not { } token || auth.FindByToken(token) is not { } user)
        {
            // Без дійсної сесії з'єднання закривається: чужих сповіщень анонім не отримає.
            Context.Abort();
            return;
        }

        await Groups.AddToGroupAsync(Context.ConnectionId, GroupOf(user.Id));
        await base.OnConnectedAsync();
    }

    /// <summary>WebSocket і SSE передають токен у рядку запиту, long polling - у заголовку Authorization.</summary>
    private static string? TokenOf(HttpContext? http)
    {
        const string Prefix = "Bearer ";
        var fromQuery = http?.Request.Query["access_token"].ToString();
        if (!string.IsNullOrEmpty(fromQuery))
        {
            return fromQuery;
        }

        var header = http?.Request.Headers.Authorization.ToString() ?? "";
        return header.StartsWith(Prefix, StringComparison.OrdinalIgnoreCase) ? header[Prefix.Length..].Trim() : null;
    }
}

/// <summary>
/// Декоратор <see cref="INotifier"/>: зберігає сповіщення в пам'яті (його й далі віддає <c>GET /api/me/notifications</c>)
/// і одразу надсилає його підключеним клієнтам користувача. Надсилання не чекаємо: доменна операція
/// не повинна залежати від мережі клієнта, а той, хто був офлайн, забере сповіщення опитуванням.
/// </summary>
public sealed class HubNotifier(InMemoryNotifier store, IHubContext<NotificationsHub> hub) : INotifier
{
    public Notification Push(int userId, string kind, string text, int? orderId = null, IReadOnlyDictionary<string, string>? parameters = null)
    {
        var notification = store.Push(userId, kind, text, orderId, parameters);
        _ = hub.Clients.Group(NotificationsHub.GroupOf(userId)).SendAsync(NotificationsHub.Event, notification);
        return notification;
    }
}
