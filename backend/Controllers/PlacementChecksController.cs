using Microsoft.AspNetCore.Mvc;

[ApiController]
[Route("api/placement-checks")]
public class PlacementChecksController : ControllerBase
{
    private readonly PlacementService _placementService;

    public PlacementChecksController(PlacementService placementService)
    {
        _placementService = placementService;
    }

    [HttpPost]
    public ActionResult<PlacementCheckResponse> CheckPlacement(
        PlacementCheckRequest request)
    {
        var result = _placementService.Check(
            request.HallWidthMm,
            request.HallDepthMm,
            request.Machine,
            request.MachineType);

        return Ok(new PlacementCheckResponse
        {
            CanPlace = result.CanPlace,
            Code = result.Code
        });
    }
}

public class PlacementCheckRequest
{
    public int HallWidthMm { get; set; }
    public int HallDepthMm { get; set; }
    public MachineInstance Machine { get; set; } = new();
    public MachineType MachineType { get; set; } = new();
}

public class PlacementCheckResponse
{
    public bool CanPlace { get; set; }
    public string? Code { get; set; }
}