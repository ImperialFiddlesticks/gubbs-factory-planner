using System;
using System.Collections.Generic;
using System.Linq;

internal enum UtilityPointKind
{
    Power,
    Water,
    Sprinkler,
    Extinguisher,
    Exit
}

internal sealed record UtilityPoint(
    string Id,
    UtilityPointKind Kind,
    double Xmm,
    double Ymm,
    double? RadiusMm = null,
    double? CapacityKw = null);

internal sealed record UtilityValidationIssue(
    string Code,
    IReadOnlyList<Guid> MachineIds,
    string? UtilityId,
    string Message);

internal sealed class UtilityValidationService
{
    private const double ConveyorKilowattsPerMetre = 0.25;
    private const double ConveyorJoinToleranceMm = 1;
    private const double DirectionTolerance = 1e-6;

    /// <summary>
    /// Assigns power and water to the nearest source, checks sprinkler reach, and validates
    /// assigned power capacity. Wall blocking and walking-distance checks are intentionally
    /// deferred to a later milestone.
    /// </summary>
    internal IReadOnlyList<UtilityValidationIssue> Validate(
        IReadOnlyList<MachineInstance> machines,
        IReadOnlyList<MachineType> machineTypes,
        IReadOnlyList<UtilityPoint> utilities)
    {
        ArgumentNullException.ThrowIfNull(machines);
        ArgumentNullException.ThrowIfNull(machineTypes);
        ArgumentNullException.ThrowIfNull(utilities);

        var issues = new List<UtilityValidationIssue>();
        var typesById = new Dictionary<Guid, MachineType>();
        foreach (var machineType in machineTypes)
        {
            ArgumentNullException.ThrowIfNull(machineType);
            if (!typesById.TryAdd(machineType.Id, machineType))
            {
                throw new ArgumentException(
                    $"More than one machine type has ID '{machineType.Id}'.",
                    nameof(machineTypes));
            }
        }

        var validUtilities = new List<UtilityPoint>();
        foreach (var utility in utilities)
        {
            ArgumentNullException.ThrowIfNull(utility);
            if (string.IsNullOrWhiteSpace(utility.Id) ||
                !double.IsFinite(utility.Xmm) || !double.IsFinite(utility.Ymm) ||
                (utility.RadiusMm is not null &&
                    (!double.IsFinite(utility.RadiusMm.Value) || utility.RadiusMm.Value < 0)) ||
                (utility.Kind == UtilityPointKind.Power && utility.CapacityKw is not null &&
                    (!double.IsFinite(utility.CapacityKw.Value) || utility.CapacityKw.Value < 0)))
            {
                issues.Add(new UtilityValidationIssue(
                    "INVALID_UTILITY",
                    Array.Empty<Guid>(),
                    utility.Id,
                    "Utility coordinates, radius, capacity, and ID must be valid."));
                continue;
            }

            validUtilities.Add(utility);
        }

        var resolved = new List<ResolvedMachine>();
        foreach (var machine in machines)
        {
            ArgumentNullException.ThrowIfNull(machine);
            if (!typesById.TryGetValue(machine.MachineTypeId, out var type))
            {
                issues.Add(new UtilityValidationIssue(
                    "MACHINE_TYPE_NOT_FOUND",
                    new[] { machine.Id },
                    null,
                    $"Machine type '{machine.MachineTypeId}' could not be resolved."));
                continue;
            }

            if (type.Conveyor is not (null or "straight" or "corner-left" or "corner-right"))
            {
                issues.Add(new UtilityValidationIssue(
                    "UNSUPPORTED_CONVEYOR_TYPE",
                    new[] { machine.Id },
                    null,
                    $"Conveyor type '{type.Conveyor}' is not supported."));
                continue;
            }

            if (!TryResolveGeometry(machine, type, out var placement))
            {
                issues.Add(new UtilityValidationIssue(
                    "INVALID_MACHINE_GEOMETRY",
                    new[] { machine.Id },
                    null,
                    "Machine dimensions, rotation, or conveyor length are invalid."));
                continue;
            }

            if (!double.IsFinite(type.PowerKw) || type.PowerKw < 0)
            {
                issues.Add(new UtilityValidationIssue(
                    "INVALID_POWER_DEMAND",
                    new[] { machine.Id },
                    null,
                    "Machine power demand must be finite and nonnegative."));
            }

            resolved.Add(placement);
        }

        var conveyorRuns = BuildConveyorRuns(resolved);
        var powerLoads = new Dictionary<string, double>(StringComparer.Ordinal);
        var poweredMachineIdsByUtility = new Dictionary<string, List<Guid>>(StringComparer.Ordinal);

        foreach (var machine in resolved)
        {
            if (machine.Type.Conveyor is not null ||
                !double.IsFinite(machine.Type.PowerKw) || machine.Type.PowerKw <= 0)
            {
                continue;
            }

            var nearest = NearestUtility(machine, validUtilities, UtilityPointKind.Power);
            if (nearest is null)
            {
                issues.Add(new UtilityValidationIssue(
                    "POWER_OUT_OF_REACH",
                    new[] { machine.Machine.Id },
                    null,
                    "Machine has no power point to connect to."));
                continue;
            }

            AssignLoad(nearest.Utility, machine.Type.PowerKw, new[] { machine.Machine.Id }, powerLoads, poweredMachineIdsByUtility);
        }

        foreach (var run in conveyorRuns)
        {
            if (run.PowerKw <= 0)
            {
                continue;
            }

            var nearest = run.Machines
                .Select(machine => (Machine: machine, Utility: NearestUtility(machine, validUtilities, UtilityPointKind.Power)))
                .Where(candidate => candidate.Utility is not null)
                .OrderBy(candidate => candidate.Utility!.DistanceMm)
                .FirstOrDefault();
            if (nearest.Utility is null)
            {
                issues.Add(new UtilityValidationIssue(
                    "POWER_OUT_OF_REACH",
                    run.Machines.Select(machine => machine.Machine.Id).ToArray(),
                    null,
                    "Conveyor run has no power point to connect to."));
                continue;
            }

            AssignLoad(
                nearest.Utility.Utility,
                run.PowerKw,
                run.Machines.Select(machine => machine.Machine.Id),
                powerLoads,
                poweredMachineIdsByUtility);
        }

        foreach (var machine in resolved)
        {
            if (machine.Type.NeedsWater &&
                NearestUtility(machine, validUtilities, UtilityPointKind.Water) is null)
            {
                issues.Add(new UtilityValidationIssue(
                    "WATER_OUT_OF_REACH",
                    new[] { machine.Machine.Id },
                    null,
                    "Machine has no water point to connect to."));
            }

            if (machine.Type.NeedsFireSuppression &&
                NearestUtility(machine, validUtilities, UtilityPointKind.Sprinkler) is null)
            {
                issues.Add(new UtilityValidationIssue(
                    "SPRINKLER_OUT_OF_REACH",
                    new[] { machine.Machine.Id },
                    null,
                    "Machine is not covered by a sprinkler."));
            }
        }

        foreach (var utility in validUtilities)
        {
            if (utility.Kind != UtilityPointKind.Power || utility.CapacityKw is not double capacityKw)
            {
                continue;
            }

            var assignedLoadKw = powerLoads.GetValueOrDefault(utility.Id);
            if (assignedLoadKw > capacityKw)
            {
                var machineIds = poweredMachineIdsByUtility.GetValueOrDefault(utility.Id) ?? new List<Guid>();
                issues.Add(new UtilityValidationIssue(
                    "POWER_CAPACITY_EXCEEDED",
                    machineIds,
                    utility.Id,
                    $"Power point overloaded: {assignedLoadKw:0.##} of {capacityKw:0.##} kW."));
            }
        }

        return issues;
    }

