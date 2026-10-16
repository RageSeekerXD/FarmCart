using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json.Nodes;

namespace FarmCart.Demo;

/// <summary>Відповідь API: статус і тіло JSON.</summary>
internal sealed record Reply(int Status, string Reason, JsonNode? Body)
{
    public bool Ok => Status is >= 200 and < 300;

    public string this[string property] => Body?[property]?.ToString() ?? "";

    public JsonArray Items => Body!.AsArray();
}

/// <summary>Учасник сценарію (адміністратор, фермер, покупець, кур'єр) зі своєю сесією.</summary>
internal sealed class Actor(string name, HttpClient http, Protocol protocol)
{
    public string? Token { get; set; }

    public Task<Reply> Get(string path) => Send(HttpMethod.Get, path, body: null, idempotencyKey: null);

    public Task<Reply> Post(string path, object? body = null, string? idempotencyKey = null) =>
        Send(HttpMethod.Post, path, body ?? new { }, idempotencyKey);

    private async Task<Reply> Send(HttpMethod method, string path, object? body, string? idempotencyKey)
    {
        using var request = new HttpRequestMessage(method, path);
        if (body is not null)
        {
            request.Content = JsonContent.Create(body);
        }

        if (Token is not null)
        {
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", Token);
        }

        if (idempotencyKey is not null)
        {
            request.Headers.Add("Idempotency-Key", idempotencyKey);
        }

        using var response = await http.SendAsync(request);
        var text = await response.Content.ReadAsStringAsync();
        var reply = new Reply((int)response.StatusCode, response.StatusCode.ToString(), text.Length > 0 ? JsonNode.Parse(text) : null);
        var error = reply.Ok ? "" : $" [{reply["error"]}] {reply["message"]}";
        protocol.Info($"{name}: {method.Method} {Uri.UnescapeDataString(path)} -> {reply.Status} {reply.Reason}{error}");
        return reply;
    }
}
