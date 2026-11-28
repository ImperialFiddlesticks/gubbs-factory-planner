public sealed record LoadingDockValidationIssue(Guid? LoadingDockId, string Field, string Message);

public sealed class LoadingDockValidationService
{
    private const double ToleranceMm = 1e-6;

    public IReadOnlyList<LoadingDockValidationIssue> Validate(
        IReadOnlyList<LoadingDock> loadingDocks,
        double floorWidthMm,
        double floorDepthMm,
        IReadOnlyList<LoadingDockBoundaryPoint>? outline = null)
    {
        ArgumentNullException.ThrowIfNull(loadingDocks);
        var issues = new List<LoadingDockValidationIssue>();
        var boundary = outline ?? new[]
        {
            new LoadingDockBoundaryPoint(0, 0),
            new LoadingDockBoundaryPoint(floorWidthMm, 0),
            new LoadingDockBoundaryPoint(floorWidthMm, floorDepthMm),
            new LoadingDockBoundaryPoint(0, floorDepthMm)
        };

        if (!double.IsFinite(floorWidthMm) || floorWidthMm <= 0 ||
            !double.IsFinite(floorDepthMm) || floorDepthMm <= 0 ||
            boundary.Count < 3 || boundary.Any(point => !double.IsFinite(point.Xmm) || !double.IsFinite(point.Ymm)))
        {
            issues.Add(new LoadingDockValidationIssue(null, "Boundary", "A valid floor boundary is required."));
            return issues;
        }

        var perimeter = 0d;
        for (var i = 0; i < boundary.Count; i++)
        {
            var start = boundary[i];
            var end = boundary[(i + 1) % boundary.Count];
            var dx = end.Xmm - start.Xmm;
            var dy = end.Ymm - start.Ymm;
            perimeter += Math.Sqrt(dx * dx + dy * dy);
        }

        if (!double.IsFinite(perimeter) || perimeter <= ToleranceMm)
        {
            issues.Add(new LoadingDockValidationIssue(null, "Boundary", "The floor boundary must have a positive perimeter."));
            return issues;
        }

        var valid = new List<LoadingDock>();
        foreach (var dock in loadingDocks)
        {
            ArgumentNullException.ThrowIfNull(dock);
            var validDock = true;
            if (string.IsNullOrWhiteSpace(dock.Name))
            {
                issues.Add(new LoadingDockValidationIssue(dock.Id, "Name", "Name must not be empty or whitespace."));
                validDock = false;
            }
            if (!double.IsFinite(dock.WidthMm) || dock.WidthMm <= 0)
            {
                issues.Add(new LoadingDockValidationIssue(dock.Id, "WidthMm", "Opening width must be finite and greater than zero."));
                validDock = false;
            }
            else if (dock.WidthMm > perimeter + ToleranceMm)
            {
                issues.Add(new LoadingDockValidationIssue(dock.Id, "WidthMm", "Opening width cannot exceed the floor perimeter."));
                validDock = false;
            }
            if (!double.IsFinite(dock.HeightMm) || dock.HeightMm <= 0)
            {
                issues.Add(new LoadingDockValidationIssue(dock.Id, "HeightMm", "Door height must be finite and greater than zero."));
                validDock = false;
            }
            if (!double.IsFinite(dock.DepthMm) || dock.DepthMm <= 0)
            {
                issues.Add(new LoadingDockValidationIssue(dock.Id, "DepthMm", "Door depth must be finite and greater than zero."));
                validDock = false;
            }
            if (!double.IsFinite(dock.BoundaryOffsetMm) || dock.BoundaryOffsetMm < 0 || dock.BoundaryOffsetMm >= perimeter)
            {
                issues.Add(new LoadingDockValidationIssue(dock.Id, "BoundaryOffsetMm", "The dock position must lie on the outer boundary."));
                validDock = false;
            }
            if (!Enum.IsDefined(dock.FlowDirection))
            {
                issues.Add(new LoadingDockValidationIssue(dock.Id, "FlowDirection", "Flow direction must be inbound, outbound, or two-way."));
                validDock = false;
            }
            if (validDock) valid.Add(dock);
        }

        for (var i = 0; i < valid.Count; i++)
        {
            for (var j = i + 1; j < valid.Count; j++)
            {
                if (Overlaps(valid[i], valid[j], perimeter))
                {
                    issues.Add(new LoadingDockValidationIssue(
                        valid[j].Id,
                        "WidthMm",
                        $"The opening overlaps loading dock '{valid[i].Name}'."));
                }
            }
        }

        return issues;
    }

    private static bool Overlaps(LoadingDock first, LoadingDock second, double perimeter)
    {
        var firstIntervals = Intervals(first, perimeter);
        var secondIntervals = Intervals(second, perimeter);
        return firstIntervals.Any(a => secondIntervals.Any(b => Math.Min(a.End, b.End) - Math.Max(a.Start, b.Start) > ToleranceMm));
    }

    private static IReadOnlyList<(double Start, double End)> Intervals(LoadingDock dock, double perimeter)
    {
        var start = (dock.BoundaryOffsetMm - dock.WidthMm / 2) % perimeter;
        if (start < 0) start += perimeter;
        var end = start + dock.WidthMm;
        return end <= perimeter + ToleranceMm
            ? new[] { (start, Math.Min(end, perimeter)) }
            : new[] { (start, perimeter), (0, end - perimeter) };
    }
}