    private static bool TryResolveGeometry(
        MachineInstance machine,
        MachineType type,
        out ResolvedMachine resolved)
    {
        var width = type.Conveyor == "straight" && machine.Length.HasValue
            ? machine.Length.Value
            : type.WidthMm;
        if (!double.IsFinite(width) || width <= 0 || type.DepthMm <= 0 ||
            !double.IsFinite(machine.RotationDegrees) ||
            machine.RotationDegrees < 0 || machine.RotationDegrees >= 360 ||
            (machine.Length.HasValue && (!double.IsFinite(machine.Length.Value) || machine.Length.Value <= 0)))
        {
            resolved = null!;
            return false;
        }

        resolved = new ResolvedMachine(machine, type, width, type.DepthMm);
        return true;
    }

    private static UtilityCandidate? NearestUtility(
        ResolvedMachine machine,
        IReadOnlyList<UtilityPoint> utilities,
        UtilityPointKind kind)
    {
        UtilityCandidate? nearest = null;
        foreach (var utility in utilities)
        {
            if (utility.Kind != kind)
            {
                continue;
            }

            var distance = DistanceToMachine(utility.Xmm, utility.Ymm, machine);
            var withinCoverage = kind != UtilityPointKind.Sprinkler || distance <= (utility.RadiusMm ?? DefaultRadiusMm(kind));
            if (withinCoverage && (nearest is null || distance < nearest.DistanceMm))
            {
                nearest = new UtilityCandidate(utility, distance);
            }
        }

        return nearest;
    }

    private static double DefaultRadiusMm(UtilityPointKind kind) => kind switch
    {
        UtilityPointKind.Sprinkler => 3000,
        _ => 0
    };

    private static double DistanceToMachine(double x, double y, ResolvedMachine machine)
    {
        var radians = machine.Machine.RotationDegrees * Math.PI / 180;
        var cos = Math.Cos(radians);
        var sin = Math.Sin(radians);
        var dx = x - machine.Machine.Xmm;
        var dy = y - machine.Machine.Ymm;
        var localX = dx * cos + dy * sin;
        var localY = -dx * sin + dy * cos;
        var distanceX = Math.Max(Math.Abs(localX) - machine.WidthMm / 2, 0);
        var distanceY = Math.Max(Math.Abs(localY) - machine.DepthMm / 2, 0);
        return Math.Sqrt(distanceX * distanceX + distanceY * distanceY);
    }

