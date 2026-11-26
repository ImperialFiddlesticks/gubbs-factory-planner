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
        var placements = new[] { machine }
            .Concat(otherMachines ?? Array.Empty<LayoutMachinePlacement>())
            .ToArray();
        if (!IsValidFloor(floor) || placements.Any(placement => !IsValidMachine(placement)) ||
            placements.Select(placement => placement.Id).Distinct(StringComparer.OrdinalIgnoreCase).Count() != placements.Length)
        {
            return (false, "INVALID_INPUT");
        }

        var conveyorConnections = BuildConveyorConnections(placements);
        var body = BodyBox(machine);
        if (!BoxInsideFloor(body, floor))
        {
            return (false, "OUTSIDE_HALL");
        }

        var clearance = ClearanceBox(machine);
        if (!BoxInsideFloor(clearance, floor))
        {
            return (false, "OUTSIDE_CLEARANCE");
        }

        foreach (var other in otherMachines ?? Array.Empty<LayoutMachinePlacement>())
        {
            var otherBody = BodyBox(other);
            if (BoxesOverlap(body, otherBody))
            {
                return (false, "MACHINE_OVERLAP");
            }

            if (conveyorConnections.AreClearanceExempt(machine, other))
            {
                continue;
            }

            if (BoxesOverlap(body, ClearanceBox(other)) || BoxesOverlap(otherBody, clearance))
            {
                return (false, "CLEARANCE_BLOCKED");
            }
        }

        return (true, null);
    }

    private static bool IsValidFloor(LayoutFloor floor) =>
        double.IsFinite(floor.WidthMm) && floor.WidthMm > 0 &&
        double.IsFinite(floor.DepthMm) && floor.DepthMm > 0 &&
        (floor.Outline is null ||
            (floor.Outline.Count >= 3 && floor.Outline.All(point =>
                double.IsFinite(point.X) && double.IsFinite(point.Y))));

    private static bool IsValidMachine(LayoutMachinePlacement machine) =>
        !string.IsNullOrWhiteSpace(machine.Id) &&
        double.IsFinite(machine.Xmm) && double.IsFinite(machine.Ymm) &&
        double.IsFinite(machine.RotationDegrees) &&
        double.IsFinite(machine.Type.WidthMm) && machine.Type.WidthMm > 0 &&
        double.IsFinite(machine.Type.DepthMm) && machine.Type.DepthMm > 0 &&
        (machine.ConveyorKind is null or "straight" or "corner-left" or "corner-right") &&
        (machine.LengthMm is null || double.IsFinite(machine.LengthMm.Value) && machine.LengthMm.Value > 0) &&
        IsValidClearance(machine.Type.Clearance);

    private static bool IsValidClearance(LayoutClearance clearance) =>
        double.IsFinite(clearance.FrontMm) && clearance.FrontMm >= 0 &&
        double.IsFinite(clearance.BackMm) && clearance.BackMm >= 0 &&
        double.IsFinite(clearance.LeftMm) && clearance.LeftMm >= 0 &&
        double.IsFinite(clearance.RightMm) && clearance.RightMm >= 0;

    private static LayoutBox BodyBox(LayoutMachinePlacement machine)
    {
        var (width, depth) = RotatedSize(FootprintWidth(machine), machine.Type.DepthMm, machine.RotationDegrees);
        return new LayoutBox(machine.Xmm - width / 2, machine.Ymm - depth / 2, width, depth);
    }

    private static LayoutBox ClearanceBox(LayoutMachinePlacement machine)
    {
        var (cos, sin) = RotationComponents(machine.RotationDegrees);
        var clearance = machine.Type.Clearance;
        var outerWidth = FootprintWidth(machine) + clearance.LeftMm + clearance.RightMm;
        var outerDepth = machine.Type.DepthMm + clearance.FrontMm + clearance.BackMm;
        var localOffsetX = (clearance.RightMm - clearance.LeftMm) / 2;
        var localOffsetY = (clearance.FrontMm - clearance.BackMm) / 2;
        var centerX = machine.Xmm + cos * localOffsetX - sin * localOffsetY;
        var centerY = machine.Ymm + sin * localOffsetX + cos * localOffsetY;
        var (width, depth) = RotatedSize(outerWidth, outerDepth, machine.RotationDegrees);

        return new LayoutBox(centerX - width / 2, centerY - depth / 2, width, depth);
    }

    private static double FootprintWidth(LayoutMachinePlacement machine) =>
        machine.ConveyorKind == "straight" && machine.LengthMm.HasValue
            ? machine.LengthMm.Value
            : machine.Type.WidthMm;

    private static (double Width, double Depth) RotatedSize(double width, double depth, double rotationDegrees)
    {
        var (cos, sin) = RotationComponents(rotationDegrees);
        cos = Math.Abs(cos);
        sin = Math.Abs(sin);
        return (cos * width + sin * depth, sin * width + cos * depth);
    }

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

    private static bool BoxesOverlap(LayoutBox a, LayoutBox b) =>
        a.X < b.X + b.Width && b.X < a.X + a.Width &&
        a.Y < b.Y + b.Depth && b.Y < a.Y + a.Depth;

    private static bool BoxInsideFloor(LayoutBox box, LayoutFloor floor)
    {
        if (floor.Outline is null)
        {
            return box.X >= 0 &&
                box.Y >= 0 &&
                box.X + box.Width <= floor.WidthMm &&
                box.Y + box.Depth <= floor.DepthMm;
        }

        var corners = new[]
        {
            new LayoutPoint(box.X, box.Y),
            new LayoutPoint(box.X + box.Width, box.Y),
            new LayoutPoint(box.X + box.Width, box.Y + box.Depth),
            new LayoutPoint(box.X, box.Y + box.Depth)
        };
        if (corners.Any(corner => !PointInFloor(corner, floor.Outline)))
        {
            return false;
        }

        return !floor.Outline.Any(point =>
            point.X > box.X + GeometryToleranceMm &&
            point.X < box.X + box.Width - GeometryToleranceMm &&
            point.Y > box.Y + GeometryToleranceMm &&
            point.Y < box.Y + box.Depth - GeometryToleranceMm);
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

    private sealed record LayoutBox(double X, double Y, double Width, double Depth);
}
