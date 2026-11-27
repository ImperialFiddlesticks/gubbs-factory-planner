public sealed record TruckLogisticsPoint(double Xmm, double Ymm);

public sealed class TruckType
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string Name { get; set; } = string.Empty;
    public double? WidthMm { get; set; }
    public double? LengthMm { get; set; }
    public double? TurningRadiusMm { get; set; }
    public double? MinimumAisleWidthMm { get; set; }
    public double? LoadCapacityKg { get; set; }
    public string EnergyType { get; set; } = "electric";
    public string? BatteryType { get; set; }
    public List<string> CompatibleChargerTypes { get; set; } = [];
    public string? Category { get; set; }
    public string? Manufacturer { get; set; }
    public string? Model { get; set; }
    public string? Configuration { get; set; }
    public string? SourceUrl { get; set; }
}

public sealed class TruckParkingSpot
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string Name { get; set; } = string.Empty;
    public List<TruckLogisticsPoint> Outline { get; set; } = [];
    public List<Guid> CompatibleTruckTypeIds { get; set; } = [];
}

public sealed class TruckServiceStation
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string Name { get; set; } = string.Empty;
    public double Xmm { get; set; }
    public double Ymm { get; set; }
    public string Kind { get; set; } = "charging";
    public string? ChargerType { get; set; }
    public double ServiceCapacity { get; set; } = 1;
    public List<Guid> CompatibleTruckTypeIds { get; set; } = [];
    public List<string> CompatibleBatteryTypes { get; set; } = [];
    public Guid? ConnectedPowerUtilityId { get; set; }
    public Guid? ConnectedWaterUtilityId { get; set; }
    public double? ChargerPowerKw { get; set; }
    public double? PowerDemandKw { get; set; }
    public bool? RequiresPower { get; set; }
}

public sealed class TruckRoute
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string Name { get; set; } = string.Empty;
    public List<TruckLogisticsPoint> Points { get; set; } = [];
    public double UsableWidthMm { get; set; }
    public List<Guid> AllowedTruckTypeIds { get; set; } = [];
    public string Direction { get; set; } = "two-way";
}

public sealed class PedestrianRoute
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string Name { get; set; } = string.Empty;
    public List<TruckLogisticsPoint> Points { get; set; } = [];
    public double UsableWidthMm { get; set; }
    public PedestrianRouteParallel? Parallel { get; set; }
}

public sealed class PedestrianRouteParallel
{
    public Guid TruckRouteId { get; set; }
    public string Side { get; set; } = "left";
    public double OffsetMm { get; set; }
}

public sealed class PedestrianCrossing
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string Name { get; set; } = string.Empty;
    public double Xmm { get; set; }
    public double Ymm { get; set; }
    public Guid TruckRouteId { get; set; }
    public Guid PedestrianRouteId { get; set; }
}

public sealed class SafetyBarrier
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string Name { get; set; } = string.Empty;
    public List<TruckLogisticsPoint> Points { get; set; } = [];
    public double ThicknessMm { get; set; }
    public string Purpose { get; set; } = "pedestrian-separation";
    public Guid? ProtectedTargetId { get; set; }
    public List<TruckLogisticsPoint>? KeepClearOutline { get; set; }
}

public sealed class TruckLogisticsUtilityPoint
{
    public Guid Id { get; set; }
    public string Kind { get; set; } = string.Empty;
    public double Xmm { get; set; }
    public double Ymm { get; set; }
    public double? CapacityKw { get; set; }
}

public sealed class TruckLogisticsLayout
{
    public IReadOnlyList<TruckType> TruckTypes { get; init; } = [];
    public IReadOnlyList<TruckParkingSpot> ParkingSpots { get; init; } = [];
    public IReadOnlyList<TruckServiceStation> ServiceStations { get; init; } = [];
    public IReadOnlyList<TruckLogisticsUtilityPoint> Utilities { get; init; } = [];
    public IReadOnlyList<TruckRoute> TruckRoutes { get; init; } = [];
    public IReadOnlyList<PedestrianRoute> PedestrianRoutes { get; init; } = [];
    public IReadOnlyList<PedestrianCrossing> PedestrianCrossings { get; init; } = [];
    public IReadOnlyList<SafetyBarrier> SafetyBarriers { get; init; } = [];
    public IReadOnlyList<MachineInstance> Machines { get; init; } = [];
    public IReadOnlyList<MachineType> MachineTypes { get; init; } = [];
    public IReadOnlyList<Pillar> Pillars { get; init; } = [];
    public IReadOnlyList<Wall> Walls { get; init; } = [];
    public IReadOnlyList<LoadingBay> LoadingBays { get; init; } = [];
    public IReadOnlyList<TruckLogisticsPoint> FloorOutline { get; init; } = [];
}

public sealed class Pillar
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public double Xmm { get; set; }
    public double Ymm { get; set; }
    public double WidthMm { get; set; }
    public double DepthMm { get; set; }
}

public sealed class Wall
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public TruckLogisticsPoint Start { get; set; } = new(0, 0);
    public TruckLogisticsPoint End { get; set; } = new(0, 0);
    public double ThicknessMm { get; set; }
}
