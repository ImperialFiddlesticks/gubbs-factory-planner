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
        if (request.Machine is null || request.MachineType is null ||
            request.MachineType.Clearance is null || request.OtherMachines is null ||
            request.OtherMachines.Any(other => other is null || other.Machine is null ||
                other.MachineType is null || other.MachineType.Clearance is null))
        {
            return BadRequest("Machine, machine type, clearance, and other-machine entries are required.");
        }

        var floor = new LayoutFloor(
            request.HallWidthMm,
            request.HallDepthMm,
            request.HallOutline?.Select(point => new LayoutPoint(point.X, point.Y)).ToArray());
        var machine = ToLayoutMachine(request.Machine, request.MachineType);
        var otherMachines = request.OtherMachines
            .Select(other => ToLayoutMachine(other.Machine, other.MachineType))
            .ToArray();
        var result = _placementService.CheckLayout(floor, machine, otherMachines);

        return Ok(new PlacementCheckResponse
        {
            CanPlace = result.CanPlace,
            Code = result.Code
        });
    }

    private static LayoutMachinePlacement ToLayoutMachine(
        MachineInstance machine,
        MachineType machineType) =>
        new(
            machine.Id.ToString(),
            machine.Xmm,
            machine.Ymm,
            machine.RotationDegrees,
            new LayoutMachineType(
                machineType.WidthMm,
                machineType.DepthMm,
                new LayoutClearance(
                    machineType.Clearance.FrontMm,
                    machineType.Clearance.BackMm,
                    machineType.Clearance.LeftMm,
                    machineType.Clearance.RightMm)),
            machineType.Conveyor,
            machine.Length);
}

public class PlacementCheckRequest
{
    public int HallWidthMm { get; set; }
    public int HallDepthMm { get; set; }
    public List<PlacementPoint>? HallOutline { get; set; }
    public MachineInstance Machine { get; set; } = new();
    public MachineType MachineType { get; set; } = new();
    public List<PlacementCheckMachine> OtherMachines { get; set; } = new();
}

public class PlacementCheckMachine
{
    public MachineInstance Machine { get; set; } = new();
    public MachineType MachineType { get; set; } = new();
}

public readonly record struct PlacementPoint(double X, double Y);

public class PlacementCheckResponse
{
    public bool CanPlace { get; set; }
    public string? Code { get; set; }
}