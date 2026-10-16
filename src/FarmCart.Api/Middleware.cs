using System.Diagnostics;
using System.Text;
using FarmCart.Core;

namespace FarmCart.Api;

public sealed record ApiError(string Error, string Message);

public static class Middleware
{
    /// <summary>Журнал запитів: метод, шлях, статус і час. Тіла й рядки запиту не логуються (персональні та платіжні дані).</summary>
    public static IApplicationBuilder UseRequestLog(this WebApplication app)
    {
        var log = app.Services.GetRequiredService<ILoggerFactory>().CreateLogger("FarmCart.Http");
        return app.Use(async (context, next) =>
        {
            var started = Stopwatch.GetTimestamp();
            await next(context);
            log.LogInformation(
                "{Method} {Path} -> {Status} ({Elapsed:0} мс)",
                context.Request.Method,
                context.Request.Path,
                context.Response.StatusCode,
                Stopwatch.GetElapsedTime(started).TotalMilliseconds);
        });
    }

    /// <summary>Перетворює доменні помилки на JSON <c>{ error, message }</c> з відповідним HTTP-статусом.</summary>
    public static IApplicationBuilder UseFarmCartErrors(this IApplicationBuilder app) => app.Use(async (context, next) =>
    {
        try
        {
            await next(context);
        }
        catch (DomainException e)
        {
            await WriteError(context, StatusFor(e.Kind), e.Code, e.Message);
        }
        catch (BadHttpRequestException e)
        {
            await WriteError(context, e.StatusCode, "bad_request", "Некоректний запит: перевірте формат даних");
        }
    });

    /// <summary>US-06 (PCI DSS): запит із номером картки в тілі чи рядку запиту відхиляється ще до обробки.</summary>
    public static IApplicationBuilder UseCardDataGuard(this IApplicationBuilder app) => app.Use(async (context, next) =>
    {
        var request = context.Request;
        var body = "";
        if (HttpMethods.IsPost(request.Method) || HttpMethods.IsPut(request.Method) || HttpMethods.IsPatch(request.Method))
        {
            request.EnableBuffering();
            using var reader = new StreamReader(request.Body, Encoding.UTF8, leaveOpen: true);
            body = await reader.ReadToEndAsync();
            request.Body.Position = 0;
        }

        if (CardDataGuard.ContainsCardNumber(body) || CardDataGuard.ContainsCardNumber(Uri.UnescapeDataString(request.QueryString.Value ?? "")))
        {
            throw Fail.Validation("card_data_forbidden", "Номер картки не можна надсилати на сервер FarmCart: оплата приймається лише як токен платіжного провайдера");
        }

        await next(context);
    });

    public static int StatusFor(ErrorKind kind) => kind switch
    {
        ErrorKind.Validation => StatusCodes.Status400BadRequest,
        ErrorKind.Unauthorized => StatusCodes.Status401Unauthorized,
        ErrorKind.PaymentDeclined => StatusCodes.Status402PaymentRequired,
        ErrorKind.Forbidden => StatusCodes.Status403Forbidden,
        ErrorKind.NotFound => StatusCodes.Status404NotFound,
        ErrorKind.Conflict => StatusCodes.Status409Conflict,
        ErrorKind.TooManyAttempts => StatusCodes.Status429TooManyRequests,
        _ => StatusCodes.Status500InternalServerError,
    };

    private static Task WriteError(HttpContext context, int status, string code, string message)
    {
        context.Response.StatusCode = status;
        return context.Response.WriteAsJsonAsync(new ApiError(code, message));
    }
}
