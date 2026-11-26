using System;

public class MachineClearance
{
    public double FrontMm { get; set; }
    public double BackMm { get; set; }
    public double LeftMm { get; set; }
    public double RightMm { get; set; }
}

public class MachineType
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public string Name { get; set; } = string.Empty;

    public int WidthMm { get; set; }

    public int DepthMm { get; set; }

    public MachineClearance Clearance { get; set; } = new();

    public string? Conveyor { get; set; }

    public double PowerKw { get; set; }

    public bool NeedsWater { get; set; }

    public bool NeedsFireSuppression { get; set; }
}