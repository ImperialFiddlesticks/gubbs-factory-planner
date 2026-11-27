public sealed record LoadingBayValidationIssue(Guid? LoadingBayId, string Field, string Message);

public sealed class LoadingBayValidationService
{
    private const double ToleranceMm = 1e-6;
    private const double MaximumDockGapMm = 2000;

    public IReadOnlyList<LoadingBayValidationIssue> Validate(
        IReadOnlyList<LoadingBay> loadingBays,
        IReadOnlyList<LoadingDock> loadingDocks,
        double floorWidthMm,
        double floorDepthMm,
        IReadOnlyList<LoadingDockBoundaryPoint>? outline = null)
    {
        ArgumentNullException.ThrowIfNull(loadingBays);
        ArgumentNullException.ThrowIfNull(loadingDocks);
        var issues = new List<LoadingBayValidationIssue>();
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
            issues.Add(new LoadingBayValidationIssue(null, "Boundary", "A valid floor boundary is required."));
            return issues;
        }

        var validBays = new List<LoadingBay>();
        foreach (var bay in loadingBays)
        {
            ArgumentNullException.ThrowIfNull(bay);
            var valid = true;
            if (string.IsNullOrWhiteSpace(bay.Name))
            {
                issues.Add(new LoadingBayValidationIssue(bay.Id, "Name", "Name must not be empty or whitespace."));
                valid = false;
            }
            if (bay.Outline is null || bay.Outline.Count < 3 || bay.Outline.Any(point => !double.IsFinite(point.Xmm) || !double.IsFinite(point.Ymm)))
            {
                issues.Add(new LoadingBayValidationIssue(bay.Id, "Outline", "The outline must contain at least three finite points."));
                continue;
            }
            if (bay.Outline.Select(point => (point.Xmm, point.Ymm)).Distinct().Count() < 3 ||
                !double.IsFinite(Area(bay.Outline)) || Area(bay.Outline) <= ToleranceMm)
            {
                issues.Add(new LoadingBayValidationIssue(bay.Id, "Outline", "The outline must have positive area and at least three distinct points."));
                valid = false;
            }
            if (SelfIntersects(bay.Outline))
            {
                issues.Add(new LoadingBayValidationIssue(bay.Id, "Outline", "The outline must not cross itself."));
                valid = false;
            }

            var dock = loadingDocks.FirstOrDefault(item => item.Id == bay.LoadingDockId);
            if (dock is null)
            {
                issues.Add(new LoadingBayValidationIssue(bay.Id, "LoadingDockId", "The referenced loading dock does not exist."));
                valid = false;
            }
            else if (!ConnectsToDock(bay, dock, boundary))
            {
                issues.Add(new LoadingBayValidationIssue(bay.Id, "Outline", $"The outline must connect to its loading dock within {MaximumDockGapMm / 1000} m."));
                valid = false;
            }

            if (valid) validBays.Add(bay);
        }

        for (var i = 0; i < validBays.Count; i++)
        {
            for (var j = i + 1; j < validBays.Count; j++)
            {
                if (Overlaps(validBays[i].Outline, validBays[j].Outline))
                {
                    issues.Add(new LoadingBayValidationIssue(validBays[j].Id, "Outline", $"The bay overlaps loading bay '{validBays[i].Name}'."));
                }
            }
        }

