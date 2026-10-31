using FarmCart.Core;
using Microsoft.Extensions.Options;

namespace FarmCart.Api;

/// <summary>US-01: вхід за номером телефону з одноразовим кодом; профіль і сповіщення користувача.</summary>
internal static class AuthEndpoints
{
    public static void MapAuthEndpoints(this RouteGroupBuilder api)
    {
        api.MapPost("/auth/code", (PhoneRequest body, AuthService auth, InMemorySmsGateway sms, IOptions<FarmCartOptions> options) =>
        {
            var expiresAt = auth.RequestCode(body.Phone);
            // SMS у режимі розробки не надсилаються, тож код можна повернути клієнту (FarmCart:ExposeSmsCodes).
            var devCode = options.Value.ExposeSmsCodes ? sms.LastCodeFor(PhoneNumber.Normalize(body.Phone)) : null;
            return Results.Accepted(value: new { expiresAt, devCode });
        });
        api.MapPost("/auth/verify", (VerifyRequest body, AuthService auth) =>
        {
            var session = auth.Verify(body.Phone, body.Code);
            return new { token = session.Token, isNewUser = session.IsNewUser, user = UserDto.From(session.User) };
        });
        api.MapGet("/me", (Caller caller) => UserDto.From(caller.User));
        api.MapGet("/me/notifications", (Caller caller, InMemoryNotifier notifier) => notifier.For(caller.User.Id));
    }
}
