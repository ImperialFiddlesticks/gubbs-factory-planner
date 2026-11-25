using System;

public class MachineType
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public string Name { get; set; } = string.Empty;

    public int WidthMm { get; set; }

    public int DepthMm { get; set; }

    public double PowerKw { get; set; }

    public bool NeedsWater { get; set; }

    public bool NeedsFireSuppression { get; set; }
}