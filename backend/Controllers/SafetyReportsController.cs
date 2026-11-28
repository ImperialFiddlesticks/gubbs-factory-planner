using backend.Services;
using Microsoft.AspNetCore.Mvc;

namespace backend.Controllers;

[ApiController]
[Route("api/projects/{projectId:guid}/safety-reports")]
public sealed class SafetyReportsController(SafetyReportService reports) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<SavedSafetyReport>>> List(
        Guid projectId, CancellationToken cancellationToken) =>
        Ok(await reports.ListAsync(projectId, cancellationToken));

    [HttpPost]
    public async Task<ActionResult<SavedSafetyReport>> Create(
        Guid projectId, SafetyObservation observation, CancellationToken cancellationToken)
    {
        if (observation.Description?.Trim() is not { Length: >= 5 and <= 2000 } description ||
            observation.Where?.Trim() is not { Length: <= 200 } location ||
            observation.Detected is not { Length: <= 20 } detected ||
            detected.Any(risk => string.IsNullOrWhiteSpace(risk) || risk.Length > 300))
        {
            return BadRequest(new { error = "Provide an observation, a location and up to 20 detected risks." });
        }

        var report = await reports.CreateAsync(projectId, new(description, detected, location), cancellationToken);
        return StatusCode(StatusCodes.Status201Created, report);
    }
}
