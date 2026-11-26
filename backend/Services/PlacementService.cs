using System;
using System.Collections.Generic;
using System.Linq;

internal sealed record LayoutPoint(double X, double Y);

internal sealed record LayoutClearance(double FrontMm, double BackMm, double LeftMm, double RightMm);

internal sealed record LayoutFloor(
    double WidthMm,
    double DepthMm,
    IReadOnlyList<LayoutPoint>? Outline = null);

internal sealed record LayoutMachineType(
    double WidthMm,
    double DepthMm,
    LayoutClearance Clearance);

internal sealed record LayoutMachinePlacement(
    string Id,
    double Xmm,
    double Ymm,
    double RotationDegrees,
    LayoutMachineType Type,
    string? ConveyorKind = null,
    double? LengthMm = null);

public class PlacementService
{
    private const double GeometryToleranceMm = 1e-6;

    public (bool CanPlace, string? Code) Check(
        int hallWidthMm,
        int hallDepthMm,
        MachineInstance machine,
        MachineType machineType)
    {
        var floor = new LayoutFloor(hallWidthMm, hallDepthMm);
        var type = new LayoutMachineType(
            machineType.WidthMm,
            machineType.DepthMm,
            new LayoutClearance(
                machineType.Clearance.FrontMm,
                machineType.Clearance.BackMm,
                machineType.Clearance.LeftMm,
                machineType.Clearance.RightMm));
        var placement = new LayoutMachinePlacement(
            machine.Id.ToString(),
            machine.Xmm,
            machine.Ymm,
            machine.RotationDegrees,
            type,
            machineType.Conveyor,
            machine.Length);

        return CheckLayout(floor, placement, Array.Empty<LayoutMachinePlacement>());
    }

    internal (bool CanPlace, string? Code) CheckLayout(
        LayoutFloor floor,
        LayoutMachinePlacement machine,
        IReadOnlyCollection<LayoutMachinePlacement>? otherMachines = null)
    {
        floor = NormalizeFloorOutline(floor);
        var placements = new[] { machine }
            .Concat(otherMachines ?? Array.Empty<LayoutMachinePlacement>())
            .ToArray();
        if (!IsValidFloor(floor) || placements.Any(placement => !IsValidMachine(placement)) ||
            placements.Select(placement => placement.Id).Distinct(StringComparer.OrdinalIgnoreCase).Count() != placements.Length)
        {
            return (false, "INVALID_INPUT");
        }

        var conveyorConnections = BuildConveyorConnections(placements);
        var body = BodyRectangle(machine);
        if (!RectangleInsideFloor(body, floor))
        {
            return (false, "OUTSIDE_HALL");
        }

        var clearance = ClearanceRectangle(machine);
        if (!RectangleInsideFloor(clearance, floor))
        {
            return (false, "OUTSIDE_CLEARANCE");
        }

        foreach (var other in otherMachines ?? Array.Empty<LayoutMachinePlacement>())
        {
            var otherBody = BodyRectangle(other);
            if (RectanglesOverlap(body, otherBody))
            {
                return (false, "MACHINE_OVERLAP");
            }

            if (conveyorConnections.AreClearanceExempt(machine, other))
            {
                continue;
            }

            if (RectanglesOverlap(body, ClearanceRectangle(other)) ||
                RectanglesOverlap(otherBody, clearance))
            {
                return (false, "CLEARANCE_BLOCKED");
            }
        }

        return (true, null);
    }

    private static LayoutFloor NormalizeFloorOutline(LayoutFloor floor)
    {
        if (floor.Outline is not { Count: > 3 } outline ||
            !SamePoint(outline[0], outline[^1]))
        {
            return floor;
        }

        return floor with { Outline = outline.Take(outline.Count - 1).ToArray() };
    }

