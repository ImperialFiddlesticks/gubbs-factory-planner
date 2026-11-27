using System.Text.Json;
using backend.Models;

namespace backend.Services;

public interface IProjectRepository
{
    Task<IReadOnlyList<ProjectRecord>> GetAllAsync(CancellationToken cancellationToken);
    Task<ProjectRecord?> GetAsync(Guid id, CancellationToken cancellationToken);
    Task<ProjectRecord?> CreateAsync(JsonElement project, CancellationToken cancellationToken);
    Task<ProjectRecord?> UpdateAsync(Guid id, JsonElement project, CancellationToken cancellationToken);
    Task<bool> DeleteAsync(Guid id, CancellationToken cancellationToken);
}