    private static void AssignLoad(
        UtilityPoint utility,
        double powerKw,
        IEnumerable<Guid> machineIds,
        IDictionary<string, double> powerLoads,
        IDictionary<string, List<Guid>> poweredMachineIdsByUtility)
    {
        powerLoads.TryGetValue(utility.Id, out var currentLoad);
        var roundedLoad = Math.Floor((currentLoad + powerKw) * 100 + 0.5) / 100;
        powerLoads[utility.Id] = roundedLoad;
        if (!poweredMachineIdsByUtility.TryGetValue(utility.Id, out var assignedMachines))
        {
            assignedMachines = new List<Guid>();
            poweredMachineIdsByUtility.Add(utility.Id, assignedMachines);
        }

        assignedMachines.AddRange(machineIds);
    }

    private static IReadOnlyList<ConveyorRun> BuildConveyorRuns(IReadOnlyList<ResolvedMachine> machines)
    {
        var conveyors = machines.Where(machine => machine.Type.Conveyor is not null).ToArray();
        var ports = conveyors.ToDictionary(machine => machine.Machine.Id, CreateConveyorPorts);
        var parent = conveyors.ToDictionary(machine => machine.Machine.Id, machine => machine.Machine.Id);

        Guid Root(Guid id)
        {
            var current = parent[id];
            if (current != id)
            {
                parent[id] = Root(current);
            }

            return parent[id];
        }

        foreach (var from in conveyors)
        {
            foreach (var to in conveyors)
            {
                if (from.Machine.Id != to.Machine.Id && Joined(ports[from.Machine.Id].Out, ports[to.Machine.Id].In))
                {
                    parent[Root(from.Machine.Id)] = Root(to.Machine.Id);
                }
            }
        }

        return conveyors
            .GroupBy(machine => Root(machine.Machine.Id))
            .Select(group =>
            {
                var members = group.ToArray();
                var totalLengthMm = members.Sum(machine => machine.WidthMm);
                var runPowerKw = Math.Floor(ConveyorKilowattsPerMetre * totalLengthMm / 1000 * 100 + 0.5) / 100;
                return new ConveyorRun(members, runPowerKw);
            })
            .ToArray();
    }

    private static ConveyorPorts CreateConveyorPorts(ResolvedMachine machine)
    {
        var halfWidth = machine.WidthMm / 2;
        var localPorts = machine.Type.Conveyor switch
        {
            "straight" => new ConveyorPorts(
                new Port(new Vector(-halfWidth, 0), new Vector(1, 0)),
                new Port(new Vector(halfWidth, 0), new Vector(1, 0))),
            "corner-right" => new ConveyorPorts(
                new Port(new Vector(-halfWidth, 0), new Vector(1, 0)),
                new Port(new Vector(0, halfWidth), new Vector(0, 1))),
            "corner-left" => new ConveyorPorts(
                new Port(new Vector(-halfWidth, 0), new Vector(1, 0)),
                new Port(new Vector(0, -halfWidth), new Vector(0, -1))),
            _ => throw new InvalidOperationException($"Unsupported conveyor kind '{machine.Type.Conveyor}'.")
        };

        return new ConveyorPorts(Place(localPorts.In), Place(localPorts.Out));

        Port Place(Port port)
        {
            var rotatedPoint = Rotate(port.Point, machine.Machine.RotationDegrees);
            return new Port(
                new Vector(machine.Machine.Xmm + rotatedPoint.X, machine.Machine.Ymm + rotatedPoint.Y),
                Rotate(port.Direction, machine.Machine.RotationDegrees));
        }
    }

    private static bool Joined(Port output, Port input)
    {
        var sameDirection = Math.Abs(output.Direction.X - input.Direction.X) < DirectionTolerance &&
            Math.Abs(output.Direction.Y - input.Direction.Y) < DirectionTolerance;
        var dx = output.Point.X - input.Point.X;
        var dy = output.Point.Y - input.Point.Y;
        return sameDirection && dx * dx + dy * dy <= ConveyorJoinToleranceMm * ConveyorJoinToleranceMm;
    }

    private static Vector Rotate(Vector vector, double rotationDegrees)
    {
        var radians = rotationDegrees * Math.PI / 180;
        var cos = Math.Cos(radians);
        var sin = Math.Sin(radians);
        return new Vector(cos * vector.X - sin * vector.Y, sin * vector.X + cos * vector.Y);
    }

    private sealed record ResolvedMachine(
        MachineInstance Machine,
        MachineType Type,
        double WidthMm,
        double DepthMm);

    private sealed record UtilityCandidate(UtilityPoint Utility, double DistanceMm);

    private sealed record ConveyorRun(IReadOnlyList<ResolvedMachine> Machines, double PowerKw);

    private sealed record Vector(double X, double Y);

    private sealed record Port(Vector Point, Vector Direction);

    private sealed record ConveyorPorts(Port In, Port Out);
}