    private static bool IsValidFloor(LayoutFloor floor)
    {
        if (!double.IsFinite(floor.WidthMm) || floor.WidthMm <= 0 ||
            !double.IsFinite(floor.DepthMm) || floor.DepthMm <= 0)
        {
            return false;
        }

        if (floor.Outline is null)
        {
            return true;
        }

        var outline = floor.Outline;
        return outline.Count >= 3 &&
            outline.All(point =>
                double.IsFinite(point.X) && double.IsFinite(point.Y) &&
                point.X >= 0 && point.X <= floor.WidthMm &&
                point.Y >= 0 && point.Y <= floor.DepthMm) &&
            HasThreeDistinctPoints(outline) &&
            HasNonZeroArea(outline) &&
            IsSimplePolygon(outline);
    }

    private static bool HasThreeDistinctPoints(IReadOnlyList<LayoutPoint> points)
    {
        var distinct = new List<LayoutPoint>();
        foreach (var point in points)
        {
            if (distinct.All(existing => !SamePoint(point, existing)))
            {
                distinct.Add(point);
            }
        }

        return distinct.Count >= 3;
    }

    private static bool SamePoint(LayoutPoint a, LayoutPoint b) =>
        Math.Abs(a.X - b.X) <= GeometryToleranceMm &&
        Math.Abs(a.Y - b.Y) <= GeometryToleranceMm;

    private static bool HasNonZeroArea(IReadOnlyList<LayoutPoint> points)
    {
        var twiceArea = 0d;
        for (var i = 0; i < points.Count; i++)
        {
            var next = points[(i + 1) % points.Count];
            twiceArea += points[i].X * next.Y - next.X * points[i].Y;
        }

        return double.IsFinite(twiceArea) && Math.Abs(twiceArea) > GeometryToleranceMm;
    }

    private static bool IsSimplePolygon(IReadOnlyList<LayoutPoint> points)
    {
        for (var i = 0; i < points.Count; i++)
        {
            var a = points[i];
            var b = points[(i + 1) % points.Count];
            if (SamePoint(a, b))
            {
                return false;
            }

            for (var j = i + 1; j < points.Count; j++)
            {
                var adjacent = j == i + 1 || (i == 0 && j == points.Count - 1);
                var c = points[j];
                var d = points[(j + 1) % points.Count];
                if (adjacent)
                {
                    var firstNonShared = j == i + 1 ? a : b;
                    var secondNonShared = j == i + 1 ? d : c;
                    if (PointOnSegment(firstNonShared, c, d) || PointOnSegment(secondNonShared, a, b))
                    {
                        return false;
                    }
                }
                else if (SegmentsIntersect(a, b, c, d))
                {
                    return false;
                }
            }
        }

        return true;
    }

    private static bool SegmentsIntersect(LayoutPoint a, LayoutPoint b, LayoutPoint c, LayoutPoint d)
    {
        var abC = Orientation(a, b, c);
        var abD = Orientation(a, b, d);
        var cdA = Orientation(c, d, a);
        var cdB = Orientation(c, d, b);
        if (abC * abD < 0 && cdA * cdB < 0)
        {
            return true;
        }

        return (abC == 0 && PointOnSegment(c, a, b)) ||
            (abD == 0 && PointOnSegment(d, a, b)) ||
            (cdA == 0 && PointOnSegment(a, c, d)) ||
            (cdB == 0 && PointOnSegment(b, c, d));
    }

    private static int Orientation(LayoutPoint a, LayoutPoint b, LayoutPoint c)
    {
        var cross = (b.X - a.X) * (c.Y - a.Y) - (b.Y - a.Y) * (c.X - a.X);
        var scale = Math.Max(1, Math.Sqrt(
            (b.X - a.X) * (b.X - a.X) + (b.Y - a.Y) * (b.Y - a.Y)));
        if (Math.Abs(cross) <= GeometryToleranceMm * scale)
        {
            return 0;
        }

        return Math.Sign(cross);
    }

    private static bool PointOnSegment(LayoutPoint point, LayoutPoint a, LayoutPoint b) =>
        DistanceToSegment(point, a, b) <= GeometryToleranceMm;

