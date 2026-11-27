using System.Text.Json.Serialization;
using Microsoft.AspNetCore.Mvc;

namespace backend.Controllers;

[ApiController]
[Route("api/[controller]")]
public sealed class MachineTypesController : ControllerBase
{
    private static readonly IReadOnlyList<CatalogMachineType> MachineTypes =
    [
        Item("cnc-mill", "machining", "CNC mill (vertical machining centre)", "CNC mill", 2500, 2200, 1000, 600, 800, 800, 22, true, false, 2800),
        Item("cnc-lathe", "machining", "CNC lathe", "CNC lathe", 3000, 1800, 1000, 600, 600, 600, 18, true, false, 2100),
        Item("hydraulic-press", "forming", "Hydraulic press (100 t)", "Hydraulic press (100 t)", 1800, 1500, 1200, 800, 800, 800, 15, false, true, 3200),
        Item("conveyor-straight", "material-handling", "Belt conveyor", "Belt conveyor", 3000, 800, 600, 600, 300, 300, 0.75, false, false, 900, conveyor: "straight"),
        Item("conveyor-corner-left", "material-handling", "Conveyor corner (left turn)", "Conveyor corner (left)", 800, 800, 600, 600, 600, 600, 0.2, false, false, 900, conveyor: "corner-left"),
        Item("conveyor-corner-right", "material-handling", "Conveyor corner (right turn)", "Conveyor corner (right)", 800, 800, 600, 600, 600, 600, 0.2, false, false, 900, conveyor: "corner-right"),
        Item("packing-table", "assembly-packing", "Packing table", "Packing table", 2000, 1000, 900, 0, 300, 300, 0, false, false, 900),
        Item("air-compressor", "support", "Air compressor (screw)", "Air compressor", 1500, 1000, 1000, 800, 600, 600, 37, true, true, 1700),
        Item("assembly-jig-large", "assembly-packing", "Assembly jig, large (fuselage/wing section)", "Assembly jig (large)", 6000, 3000, 1500, 1200, 1200, 1200, 3, false, false, 3500, people: 3),
        Item("assembly-jig-small", "assembly-packing", "Assembly jig, small (sub-assembly)", "Assembly jig (small)", 3000, 2000, 1200, 1000, 1000, 1000, 1.5, false, false, 2200, people: 2),
        Item("work-bench", "assembly-packing", "Heavy work bench (with vice)", "Work bench", 2400, 850, 1000, 0, 300, 300, 0, false, false, 900, people: 1),
        Item("assembly-table", "assembly-packing", "Assembly table (free all round)", "Assembly table", 2400, 1200, 900, 900, 900, 900, 0, false, false, 900, people: 2),
        Item("quality-table", "assembly-packing", "Quality-control table", "Quality-control table", 2200, 1000, 1000, 300, 500, 500, 0.5, false, false, 900, people: 1),
        Item("pillar-drill", "machining", "Pillar drill", "Pillar drill", 800, 600, 1000, 300, 500, 500, 1.5, false, false, 1800, people: 1),
        Item("band-saw", "machining", "Metal band saw", "Band saw", 2000, 900, 1000, 300, 1500, 1500, 2.2, true, false, 1400, people: 1),
        Item("welding-table", "welding", "Welding table (MIG/TIG, with extraction)", "Welding table", 2000, 1000, 1200, 600, 800, 800, 12, false, true, 900, people: 1),
        Item("grinding-bench", "welding", "Grinding bench (with extraction)", "Grinding bench", 1800, 800, 1000, 0, 600, 600, 3, false, true, 1200, people: 1),
        Item("press-brake", "welding", "Press brake", "Press brake", 3200, 1500, 1500, 800, 1000, 1000, 15, false, false, 2600, people: 1),
        Item("hydraulic-press-30t", "forming", "Hydraulic press (30 t)", "Hydraulic press (30 t)", 1200, 1000, 1000, 500, 600, 600, 5.5, false, false, 2200, people: 1),
        Item("tool-cabinet", "storage", "Tool cabinet", "Tool cabinet", 1000, 500, 900, 0, 0, 0, 0, false, false, 2000, station: false),
        Item("tool-trolley", "storage", "Tool trolley", "Tool trolley", 800, 500, 600, 0, 0, 0, 0, false, false, 1000, station: false),
        Item("storage-shelf", "storage", "Storage shelf / pallet rack", "Storage shelf", 2700, 1100, 1500, 0, 0, 0, 0, false, false, 3000, station: false),
        Item("eur-pallet", "storage", "EUR-pallet spot (1.2 × 0.8 m)", "EUR-pallet spot", 1200, 800, 800, 0, 200, 200, 0, false, false, 1000, station: false),
        Item("chemicals-cabinet", "storage", "Chemicals cabinet (fire-rated)", "Chemicals cabinet", 1200, 600, 900, 0, 300, 300, 0, false, true, 1950, station: false),
        Item("parts-washer", "support", "Parts washer", "Parts washer", 1200, 800, 1000, 300, 400, 400, 3, true, false, 1300, people: 1),
    ];

    [HttpGet]
    [ProducesResponseType(typeof(IReadOnlyList<CatalogMachineType>), StatusCodes.Status200OK)]
    public ActionResult<IReadOnlyList<CatalogMachineType>> Get() => Ok(MachineTypes);

    private static CatalogMachineType Item(
        string id, string category, string name, string shortName,
        int width, int depth, int front, int back, int left, int right,
        double powerKw, bool needsWater, bool needsFireSuppression, int height,
        string? conveyor = null, int? people = null, bool? station = null) =>
        new(id, category, name, shortName, width, depth,
            new CatalogClearance(front, back, left, right), powerKw,
            needsWater, needsFireSuppression, height, conveyor, people, station);
}

public sealed record CatalogMachineType(
    string Id,
    string Category,
    string Name,
    string ShortName,
    int Width,
    int Depth,
    CatalogClearance Clearance,
    double PowerKw,
    bool NeedsWater,
    bool NeedsFireSuppression,
    int Height,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? Conveyor,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] int? People,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] bool? Station);

public sealed record CatalogClearance(int Front, int Back, int Left, int Right);
