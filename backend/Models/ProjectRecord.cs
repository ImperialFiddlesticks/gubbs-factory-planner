using System.Text.Json;

namespace backend.Models;

public sealed record ProjectRecord(
    Guid Id,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt,
    JsonElement Project);