    private static bool IsValidMachine(LayoutMachinePlacement machine)
    {
        if (string.IsNullOrWhiteSpace(machine.Id) ||
            !double.IsFinite(machine.Xmm) || !double.IsFinite(machine.Ymm) ||
            !double.IsFinite(machine.RotationDegrees) ||
            machine.RotationDegrees < 0 || machine.RotationDegrees >= 360 ||
            !double.IsFinite(machine.Type.WidthMm) || machine.Type.WidthMm <= 0 ||
            !double.IsFinite(machine.Type.DepthMm) || machine.Type.DepthMm <= 0 ||
            machine.ConveyorKind is not (null or "straight" or "corner-left" or "corner-right") ||
            (machine.LengthMm is not null &&
                (!double.IsFinite(machine.LengthMm.Value) || machine.LengthMm.Value <= 0)) ||
            !IsValidClearance(machine.Type.Clearance))
        {
            return false;
        }

        var clearance = machine.Type.Clearance;
        return double.IsFinite(FootprintWidth(machine) + clearance.LeftMm + clearance.RightMm) &&
            double.IsFinite(machine.Type.DepthMm + clearance.FrontMm + clearance.BackMm);
    }

    private static bool IsValidClearance(LayoutClearance clearance) =>
        double.IsFinite(clearance.FrontMm) && clearance.FrontMm >= 0 &&
        double.IsFinite(clearance.BackMm) && clearance.BackMm >= 0 &&
        double.IsFinite(clearance.LeftMm) && clearance.LeftMm >= 0 &&
        double.IsFinite(clearance.RightMm) && clearance.RightMm >= 0;

    private static OrientedRectangle BodyRectangle(LayoutMachinePlacement machine) =>
        new(machine.Xmm, machine.Ymm, FootprintWidth(machine), machine.Type.DepthMm, machine.RotationDegrees);

    private static OrientedRectangle ClearanceRectangle(LayoutMachinePlacement machine)
    {
        var (cos, sin) = RotationComponents(machine.RotationDegrees);
        var clearance = machine.Type.Clearance;
        var offsetX = (clearance.RightMm - clearance.LeftMm) / 2;
        var offsetY = (clearance.FrontMm - clearance.BackMm) / 2;
        var centerX = machine.Xmm + cos * offsetX - sin * offsetY;
        var centerY = machine.Ymm + sin * offsetX + cos * offsetY;
        return new OrientedRectangle(
            centerX,
            centerY,
            FootprintWidth(machine) + clearance.LeftMm + clearance.RightMm,
            machine.Type.DepthMm + clearance.FrontMm + clearance.BackMm,
            machine.RotationDegrees);
    }

    private static double FootprintWidth(LayoutMachinePlacement machine) =>
        machine.ConveyorKind == "straight" && machine.LengthMm.HasValue
            ? machine.LengthMm.Value
            : machine.Type.WidthMm;

    private static (double Cos, double Sin) RotationComponents(double rotationDegrees)
    {
        var radians = rotationDegrees * Math.PI / 180;
        var cos = Math.Cos(radians);
        var sin = Math.Sin(radians);
        if (Math.Abs(cos) <= 1e-12)
        {
            cos = 0;
        }
        else if (Math.Abs(Math.Abs(cos) - 1) <= 1e-12)
        {
            cos = Math.Sign(cos);
        }

        if (Math.Abs(sin) <= 1e-12)
        {
            sin = 0;
        }
        else if (Math.Abs(Math.Abs(sin) - 1) <= 1e-12)
        {
            sin = Math.Sign(sin);
        }

        return (cos, sin);
    }

