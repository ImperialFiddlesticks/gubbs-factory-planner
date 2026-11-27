public sealed class LoadingBay
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public string Name { get; set; } = string.Empty;

    public Guid LoadingDockId { get; set; }

    public List<LoadingBayOutlinePoint> Outline { get; set; } = [];
}

public sealed record LoadingBayOutlinePoint(double Xmm, double Ymm);
