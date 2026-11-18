using System.Text;
using System.Text.Encodings.Web;
using System.Text.Json;
using Anthropic;
using Anthropic.Exceptions;
using Anthropic.Models.Beta.Messages;
using FarmCart.Core;

namespace FarmCart.Api;

/// <summary>Файл, який Claude має переглянути разом із запитом.</summary>
public sealed record ClaudeAttachment(string ContentType, byte[] Data);

/// <summary>
/// Спільне звернення до Claude зі структурованою відповіддю. Ключ читається лише на сервері,
/// а в журнал потрапляє тільки причина невдачі, без тексту запиту.
/// </summary>
public sealed partial class ClaudeJsonClient(IAnthropicClient client, ILogger<ClaudeJsonClient> log)
{
    /// <summary>Назва змінної середовища з ключем API; без неї функції ШІ вимкнено.</summary>
    public const string ApiKeySetting = "ANTHROPIC_API_KEY";

    public const string Model = "claude-opus-5-5";

    // Кирилиця йде до моделі як текст, а не як послідовності \uXXXX: так точніша відповідь і менше токенів.
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web) { Encoder = JavaScriptEncoder.UnsafeRelaxedJsonEscaping };

    /// <summary>Об'єкт схеми відповіді: усі властивості обов'язкові, зайвих немає.</summary>
    public static Dictionary<string, object> Strict(object properties) => new()
    {
        ["type"] = "object",
        ["additionalProperties"] = false,
        ["required"] = JsonSerializer.SerializeToElement(properties).EnumerateObject().Select(property => property.Name).ToArray(),
        ["properties"] = properties,
    };

    /// <summary>Значення схеми, яке може бути порожнім.</summary>
    public static object OrNull(object schema) => new { anyOf = new[] { schema, new { type = "null" } } };

    /// <summary>Схема відповіді у вигляді, який приймає сервіс.</summary>
    public static IReadOnlyDictionary<string, JsonElement> Schema(object properties) =>
        Strict(properties).ToDictionary(pair => pair.Key, pair => JsonSerializer.SerializeToElement(pair.Value));

    /// <summary>Надсилає дані як JSON і повертає відповідь за схемою; будь-яка невдача стає помилкою <paramref name="failure"/>.</summary>
    public async Task<T> AskAsync<T>(
        string instructions,
        IReadOnlyDictionary<string, JsonElement> schema,
        object input,
        Func<DomainException> failure,
        CancellationToken cancellation,
        ClaudeAttachment? attachment = null)
        where T : class
    {
        try
        {
            var response = await client.Beta.Messages.Create(Request(instructions, schema, input, attachment), cancellation);
            if (response.StopReason != BetaStopReason.EndTurn)
            {
                throw Failed("incomplete_reply", failure);
            }

            var reply = string.Concat(response.Content.Select(block => block.Value).OfType<BetaTextBlock>().Select(block => block.Text));
            return JsonSerializer.Deserialize<T>(reply, Json) ?? throw Failed("invalid_reply", failure);
        }
        catch (AnthropicUnauthorizedException)
        {
            throw Failed("api_key_rejected", failure);
        }
        catch (AnthropicRateLimitException)
        {
            throw Failed("rate_limited", failure);
        }
        catch (Anthropic5xxException)
        {
            throw Failed("provider_error", failure);
        }
        catch (AnthropicApiException)
        {
            throw Failed("request_rejected", failure);
        }
        catch (AnthropicIOException)
        {
            throw Failed("connection_failed", failure);
        }
        catch (JsonException)
        {
            throw Failed("invalid_reply", failure);
        }
        catch (OperationCanceledException) when (!cancellation.IsCancellationRequested)
        {
            throw Failed("timed_out", failure);
        }
    }

    private static BetaUserMessageParam UserMessage(object input, ClaudeAttachment? attachment)
    {
        var text = JsonSerializer.Serialize(input, Json);
        return attachment is null
            ? new BetaUserMessageParam { Content = text }
            : new BetaUserMessageParam { Content = new List<BetaContentBlockParam> { Block(attachment), new BetaTextBlockParam { Text = text } } };
    }

    /// <summary>Фото чи PDF надсилаються як файл; SVG із демонстраційних даних - це текст.</summary>
    private static BetaContentBlockParam Block(ClaudeAttachment attachment)
    {
        var data = Convert.ToBase64String(attachment.Data);
        return attachment.ContentType switch
        {
            "application/pdf" => new BetaRequestDocumentBlock { Source = new BetaBase64PdfSource { Data = data } },
            "image/svg+xml" => new BetaTextBlockParam { Text = Encoding.UTF8.GetString(attachment.Data) },
            "image/png" => new BetaImageBlockParam { Source = new BetaBase64ImageSource { Data = data, MediaType = MediaType.ImagePng } },
            "image/webp" => new BetaImageBlockParam { Source = new BetaBase64ImageSource { Data = data, MediaType = MediaType.ImageWebP } },
            _ => new BetaImageBlockParam { Source = new BetaBase64ImageSource { Data = data, MediaType = MediaType.ImageJpeg } },
        };
    }

    private static MessageCreateParams Request(string instructions, IReadOnlyDictionary<string, JsonElement> schema, object input, ClaudeAttachment? attachment) => new()
    {
        Model = Model,
        MaxTokens = 16000,
        Betas = ["server-side-fallback-2026-07-01"],
        Fallbacks = new Default(),
        System = instructions,
        OutputConfig = new BetaOutputConfig
        {
            Effort = Effort.Low,
            Format = new BetaJsonOutputFormat { Schema = schema },
        },
        Messages = [UserMessage(input, attachment)],
    };

    private DomainException Failed(string reason, Func<DomainException> failure)
    {
        LogFailure(log, reason);
        return failure();
    }

    [LoggerMessage(EventId = 1, Level = LogLevel.Warning, Message = "Звернення до Claude не виконано: {Reason}")]
    private static partial void LogFailure(ILogger logger, string reason);
}