    private static ConveyorConnections BuildConveyorConnections(IReadOnlyCollection<LayoutMachinePlacement> machines)
    {
        var conveyorPorts = machines
            .Where(machine => machine.ConveyorKind is not null)
            .ToDictionary(machine => machine.Id, CreateConveyorPorts, StringComparer.OrdinalIgnoreCase);
        var parent = conveyorPorts.Keys.ToDictionary(id => id, id => id, StringComparer.OrdinalIgnoreCase);

        string Root(string id)
        {
            var current = parent[id];
            if (!StringComparer.OrdinalIgnoreCase.Equals(current, id))
            {
                parent[id] = Root(current);
            }

            return parent[id];
        }

        foreach (var from in conveyorPorts)
        {
            foreach (var to in conveyorPorts)
            {
                if (!StringComparer.OrdinalIgnoreCase.Equals(from.Key, to.Key) &&
                    Joined(from.Value.Out, to.Value.In))
                {
                    parent[Root(from.Key)] = Root(to.Key);
                }
            }
        }

        var runByMachine = conveyorPorts.Keys.ToDictionary(id => id, Root, StringComparer.OrdinalIgnoreCase);
        var linkedPairs = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        var machineFronts = machines
            .Where(machine => machine.ConveyorKind is null)
            .ToDictionary(machine => machine.Id, CreateMachineFront, StringComparer.OrdinalIgnoreCase);
        foreach (var conveyor in conveyorPorts)
        {
            foreach (var front in machineFronts)
            {
                if (Joined(front.Value.Out, conveyor.Value.In) ||
                    Joined(conveyor.Value.Out, front.Value.In))
                {
                    linkedPairs.Add(PairKey(conveyor.Key, front.Key));
                }
            }
        }

        return new ConveyorConnections(runByMachine, linkedPairs);
    }

    private static ConveyorPorts CreateConveyorPorts(LayoutMachinePlacement machine)
    {
        var half = FootprintWidth(machine) / 2;
        var local = machine.ConveyorKind switch
        {
            "straight" => new ConveyorPorts(
                new LayoutPort(new LayoutPoint(-half, 0), new LayoutPoint(1, 0)),
                new LayoutPort(new LayoutPoint(half, 0), new LayoutPoint(1, 0))),
            "corner-right" => new ConveyorPorts(
                new LayoutPort(new LayoutPoint(-half, 0), new LayoutPoint(1, 0)),
                new LayoutPort(new LayoutPoint(0, half), new LayoutPoint(0, 1))),
            "corner-left" => new ConveyorPorts(
                new LayoutPort(new LayoutPoint(-half, 0), new LayoutPoint(1, 0)),
                new LayoutPort(new LayoutPoint(0, -half), new LayoutPoint(0, -1))),
            _ => throw new InvalidOperationException($"Unsupported conveyor kind '{machine.ConveyorKind}'.")
        };

        return new ConveyorPorts(Place(local.In), Place(local.Out));

        LayoutPort Place(LayoutPort port)
        {
            var point = Rotate(port.Point, machine.RotationDegrees);
            return new LayoutPort(
                new LayoutPoint(machine.Xmm + point.X, machine.Ymm + point.Y),
                Rotate(port.Direction, machine.RotationDegrees));
        }
    }

    private static ConveyorPorts CreateMachineFront(LayoutMachinePlacement machine)
    {
        var frontOffset = Rotate(new LayoutPoint(0, machine.Type.DepthMm / 2), machine.RotationDegrees);
        var direction = Rotate(new LayoutPoint(0, 1), machine.RotationDegrees);
        var front = new LayoutPoint(machine.Xmm + frontOffset.X, machine.Ymm + frontOffset.Y);
        return new ConveyorPorts(
            new LayoutPort(front, direction),
            new LayoutPort(front, new LayoutPoint(-direction.X, -direction.Y)));
    }

    private static LayoutPoint Rotate(LayoutPoint point, double rotationDegrees)
    {
        var (cos, sin) = RotationComponents(rotationDegrees);
        return new LayoutPoint(cos * point.X - sin * point.Y, sin * point.X + cos * point.Y);
    }

    private static bool Joined(LayoutPort output, LayoutPort input) =>
        output.Direction.X == input.Direction.X &&
        output.Direction.Y == input.Direction.Y &&
        Math.Pow(output.Point.X - input.Point.X, 2) + Math.Pow(output.Point.Y - input.Point.Y, 2) <= 1;

    private static string PairKey(string a, string b) =>
        StringComparer.OrdinalIgnoreCase.Compare(a, b) < 0 ? $"{a}|{b}" : $"{b}|{a}";

