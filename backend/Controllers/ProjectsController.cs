using System.Text.Json;
using backend.Models;
using backend.Services;
using Microsoft.AspNetCore.Mvc;

namespace backend.Controllers;

[ApiController]
[Route("api/projects")]
public sealed class ProjectsController(IProjectRepository projects) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<ProjectRecord>>> GetAll(
        CancellationToken cancellationToken)
    {
        return Ok(await projects.GetAllAsync(cancellationToken));
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<ProjectRecord>> GetById(
        Guid id,
        CancellationToken cancellationToken)
    {
        var project = await projects.GetAsync(id, cancellationToken);
        return project is null ? NotFound() : Ok(project);
    }

    [HttpPost]
    public async Task<ActionResult<ProjectRecord>> Create(
        [FromBody] JsonElement project,
        CancellationToken cancellationToken)
    {
        if (!TryGetProjectId(project, out var id))
        {
            return BadRequest(new { error = "Project must include a GUID floorplan.id." });
        }

        var created = await projects.CreateAsync(project, cancellationToken);

        if (created is null)
        {
            return Conflict(new { error = "A project with this id already exists." });
        }

        return CreatedAtAction(nameof(GetById), new { id }, created);
    }

    [HttpPut("{id:guid}")]
    public async Task<ActionResult<ProjectRecord>> Update(
        Guid id,
        [FromBody] JsonElement project,
        CancellationToken cancellationToken)
    {
        if (!TryGetProjectId(project, out var projectId))
        {
            return BadRequest(new { error = "Project must include a GUID floorplan.id." });
        }

        if (projectId != id)
        {
            return BadRequest(new { error = "The route id must match floorplan.id." });
        }

        var updated = await projects.UpdateAsync(id, project, cancellationToken);
        return updated is null ? NotFound() : Ok(updated);
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(
        Guid id,
        CancellationToken cancellationToken)
    {
        var deleted = await projects.DeleteAsync(id, cancellationToken);
        return deleted ? NoContent() : NotFound();
    }

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
}