        return issues;
    }

    private static double Area(IReadOnlyList<LoadingBayOutlinePoint> points)
    {
        var sum = 0d;
        for (var i = 0; i < points.Count; i++)
        {
            var next = points[(i + 1) % points.Count];
            sum += points[i].Xmm * next.Ymm - next.Xmm * points[i].Ymm;
        }
        return Math.Abs(sum) / 2;
    }

    private static bool SelfIntersects(IReadOnlyList<LoadingBayOutlinePoint> points)
    {
        for (var i = 0; i < points.Count; i++)
        {
            var a = points[i];
            var b = points[(i + 1) % points.Count];
            if (Distance(a, b) <= ToleranceMm) return true;
            var next = points[(i + 2) % points.Count];
            var incomingX = b.Xmm - a.Xmm;
            var incomingY = b.Ymm - a.Ymm;
            var outgoingX = next.Xmm - b.Xmm;
            var outgoingY = next.Ymm - b.Ymm;
            if (Math.Abs((b.Xmm - a.Xmm) * (next.Ymm - b.Ymm) - (b.Ymm - a.Ymm) * (next.Xmm - b.Xmm)) <= ToleranceMm &&
                incomingX * outgoingX + incomingY * outgoingY < -ToleranceMm) return true;
            for (var j = i + 1; j < points.Count; j++)
            {
                if (j == i + 1 || (i == 0 && j == points.Count - 1)) continue;
                if (SegmentsIntersect(a, b, points[j], points[(j + 1) % points.Count])) return true;
            }
        }
        return false;
    }

    private static bool ConnectsToDock(LoadingBay bay, LoadingDock dock, IReadOnlyList<LoadingDockBoundaryPoint> boundary)
    {
        if (!double.IsFinite(dock.WidthMm) || dock.WidthMm <= 0 || !double.IsFinite(dock.BoundaryOffsetMm)) return false;
        var segments = BoundarySegments(boundary);
        var perimeter = segments.Sum(segment => segment.Length);
        if (!double.IsFinite(perimeter) || perimeter <= ToleranceMm || dock.WidthMm > perimeter || dock.BoundaryOffsetMm < 0 || dock.BoundaryOffsetMm >= perimeter) return false;
        var spans = DockSpans(segments, perimeter, dock);
        for (var i = 0; i < bay.Outline.Count; i++)
        {
            var a = bay.Outline[i];
            var b = bay.Outline[(i + 1) % bay.Outline.Count];
            foreach (var span in spans)
            {
                var c = new LoadingBayOutlinePoint(span.Start.Xmm, span.Start.Ymm);
                var d = new LoadingBayOutlinePoint(span.End.Xmm, span.End.Ymm);
                if (SegmentsIntersect(a, b, c, d) || SegmentDistance(a, b, c, d) <= MaximumDockGapMm)
                    return true;
            }
        }
        return false;
    }

    private static List<(LoadingDockBoundaryPoint Start, LoadingDockBoundaryPoint End, double Length, double Offset)> BoundarySegments(IReadOnlyList<LoadingDockBoundaryPoint> boundary)
    {
        var segments = new List<(LoadingDockBoundaryPoint Start, LoadingDockBoundaryPoint End, double Length, double Offset)>();
        var offset = 0d;
        for (var i = 0; i < boundary.Count; i++)
        {
            var start = boundary[i];
            var end = boundary[(i + 1) % boundary.Count];
            var length = Distance(start, end);
            if (length <= ToleranceMm) continue;
            segments.Add((start, end, length, offset));
            offset += length;
        }
        return segments;
    }

    private static List<(LoadingDockBoundaryPoint Start, LoadingDockBoundaryPoint End)> DockSpans(
        IReadOnlyList<(LoadingDockBoundaryPoint Start, LoadingDockBoundaryPoint End, double Length, double Offset)> segments,
        double perimeter,
        LoadingDock dock)
    {
        var start = (dock.BoundaryOffsetMm - dock.WidthMm / 2) % perimeter;
        if (start < 0) start += perimeter;
        var end = start + dock.WidthMm;
        var ranges = end <= perimeter + ToleranceMm
            ? new[] { (Start: start, End: Math.Min(end, perimeter)) }
            : new[] { (Start: start, End: perimeter), (Start: 0d, End: end - perimeter) };
        var spans = new List<(LoadingDockBoundaryPoint Start, LoadingDockBoundaryPoint End)>();
        foreach (var range in ranges)
        {
            foreach (var segment in segments)
            {
                var from = Math.Max(range.Start, segment.Offset);
                var to = Math.Min(range.End, segment.Offset + segment.Length);
                if (to - from <= ToleranceMm) continue;
                spans.Add((At(segment, from), At(segment, to)));
            }
        }
        return spans;
    }

    private static LoadingDockBoundaryPoint At((LoadingDockBoundaryPoint Start, LoadingDockBoundaryPoint End, double Length, double Offset) segment, double offset)
    {
        var t = (offset - segment.Offset) / segment.Length;
        return new LoadingDockBoundaryPoint(
            segment.Start.Xmm + (segment.End.Xmm - segment.Start.Xmm) * t,
            segment.Start.Ymm + (segment.End.Ymm - segment.Start.Ymm) * t);
    }

    private static bool Overlaps(IReadOnlyList<LoadingBayOutlinePoint> first, IReadOnlyList<LoadingBayOutlinePoint> second)
    {
        for (var i = 0; i < first.Count; i++)
        for (var j = 0; j < second.Count; j++)
            if (ProperlyIntersects(first[i], first[(i + 1) % first.Count], second[j], second[(j + 1) % second.Count])) return true;

        return first.Any(point => Inside(point, second)) || second.Any(point => Inside(point, first)) ||
            CollinearInteriorOverlap(first, second) ||
            first.Count == second.Count && first.All(point => second.Any(other => Distance(point, other) <= ToleranceMm));
    }

    private static bool CollinearInteriorOverlap(IReadOnlyList<LoadingBayOutlinePoint> first, IReadOnlyList<LoadingBayOutlinePoint> second)
    {
        var windingA = Math.Sign(SignedArea(first));
        var windingB = Math.Sign(SignedArea(second));
        for (var i = 0; i < first.Count; i++)
        {
            var a = first[i];
            var b = first[(i + 1) % first.Count];
            var dx = b.Xmm - a.Xmm;
            var dy = b.Ymm - a.Ymm;
            var length = Distance(a, b);
            if (length <= ToleranceMm) continue;
            for (var j = 0; j < second.Count; j++)
            {
                var c = second[j];
                var d = second[(j + 1) % second.Count];
                if (Math.Abs((b.Xmm - a.Xmm) * (c.Ymm - a.Ymm) - (b.Ymm - a.Ymm) * (c.Xmm - a.Xmm)) > ToleranceMm ||
                    Math.Abs((b.Xmm - a.Xmm) * (d.Ymm - a.Ymm) - (b.Ymm - a.Ymm) * (d.Xmm - a.Xmm)) > ToleranceMm) continue;
                var direction = dx * (d.Xmm - c.Xmm) + dy * (d.Ymm - c.Ymm);
                if (windingA * windingB * Math.Sign(direction) <= 0) continue;
                var cProjection = ((c.Xmm - a.Xmm) * dx + (c.Ymm - a.Ymm) * dy) / length;
                var dProjection = ((d.Xmm - a.Xmm) * dx + (d.Ymm - a.Ymm) * dy) / length;
                var overlap = Math.Min(length, Math.Max(cProjection, dProjection)) - Math.Max(0, Math.Min(cProjection, dProjection));
                if (overlap > ToleranceMm) return true;
            }
        }
        return false;
    }

    private static double SignedArea(IReadOnlyList<LoadingBayOutlinePoint> points)
    {
        var sum = 0d;
        for (var i = 0; i < points.Count; i++)
        {
            var next = points[(i + 1) % points.Count];
            sum += points[i].Xmm * next.Ymm - next.Xmm * points[i].Ymm;
        }
        return sum / 2;
    }

    private static bool Inside(LoadingBayOutlinePoint point, IReadOnlyList<LoadingBayOutlinePoint> polygon)
    {
        var inside = false;
        for (int i = 0, j = polygon.Count - 1; i < polygon.Count; j = i++)
        {
            var a = polygon[j];
            var b = polygon[i];
            if (OnSegment(point, a, b)) return false;
            if ((a.Ymm > point.Ymm) != (b.Ymm > point.Ymm) &&
                point.Xmm < (b.Xmm - a.Xmm) * (point.Ymm - a.Ymm) / (b.Ymm - a.Ymm) + a.Xmm) inside = !inside;
        }
        return inside;
    }

    private static bool SegmentsIntersect(LoadingBayOutlinePoint a, LoadingBayOutlinePoint b, LoadingBayOutlinePoint c, LoadingBayOutlinePoint d)
    {
        var o1 = Orientation(a, b, c);
        var o2 = Orientation(a, b, d);
        var o3 = Orientation(c, d, a);
        var o4 = Orientation(c, d, b);
        return o1 * o2 < 0 && o3 * o4 < 0 ||
            o1 == 0 && OnSegment(c, a, b) || o2 == 0 && OnSegment(d, a, b) ||
            o3 == 0 && OnSegment(a, c, d) || o4 == 0 && OnSegment(b, c, d);
    }

    private static bool ProperlyIntersects(LoadingBayOutlinePoint a, LoadingBayOutlinePoint b, LoadingBayOutlinePoint c, LoadingBayOutlinePoint d) =>
        Orientation(a, b, c) * Orientation(a, b, d) < 0 && Orientation(c, d, a) * Orientation(c, d, b) < 0;

    private static int Orientation(LoadingBayOutlinePoint a, LoadingBayOutlinePoint b, LoadingBayOutlinePoint c)
    {
        var value = (b.Xmm - a.Xmm) * (c.Ymm - a.Ymm) - (b.Ymm - a.Ymm) * (c.Xmm - a.Xmm);
        return Math.Abs(value) <= ToleranceMm ? 0 : value > 0 ? 1 : -1;
    }

    private static bool OnSegment(LoadingBayOutlinePoint point, LoadingBayOutlinePoint a, LoadingBayOutlinePoint b) =>
        Orientation(a, b, point) == 0 && point.Xmm >= Math.Min(a.Xmm, b.Xmm) - ToleranceMm && point.Xmm <= Math.Max(a.Xmm, b.Xmm) + ToleranceMm &&
        point.Ymm >= Math.Min(a.Ymm, b.Ymm) - ToleranceMm && point.Ymm <= Math.Max(a.Ymm, b.Ymm) + ToleranceMm;

    private static double SegmentDistance(LoadingBayOutlinePoint a, LoadingBayOutlinePoint b, LoadingBayOutlinePoint c, LoadingBayOutlinePoint d)
    {
        if (SegmentsIntersect(a, b, c, d)) return 0;
        return Math.Min(Math.Min(PointSegmentDistance(a, c, d), PointSegmentDistance(b, c, d)),
            Math.Min(PointSegmentDistance(c, a, b), PointSegmentDistance(d, a, b)));
    }

    private static double PointSegmentDistance(LoadingBayOutlinePoint point, LoadingBayOutlinePoint a, LoadingBayOutlinePoint b)
    {
        var dx = b.Xmm - a.Xmm;
        var dy = b.Ymm - a.Ymm;
        var lengthSquared = dx * dx + dy * dy;
        var t = lengthSquared <= 0 ? 0 : Math.Clamp(((point.Xmm - a.Xmm) * dx + (point.Ymm - a.Ymm) * dy) / lengthSquared, 0, 1);
        return Distance(point, new LoadingBayOutlinePoint(a.Xmm + t * dx, a.Ymm + t * dy));
    }

    private static double Distance(LoadingBayOutlinePoint a, LoadingBayOutlinePoint b) => Math.Sqrt((a.Xmm - b.Xmm) * (a.Xmm - b.Xmm) + (a.Ymm - b.Ymm) * (a.Ymm - b.Ymm));

    private static double Distance(LoadingDockBoundaryPoint a, LoadingDockBoundaryPoint b) => Math.Sqrt((a.Xmm - b.Xmm) * (a.Xmm - b.Xmm) + (a.Ymm - b.Ymm) * (a.Ymm - b.Ymm));
}