    private static LayoutPoint[] RectangleCorners(OrientedRectangle rectangle)
    {
        var (cos, sin) = RotationComponents(rectangle.RotationDegrees);
        var halfWidthX = cos * rectangle.WidthMm / 2;
        var halfWidthY = sin * rectangle.WidthMm / 2;
        var halfDepthX = -sin * rectangle.DepthMm / 2;
        var halfDepthY = cos * rectangle.DepthMm / 2;
        return
        [
            new LayoutPoint(rectangle.CenterX - halfWidthX - halfDepthX, rectangle.CenterY - halfWidthY - halfDepthY),
            new LayoutPoint(rectangle.CenterX + halfWidthX - halfDepthX, rectangle.CenterY + halfWidthY - halfDepthY),
            new LayoutPoint(rectangle.CenterX + halfWidthX + halfDepthX, rectangle.CenterY + halfWidthY + halfDepthY),
            new LayoutPoint(rectangle.CenterX - halfWidthX + halfDepthX, rectangle.CenterY - halfWidthY + halfDepthY)
        ];
    }

    private static bool RectanglesOverlap(OrientedRectangle a, OrientedRectangle b)
    {
        var aCorners = RectangleCorners(a);
        var bCorners = RectangleCorners(b);
        return !HasSeparatingAxis(aCorners, bCorners, a.RotationDegrees) &&
            !HasSeparatingAxis(aCorners, bCorners, a.RotationDegrees + 90) &&
            !HasSeparatingAxis(aCorners, bCorners, b.RotationDegrees) &&
            !HasSeparatingAxis(aCorners, bCorners, b.RotationDegrees + 90);
    }

    private static bool HasSeparatingAxis(
        IReadOnlyList<LayoutPoint> a,
        IReadOnlyList<LayoutPoint> b,
        double axisDegrees)
    {
        var (cos, sin) = RotationComponents(axisDegrees);
        var axis = new LayoutPoint(cos, sin);
        Project(a, axis, out var aMin, out var aMax);
        Project(b, axis, out var bMin, out var bMax);
        return aMax <= bMin + GeometryToleranceMm || bMax <= aMin + GeometryToleranceMm;
    }

    private static void Project(
        IReadOnlyList<LayoutPoint> points,
        LayoutPoint axis,
        out double min,
        out double max)
    {
        min = max = points[0].X * axis.X + points[0].Y * axis.Y;
        for (var i = 1; i < points.Count; i++)
        {
            var projection = points[i].X * axis.X + points[i].Y * axis.Y;
            min = Math.Min(min, projection);
            max = Math.Max(max, projection);
        }
    }

    private static bool RectangleInsideFloor(OrientedRectangle rectangle, LayoutFloor floor)
    {
        var outline = floor.Outline ??
        [
            new LayoutPoint(0, 0),
            new LayoutPoint(floor.WidthMm, 0),
            new LayoutPoint(floor.WidthMm, floor.DepthMm),
            new LayoutPoint(0, floor.DepthMm)
        ];
        var corners = RectangleCorners(rectangle);
        if (corners.Any(corner => !PointInFloor(corner, outline)))
        {
            return false;
        }

        if (outline.Any(point => PointStrictlyInsideRectangle(point, rectangle)))
        {
            return false;
        }

        for (var i = 0; i < outline.Count; i++)
        {
            if (SegmentCrossesRectangleInterior(outline[i], outline[(i + 1) % outline.Count], rectangle))
            {
                return false;
            }
        }

        return true;
    }

    private static bool PointStrictlyInsideRectangle(LayoutPoint point, OrientedRectangle rectangle)
    {
        var (cos, sin) = RotationComponents(rectangle.RotationDegrees);
        var dx = point.X - rectangle.CenterX;
        var dy = point.Y - rectangle.CenterY;
        var localX = dx * cos + dy * sin;
        var localY = -dx * sin + dy * cos;
        return Math.Abs(localX) < rectangle.WidthMm / 2 - GeometryToleranceMm &&
            Math.Abs(localY) < rectangle.DepthMm / 2 - GeometryToleranceMm;
    }

