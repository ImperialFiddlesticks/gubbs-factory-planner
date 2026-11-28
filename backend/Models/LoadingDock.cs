public enum LoadingDockFlowDirection
{
    Inbound,
    Outbound,
    TwoWay
}

public sealed class LoadingDock
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public string Name { get; set; } = string.Empty;

    public double WidthMm { get; set; }

    public double HeightMm { get; set; } = 3000;

    /// <summary>Depth extending inward and outward from the hall boundary, in millimetres.</summary>
    public double DepthMm { get; set; } = 1000;

    /// <summary>Distance in millimetres from the first outer-boundary vertex, following its point order.</summary>
    public double BoundaryOffsetMm { get; set; }

    public LoadingDockFlowDirection FlowDirection { get; set; } = LoadingDockFlowDirection.TwoWay;
}

public sealed record LoadingDockBoundaryPoint(double Xmm, double Ymm);
