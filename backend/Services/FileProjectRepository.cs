using System.Text.Json;
using backend.Models;

namespace backend.Services;

public sealed class FileProjectRepository : IProjectRepository
{
    private static readonly JsonSerializerOptions JsonOptions =
        new(JsonSerializerDefaults.Web);

    private readonly string _directory;
    private readonly SemaphoreSlim _gate = new(1, 1);

    public FileProjectRepository(string directory)
    {
        _directory = Path.GetFullPath(directory);
        Directory.CreateDirectory(_directory);
    }

    public async Task<IReadOnlyList<ProjectRecord>> GetAllAsync(
        CancellationToken cancellationToken)
    {
        await _gate.WaitAsync(cancellationToken);

        try
        {
            var records = new List<ProjectRecord>();

            foreach (var file in Directory.EnumerateFiles(_directory, "*.json"))
            {
                var record = await ReadAsync(file, cancellationToken);

                if (record is not null)
                {
                    records.Add(record);
                }
            }

            return records
                .OrderByDescending(record => record.UpdatedAt)
                .ToArray();
        }
        finally
        {
            _gate.Release();
        }
    }

    public async Task<ProjectRecord?> GetAsync(
        Guid id,
        CancellationToken cancellationToken)
    {
        await _gate.WaitAsync(cancellationToken);

        try
        {
            return await ReadAsync(GetPath(id), cancellationToken);
        }
        finally
        {
            _gate.Release();
        }
    }

    public async Task<ProjectRecord?> CreateAsync(
        JsonElement project,
        CancellationToken cancellationToken)
    {
        if (!TryGetProjectId(project, out var id))
        {
            return null;
        }

        await _gate.WaitAsync(cancellationToken);

        try
        {
            var path = GetPath(id);

            if (File.Exists(path))
            {
                return null;
            }

            var now = DateTimeOffset.UtcNow;
            var record = new ProjectRecord(id, now, now, project.Clone());

            await WriteAsync(path, record, cancellationToken);
            return record;
        }
        finally
        {
            _gate.Release();
        }
    }

    public async Task<ProjectRecord?> UpdateAsync(
        Guid id,
        JsonElement project,
        CancellationToken cancellationToken)
    {
        if (!TryGetProjectId(project, out var payloadId) || payloadId != id)
        {
            return null;
        }

        await _gate.WaitAsync(cancellationToken);

        try
        {
            var path = GetPath(id);
            var existing = await ReadAsync(path, cancellationToken);

            if (existing is null)
            {
                return null;
            }

            var updated = existing with
            {
                UpdatedAt = DateTimeOffset.UtcNow,
                Project = project.Clone()
            };

            await WriteAsync(path, updated, cancellationToken);
            return updated;
        }
        finally
        {
            _gate.Release();
        }
    }

    public async Task<bool> DeleteAsync(
        Guid id,
        CancellationToken cancellationToken)
    {
        await _gate.WaitAsync(cancellationToken);

        try
        {
            var path = GetPath(id);

            if (!File.Exists(path))
            {
                return false;
            }

            File.Delete(path);
            return true;
        }
        finally
        {
            _gate.Release();
        }
    }

    private string GetPath(Guid id) =>
        Path.Combine(_directory, $"{id:D}.json");

    private static bool TryGetProjectId(JsonElement project, out Guid id)
    {
        id = Guid.Empty;

        if (project.ValueKind != JsonValueKind.Object ||
            !project.TryGetProperty("floorplan", out var floorplan) ||
            floorplan.ValueKind != JsonValueKind.Object ||
            !floorplan.TryGetProperty("id", out var idValue) ||
            idValue.ValueKind != JsonValueKind.String)
        {
            return false;
        }

        return Guid.TryParse(idValue.GetString(), out id);
    }

    private static async Task<ProjectRecord?> ReadAsync(
        string path,
        CancellationToken cancellationToken)
    {
        if (!File.Exists(path))
        {
            return null;
        }

        await using var stream = File.OpenRead(path);

        return await JsonSerializer.DeserializeAsync<ProjectRecord>(
            stream,
            JsonOptions,
            cancellationToken);
    }

    private static async Task WriteAsync(
        string path,
        ProjectRecord record,
        CancellationToken cancellationToken)
    {
        var temporaryPath = $"{path}.{Guid.NewGuid():N}.tmp";

        try
        {
            await using (var stream = File.Create(temporaryPath))
            {
                await JsonSerializer.SerializeAsync(
                    stream,
                    record,
                    JsonOptions,
                    cancellationToken);
            }

            File.Move(temporaryPath, path, overwrite: true);
        }
        finally
        {
            if (File.Exists(temporaryPath))
            {
                File.Delete(temporaryPath);
            }
        }
    }
}