    private static bool SegmentCrossesRectangleInterior(
        LayoutPoint start,
        LayoutPoint end,
        OrientedRectangle rectangle)
    {
        var (cos, sin) = RotationComponents(rectangle.RotationDegrees);
        LayoutPoint ToLocal(LayoutPoint point)
        {
            var dx = point.X - rectangle.CenterX;
            var dy = point.Y - rectangle.CenterY;
            return new LayoutPoint(dx * cos + dy * sin, -dx * sin + dy * cos);
        }

        var a = ToLocal(start);
        var b = ToLocal(end);
        var minX = -rectangle.WidthMm / 2 + GeometryToleranceMm;
        var maxX = rectangle.WidthMm / 2 - GeometryToleranceMm;
        var minY = -rectangle.DepthMm / 2 + GeometryToleranceMm;
        var maxY = rectangle.DepthMm / 2 - GeometryToleranceMm;
        if (minX >= maxX || minY >= maxY)
        {
            return false;
        }

        var dx = b.X - a.X;
        var dy = b.Y - a.Y;
        var tMin = 0d;
        var tMax = 1d;
        return Clip(-dx, a.X - minX, ref tMin, ref tMax) &&
            Clip(dx, maxX - a.X, ref tMin, ref tMax) &&
            Clip(-dy, a.Y - minY, ref tMin, ref tMax) &&
            Clip(dy, maxY - a.Y, ref tMin, ref tMax) &&
            tMin < tMax;
    }

    private static bool Clip(double p, double q, ref double tMin, ref double tMax)
    {
        if (p == 0)
        {
            return q >= 0;
        }

        var t = q / p;
        if (p < 0)
        {
            if (t > tMax) return false;
            tMin = Math.Max(tMin, t);
        }
        else
        {
            if (t < tMin) return false;
            tMax = Math.Min(tMax, t);
        }

        return true;
    }

    private static bool PointInFloor(LayoutPoint point, IReadOnlyList<LayoutPoint> outline)
    {
        var inside = false;
        for (var i = 0; i < outline.Count; i++)
        {
            var a = outline[i];
            var b = outline[(i + 1) % outline.Count];
            if (DistanceToSegment(point, a, b) <= GeometryToleranceMm)
            {
                return true;
            }

            if ((a.Y > point.Y) != (b.Y > point.Y))
            {
                var crossingX = a.X + (point.Y - a.Y) * (b.X - a.X) / (b.Y - a.Y);
                if (point.X < crossingX)
                {
                    inside = !inside;
                }
            }
        }

        return inside;
    }

    private static double DistanceToSegment(LayoutPoint point, LayoutPoint a, LayoutPoint b)
    {
        var dx = b.X - a.X;
        var dy = b.Y - a.Y;
        var lengthSquared = dx * dx + dy * dy;
        var t = lengthSquared == 0
            ? 0
            : Math.Clamp(((point.X - a.X) * dx + (point.Y - a.Y) * dy) / lengthSquared, 0, 1);
        var distanceX = Math.Abs(point.X - (a.X + t * dx));
        var distanceY = Math.Abs(point.Y - (a.Y + t * dy));
        var scale = Math.Max(distanceX, distanceY);
        if (scale == 0)
        {
            return 0;
        }

        var ratio = Math.Min(distanceX, distanceY) / scale;
        return scale * Math.Sqrt(1 + ratio * ratio);
    }

    private sealed record LayoutPort(LayoutPoint Point, LayoutPoint Direction);

    private sealed record ConveyorPorts(LayoutPort In, LayoutPort Out);

    private sealed record OrientedRectangle(
        double CenterX,
        double CenterY,
        double WidthMm,
        double DepthMm,
        double RotationDegrees);

    private sealed record ConveyorConnections(
        IReadOnlyDictionary<string, string> RunByMachine,
        IReadOnlySet<string> LinkedPairs)
    {
        public bool AreClearanceExempt(LayoutMachinePlacement a, LayoutMachinePlacement b)
        {
            var sameRun = a.ConveyorKind is not null && b.ConveyorKind is not null &&
                RunByMachine.TryGetValue(a.Id, out var aRun) &&
                RunByMachine.TryGetValue(b.Id, out var bRun) &&
                StringComparer.OrdinalIgnoreCase.Equals(aRun, bRun);
            return sameRun || LinkedPairs.Contains(PairKey(a.Id, b.Id));
        }
    }
}
