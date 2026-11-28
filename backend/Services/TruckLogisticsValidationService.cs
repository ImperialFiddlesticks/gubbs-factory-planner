using System;
using System.Collections.Generic;
using System.Linq;

public sealed record TruckLogisticsValidationIssue(Guid? ItemId, string Field, string Message);

public sealed class TruckLogisticsValidationService
{
    private const double Epsilon = 1e-6;
    private const double CrossingToleranceMm = 250;

    private sealed record Segment(TruckLogisticsPoint A, TruckLogisticsPoint B);
    private sealed record Box(double X, double Y, double Width, double Depth, Guid Id, string Name);

    public IReadOnlyList<TruckLogisticsValidationIssue> Validate(TruckLogisticsLayout layout)
    {
        ArgumentNullException.ThrowIfNull(layout);
        var issues = new List<TruckLogisticsValidationIssue>();
        var trucks = layout.TruckTypes.ToDictionary(item => item.Id);

        foreach (var spot in layout.ParkingSpots)
        {
            if (string.IsNullOrWhiteSpace(spot.Name)) Add(issues, spot.Id, "Name", "Name must not be empty or whitespace.");
            ValidatePolygon(issues, spot.Id, "Outline", spot.Outline);
            foreach (var typeId in spot.CompatibleTruckTypeIds)
            {
                if (!trucks.TryGetValue(typeId, out var truck))
                {
                    Add(issues, spot.Id, "CompatibleTruckTypeIds", "The parking spot references an unknown forklift type.");
                    continue;
                }
                if (FinitePoints(spot.Outline) && spot.Outline.Count >= 3)
                {
                    if (truck.WidthMm is not > 0 || truck.LengthMm is not > 0)
                    {
                        Add(issues, spot.Id, "CompatibleTruckTypeIds", $"The parking area cannot be checked for {truck.Name} because its dimensions are unknown.");
                        continue;
                    }
                    var bounds = Bounds(spot.Outline);
                    var fits = bounds.Width + Epsilon >= truck.WidthMm.Value && bounds.Depth + Epsilon >= truck.LengthMm.Value ||
                        bounds.Width + Epsilon >= truck.LengthMm.Value && bounds.Depth + Epsilon >= truck.WidthMm.Value;
                    if (!fits) Add(issues, spot.Id, "Outline", $"The parking area may be too small for {truck.Name}.");
                }
            }
        }
        for (var first = 0; first < layout.ParkingSpots.Count; first++)
        for (var second = first + 1; second < layout.ParkingSpots.Count; second++)
        {
            var a = layout.ParkingSpots[first].Outline;
            var b = layout.ParkingSpots[second].Outline;
            if (a.Count >= 3 && b.Count >= 3 && FinitePoints(a) && FinitePoints(b) && PolygonOverlaps(a, b))
                Add(issues, layout.ParkingSpots[second].Id, "Outline", $"The parking area overlaps '{layout.ParkingSpots[first].Name}'.");
        }

        var powerLoads = new Dictionary<Guid, double>();
        foreach (var station in layout.ServiceStations)
        {
            if (!double.IsFinite(station.ServiceCapacity) || station.ServiceCapacity <= 0 || Math.Abs(station.ServiceCapacity - Math.Round(station.ServiceCapacity)) > Epsilon)
                Add(issues, station.Id, "ServiceCapacity", "Service capacity must be a positive whole number of simultaneous connections.");
            if (!double.IsFinite(station.Xmm) || !double.IsFinite(station.Ymm)) Add(issues, station.Id, "Position", "Station coordinates must be finite.");
            if (station.Kind == "charging" && string.IsNullOrWhiteSpace(station.ChargerType))
                Add(issues, station.Id, "ChargerType", "A charging station needs a configured charger type.");
            foreach (var typeId in station.CompatibleTruckTypeIds)
            {
                if (!trucks.TryGetValue(typeId, out var truck))
                {
                    Add(issues, station.Id, "CompatibleTruckTypeIds", "The station references an unknown forklift type.");
                    continue;
                }
                var compatible = station.Kind switch
                {
                    "charging" => truck.EnergyType == "electric" && !string.IsNullOrWhiteSpace(station.ChargerType) && truck.CompatibleChargerTypes.Contains(station.ChargerType, StringComparer.Ordinal),
                    "battery-watering" => !string.IsNullOrWhiteSpace(truck.BatteryType) && station.CompatibleBatteryTypes.Contains(truck.BatteryType, StringComparer.Ordinal),
                    _ => false
                };
                if (!compatible) Add(issues, station.Id, "CompatibleTruckTypeIds", $"The station is not compatible with forklift type '{truck.Name}'.");
            }

            var needsPower = station.Kind == "charging" || station.RequiresPower == true;
            var demand = station.Kind == "charging" ? station.ChargerPowerKw : station.PowerDemandKw;
            if (needsPower && (demand is not > 0 || !double.IsFinite(demand.Value)))
                Add(issues, station.Id, station.Kind == "charging" ? "ChargerPowerKw" : "PowerDemandKw", "The station needs a finite, positive power demand in kW.");
            if (needsPower)
            {
                var powerPoint = NearestAvailableUtility(station, "power", layout);
                if (powerPoint is null)
                    Add(issues, station.Id, "PowerReach", "The station has no power point to connect to.");
                else if (demand is > 0 && double.IsFinite(demand.Value) && double.IsFinite(station.ServiceCapacity) && station.ServiceCapacity > 0)
                    powerLoads[powerPoint.Id] = powerLoads.GetValueOrDefault(powerPoint.Id) + demand.Value * station.ServiceCapacity;
            }
            if (station.Kind == "battery-watering" && NearestAvailableUtility(station, "water", layout) is null)
                Add(issues, station.Id, "WaterReach", "The battery-watering station has no water point to connect to.");
            if (station.Kind is not ("charging" or "battery-watering"))
                Add(issues, station.Id, "Kind", "The service station kind is not supported.");
        }
        var utilities = layout.Utilities.ToDictionary(item => item.Id);
        foreach (var (utilityId, load) in powerLoads)
        {
            var point = utilities[utilityId];
            if (point.CapacityKw is not double capacity || !double.IsFinite(capacity))
                Add(issues, utilityId, "CapacityKw", "The assigned power point needs a configured capacity in kW.");
            else if (load > capacity + Epsilon)
                Add(issues, utilityId, "CapacityKw", $"Automatically assigned charging stations require {load} kW but the power point provides {capacity} kW.");
        }

        var obstacles = BuildObstacles(layout);
        foreach (var route in layout.TruckRoutes)
        {
            if (string.IsNullOrWhiteSpace(route.Name)) Add(issues, route.Id, "Name", "Name must not be empty or whitespace.");
            if (!ValidPath(route.Points, 2))
            {
                Add(issues, route.Id, "Points", "A forklift route needs at least two finite path points.");
                continue;
            }
            Positive(issues, route.Id, "UsableWidthMm", route.UsableWidthMm);
            var halfWidth = Math.Max(0, route.UsableWidthMm) / 2;
            foreach (var typeId in route.AllowedTruckTypeIds)
            {
                if (!trucks.TryGetValue(typeId, out var truck))
                {
                    Add(issues, route.Id, "AllowedTruckTypeIds", "The route references an unknown forklift type.");
                    continue;
                }
                if (truck.WidthMm is not > 0 || truck.MinimumAisleWidthMm is not > 0)
                {
                    Add(issues, route.Id, "AllowedTruckTypeIds", $"The route cannot be checked for {truck.Name} because its width or minimum aisle width is unknown.");
                }
                else if (route.UsableWidthMm > 0 && route.UsableWidthMm + Epsilon < Math.Max(truck.WidthMm.Value, truck.MinimumAisleWidthMm.Value))
                    Add(issues, route.Id, "UsableWidthMm", $"The route is too narrow for forklift type '{truck.Name}'.");
                if (truck.TurningRadiusMm is not > 0)
                {
                    Add(issues, route.Id, "AllowedTruckTypeIds", $"The route turn cannot be checked for {truck.Name} because its turning radius is unknown.");
                    continue;
                }
                for (var index = 1; index < route.Points.Count - 1; index++)
                {
                    var before = route.Points[index - 1];
                    var corner = route.Points[index];
                    var after = route.Points[index + 1];
                    var incoming = new TruckLogisticsPoint(corner.Xmm - before.Xmm, corner.Ymm - before.Ymm);
                    var outgoing = new TruckLogisticsPoint(after.Xmm - corner.Xmm, after.Ymm - corner.Ymm);
                    var firstLength = Distance(incoming, new TruckLogisticsPoint(0, 0));
                    var secondLength = Distance(outgoing, new TruckLogisticsPoint(0, 0));
                    if (firstLength <= Epsilon || secondLength <= Epsilon) continue;
                    var cosine = Math.Clamp((incoming.Xmm * outgoing.Xmm + incoming.Ymm * outgoing.Ymm) / (firstLength * secondLength), -1, 1);
                    var tangent = truck.TurningRadiusMm.Value * Math.Tan(Math.Acos(cosine) / 2);
                    if (!double.IsFinite(tangent) || firstLength + Epsilon < tangent || secondLength + Epsilon < tangent)
                        Add(issues, route.Id, "Points", $"The route turn at point {index + 1} does not provide forklift type '{truck.Name}' turning radius.");
                }
            }

            foreach (var obstacle in obstacles)
            {
                if (Segments(route.Points).Any(segment => SegmentBoxDistance(segment, obstacle) < halfWidth - Epsilon))
                    Add(issues, route.Id, "Points", $"The route lacks configured clearance from {obstacle.Name}.");
            }
            foreach (var bay in layout.LoadingBays)
            {
                if (bay.Outline is { Count: >= 3 } && Segments(route.Points).Any(segment => SegmentPolygonDistance(segment, bay.Outline) < halfWidth - Epsilon))
                    Add(issues, route.Id, "Points", $"The route lacks configured clearance from loading bay '{bay.Name}'.");
            }
            foreach (var barrier in layout.SafetyBarriers)
            {
                if (ValidPath(barrier.Points, 2) && Segments(route.Points).Any(segment => Segments(barrier.Points).Any(edge => SegmentDistance(segment, edge) < halfWidth + Math.Max(0, barrier.ThicknessMm) / 2 - Epsilon)))
                    Add(issues, route.Id, "Points", $"The forklift route intersects or lacks clearance from safety barrier '{barrier.Name}'.");
                if (barrier.KeepClearOutline is { Count: >= 3 } keepClear && FinitePoints(keepClear) &&
                    Segments(route.Points).Any(segment => SegmentPolygonDistance(segment, keepClear) < halfWidth - Epsilon))
                    Add(issues, route.Id, "Points", $"The forklift route passes through the protected keep-clear area of '{barrier.Name}'.");
            }
            if (layout.FloorOutline.Count >= 3 && !RouteInsideBoundary(route.Points, halfWidth, layout.FloorOutline))
                Add(issues, route.Id, "Points", "The route clearance extends outside the factory boundary.");
        }

        foreach (var route in layout.PedestrianRoutes)
        {
            if (string.IsNullOrWhiteSpace(route.Name)) Add(issues, route.Id, "Name", "Name must not be empty or whitespace.");
            if (!ValidPath(route.Points, 2)) Add(issues, route.Id, "Points", "A pedestrian route needs at least two finite path points.");
            Positive(issues, route.Id, "UsableWidthMm", route.UsableWidthMm);
            if (route.Parallel is { } parallel)
            {
                var source = layout.TruckRoutes.FirstOrDefault(item => item.Id == parallel.TruckRouteId);
                var expected = source is null ? null : ParallelRoutePoints(source.Points, parallel.Side, parallel.OffsetMm);
                if (expected is null || expected.Count != route.Points.Count || expected.Where((point, index) => Distance(point, route.Points[index]) > 1).Any())
                    Add(issues, route.Id, "Parallel", "The pedestrian route does not match its configured forklift-route offset.");
            }
        }
        foreach (var barrier in layout.SafetyBarriers)
        {
            if (string.IsNullOrWhiteSpace(barrier.Name)) Add(issues, barrier.Id, "Name", "Name must not be empty or whitespace.");
            if (!ValidPath(barrier.Points, 2)) Add(issues, barrier.Id, "Points", "A safety barrier needs at least two finite path points.");
            if (!double.IsFinite(barrier.ThicknessMm) || barrier.ThicknessMm <= 0) Add(issues, barrier.Id, "ThicknessMm", "Thickness must be finite and greater than zero.");
            if (barrier.ProtectedTargetId is Guid targetId)
            {
                var targetMachine = layout.Machines.FirstOrDefault(machine => machine.Id == targetId);
                var targetExit = layout.Utilities.FirstOrDefault(utility => utility.Id == targetId && utility.Kind == "exit");
                if (targetMachine is null && targetExit is null)
                    Add(issues, barrier.Id, "ProtectedTargetId", "The protected target must reference an existing machine or exit.");
                if (barrier.KeepClearOutline is not { Count: >= 3 } keepClear)
                    Add(issues, barrier.Id, "KeepClearOutline", "A protected target needs an explicit keep-clear area.");
                else
                {
                    ValidatePolygon(issues, barrier.Id, "KeepClearOutline", keepClear);
                    var targetPoint = targetMachine is not null
                        ? new TruckLogisticsPoint(targetMachine.Xmm, targetMachine.Ymm)
                        : targetExit is not null ? new TruckLogisticsPoint(targetExit.Xmm, targetExit.Ymm) : null;
                    if (targetPoint is not null && !Inside(targetPoint, keepClear))
                        Add(issues, barrier.Id, "KeepClearOutline", "The keep-clear area must include its protected target.");
                    if (ValidPath(barrier.Points, 2) && double.IsFinite(barrier.ThicknessMm) && Segments(barrier.Points).Any(segment => SegmentPolygonDistance(segment, keepClear) < barrier.ThicknessMm / 2 - Epsilon))
                        Add(issues, barrier.Id, "KeepClearOutline", "The barrier blocks its protected keep-clear area.");
                    foreach (var machine in layout.Machines.Where(machine => machine.Id != targetId))
                    {
                        var type = layout.MachineTypes.FirstOrDefault(item => item.Id == machine.MachineTypeId);
                        if (type is not null && PolygonOverlaps(keepClear, BoxCorners(MachineBounds(machine, type))))
                            Add(issues, barrier.Id, "KeepClearOutline", $"The protected access area overlaps machine '{type.Name}'.");
                    }
                    foreach (var obstacle in obstacles.Where(item => item.Name != "machine"))
                        if (PolygonOverlaps(keepClear, BoxCorners(obstacle)))
                            Add(issues, barrier.Id, "KeepClearOutline", $"The protected access area overlaps {obstacle.Name}.");
                    foreach (var spot in layout.ParkingSpots.Where(spot => spot.Outline.Count >= 3 && FinitePoints(spot.Outline)))
                        if (PolygonOverlaps(keepClear, spot.Outline))
                            Add(issues, barrier.Id, "KeepClearOutline", $"The protected access area overlaps parking spot '{spot.Name}'.");
                    foreach (var bay in layout.LoadingBays.Where(bay => bay.Outline is { Count: >= 3 }))
                    {
                        var bayOutline = bay.Outline.Select(point => new TruckLogisticsPoint(point.Xmm, point.Ymm)).ToList();
                        if (FinitePoints(bayOutline) && PolygonOverlaps(keepClear, bayOutline))
                            Add(issues, barrier.Id, "KeepClearOutline", $"The protected access area overlaps loading bay '{bay.Name}'.");
                    }
                    foreach (var route in layout.TruckRoutes.Where(route => ValidPath(route.Points, 2)))
                        if (Segments(route.Points).Any(segment => SegmentPolygonDistance(segment, keepClear) < Math.Max(0, route.UsableWidthMm) / 2 - Epsilon))
                            Add(issues, barrier.Id, "KeepClearOutline", $"The protected access area overlaps forklift route '{route.Name}'.");
                    foreach (var otherBarrier in layout.SafetyBarriers.Where(item => item.Id != barrier.Id && ValidPath(item.Points, 2)))
                        if (Segments(otherBarrier.Points).Any(segment => SegmentPolygonDistance(segment, keepClear) < Math.Max(0, otherBarrier.ThicknessMm) / 2 - Epsilon))
                            Add(issues, barrier.Id, "KeepClearOutline", $"The protected access area is blocked by safety barrier '{otherBarrier.Name}'.");
                }
            }
            else if (barrier.KeepClearOutline is not null)
                Add(issues, barrier.Id, "KeepClearOutline", "A keep-clear area requires a protected target.");
        }

        foreach (var truckRoute in layout.TruckRoutes.Where(route => ValidPath(route.Points, 2)))
        foreach (var pedestrianRoute in layout.PedestrianRoutes.Where(route => ValidPath(route.Points, 2)))
        foreach (var point in Crossings(truckRoute.Points, pedestrianRoute.Points))
        {
            if (!layout.PedestrianCrossings.Any(crossing => crossing.TruckRouteId == truckRoute.Id && crossing.PedestrianRouteId == pedestrianRoute.Id && Distance(point, new TruckLogisticsPoint(crossing.Xmm, crossing.Ymm)) <= CrossingToleranceMm))
                Add(issues, truckRoute.Id, "Points", $"Forklift route '{truckRoute.Name}' crosses pedestrian route '{pedestrianRoute.Name}' without a crossing marker.");
        }

        foreach (var crossing in layout.PedestrianCrossings)
        {
            var truckRoute = layout.TruckRoutes.FirstOrDefault(route => route.Id == crossing.TruckRouteId);
            var pedestrianRoute = layout.PedestrianRoutes.FirstOrDefault(route => route.Id == crossing.PedestrianRouteId);
            if (truckRoute is null || pedestrianRoute is null)
            {
                Add(issues, crossing.Id, "RouteIds", "A crossing must reference an existing forklift and pedestrian route.");
                continue;
            }
            if (!ValidPath(truckRoute.Points, 2) || !ValidPath(pedestrianRoute.Points, 2) || !Crossings(truckRoute.Points, pedestrianRoute.Points).Any(point => Distance(point, new TruckLogisticsPoint(crossing.Xmm, crossing.Ymm)) <= CrossingToleranceMm))
                Add(issues, crossing.Id, "Position", "The crossing marker is not at an intersection of its selected routes.");
        }

        return issues;
    }

    private static TruckLogisticsUtilityPoint? NearestAvailableUtility(TruckServiceStation station, string kind, TruckLogisticsLayout layout)
    {
        var stationPoint = new TruckLogisticsPoint(station.Xmm, station.Ymm);
        return layout.Utilities
            .Where(point => point.Kind == kind && Finite(new TruckLogisticsPoint(point.Xmm, point.Ymm)))
            .Select(point => new
            {
                Point = point,
                Distance = Distance(stationPoint, new TruckLogisticsPoint(point.Xmm, point.Ymm))
            })
            .Where(candidate => !UtilityLineBlocked(stationPoint, new TruckLogisticsPoint(candidate.Point.Xmm, candidate.Point.Ymm), layout.Walls))
            .OrderBy(candidate => candidate.Distance)
            .Select(candidate => candidate.Point)
            .FirstOrDefault();
    }

    private static bool UtilityLineBlocked(TruckLogisticsPoint start, TruckLogisticsPoint end, IReadOnlyList<Wall> walls)
    {
        var line = new Segment(start, end);
        return walls.Any(wall => double.IsFinite(wall.ThicknessMm) &&
            SegmentDistance(line, new Segment(wall.Start, wall.End)) < Math.Max(0, wall.ThicknessMm) / 2 + Epsilon);
    }

    private static Box MachineBounds(MachineInstance machine, MachineType type)
    {
        var radians = machine.RotationDegrees * Math.PI / 180;
        var width = Math.Abs(type.WidthMm * Math.Cos(radians)) + Math.Abs(type.DepthMm * Math.Sin(radians));
        var depth = Math.Abs(type.WidthMm * Math.Sin(radians)) + Math.Abs(type.DepthMm * Math.Cos(radians));
        return new Box(machine.Xmm - width / 2, machine.Ymm - depth / 2, width, depth, machine.Id, "machine");
    }

    private static List<Box> BuildObstacles(TruckLogisticsLayout layout)
    {
        var result = new List<Box>();
        var types = layout.MachineTypes.ToDictionary(type => type.Id);
        foreach (var machine in layout.Machines)
        {
            if (!types.TryGetValue(machine.MachineTypeId, out var type)) continue;
            result.Add(MachineBounds(machine, type));
        }
        foreach (var pillar in layout.Pillars) result.Add(new Box(pillar.Xmm - pillar.WidthMm / 2, pillar.Ymm - pillar.DepthMm / 2, pillar.WidthMm, pillar.DepthMm, pillar.Id, "pillar"));
        foreach (var wall in layout.Walls)
        {
            var thickness = Math.Max(0, wall.ThicknessMm);
            result.Add(new Box(Math.Min(wall.Start.Xmm, wall.End.Xmm) - thickness / 2, Math.Min(wall.Start.Ymm, wall.End.Ymm) - thickness / 2,
                Math.Abs(wall.End.Xmm - wall.Start.Xmm) + thickness, Math.Abs(wall.End.Ymm - wall.Start.Ymm) + thickness, wall.Id, "wall"));
        }
        return result;
    }

    private static bool RouteInsideBoundary(IReadOnlyList<TruckLogisticsPoint> path, double clearance, IReadOnlyList<TruckLogisticsPoint> boundary)
    {
        foreach (var segment in Segments(path))
        {
            if (!Inside(segment.A, boundary) || !Inside(segment.B, boundary)) return false;
            foreach (var edge in Segments(boundary.Append(boundary[0]).ToList()))
                if (SegmentDistance(segment, edge) < clearance - Epsilon) return false;
        }
        return true;
    }

    private static bool ValidPath(IReadOnlyList<TruckLogisticsPoint>? points, int minimum) => points is { Count: >= 2 } && points.Count >= minimum && points.All(Finite);
    private static bool Finite(TruckLogisticsPoint p) => double.IsFinite(p.Xmm) && double.IsFinite(p.Ymm);
    private static bool FinitePoints(IReadOnlyList<TruckLogisticsPoint> points) => points.All(Finite);
    private static void Positive(List<TruckLogisticsValidationIssue> issues, Guid id, string field, double value)
    {
        if (!double.IsFinite(value) || value <= 0) Add(issues, id, field, "Value must be finite and greater than zero.");
    }
    private static void Add(List<TruckLogisticsValidationIssue> issues, Guid? id, string field, string message) => issues.Add(new(id, field, message));
    private static double Distance(TruckLogisticsPoint a, TruckLogisticsPoint b) => Math.Sqrt(Math.Pow(a.Xmm - b.Xmm, 2) + Math.Pow(a.Ymm - b.Ymm, 2));
    private static List<Segment> Segments(IReadOnlyList<TruckLogisticsPoint> points) => points.Zip(points.Skip(1), (a, b) => new Segment(a, b)).ToList();

    private static List<TruckLogisticsPoint>? ParallelRoutePoints(IReadOnlyList<TruckLogisticsPoint> points, string side, double offsetMm)
    {
        if (!ValidPath(points, 2) || !double.IsFinite(offsetMm) || offsetMm < 0 || side is not ("left" or "right")) return null;
        var sign = side == "left" ? 1 : -1;
        var normals = new List<TruckLogisticsPoint>();
        for (var index = 1; index < points.Count; index++)
        {
            var dx = points[index].Xmm - points[index - 1].Xmm;
            var dy = points[index].Ymm - points[index - 1].Ymm;
            var length = Math.Sqrt(dx * dx + dy * dy);
            if (length <= Epsilon) return null;
            normals.Add(new TruckLogisticsPoint(sign * dy / length, -sign * dx / length));
        }
        var shifted = new List<TruckLogisticsPoint>();
        for (var index = 0; index < points.Count; index++)
        {
            var normal = index == 0 ? normals[0] : index == points.Count - 1 ? normals[^1] :
                new TruckLogisticsPoint(normals[index - 1].Xmm + normals[index].Xmm, normals[index - 1].Ymm + normals[index].Ymm);
            var magnitude = Math.Sqrt(normal.Xmm * normal.Xmm + normal.Ymm * normal.Ymm);
            if (magnitude <= Epsilon) return null;
            var unitX = normal.Xmm / magnitude;
            var unitY = normal.Ymm / magnitude;
            var scale = index == 0 || index == points.Count - 1 ? offsetMm :
                offsetMm / (unitX * normals[index].Xmm + unitY * normals[index].Ymm);
            if (!double.IsFinite(scale) || Math.Abs(scale) > Math.Max(offsetMm * 10, 1)) return null;
            shifted.Add(new TruckLogisticsPoint(Math.Round(points[index].Xmm + unitX * scale), Math.Round(points[index].Ymm + unitY * scale)));
        }
        return shifted;
    }
    private static double Cross(TruckLogisticsPoint a, TruckLogisticsPoint b, TruckLogisticsPoint c) => (b.Xmm - a.Xmm) * (c.Ymm - a.Ymm) - (b.Ymm - a.Ymm) * (c.Xmm - a.Xmm);

    private static bool Intersects(Segment a, Segment b)
    {
        var c1 = Cross(a.A, a.B, b.A); var c2 = Cross(a.A, a.B, b.B);
        var c3 = Cross(b.A, b.B, a.A); var c4 = Cross(b.A, b.B, a.B);
        if (c1 * c2 < -Epsilon && c3 * c4 < -Epsilon) return true;
        return OnSegment(b.A, a) || OnSegment(b.B, a) || OnSegment(a.A, b) || OnSegment(a.B, b);
    }
    private static bool OnSegment(TruckLogisticsPoint p, Segment s) => Math.Abs(Cross(s.A, s.B, p)) <= Epsilon && p.Xmm >= Math.Min(s.A.Xmm, s.B.Xmm) - Epsilon && p.Xmm <= Math.Max(s.A.Xmm, s.B.Xmm) + Epsilon && p.Ymm >= Math.Min(s.A.Ymm, s.B.Ymm) - Epsilon && p.Ymm <= Math.Max(s.A.Ymm, s.B.Ymm) + Epsilon;
    private static double PointSegmentDistance(TruckLogisticsPoint p, Segment s)
    {
        var dx = s.B.Xmm - s.A.Xmm; var dy = s.B.Ymm - s.A.Ymm; var length = dx * dx + dy * dy;
        var t = length <= Epsilon ? 0 : Math.Clamp(((p.Xmm - s.A.Xmm) * dx + (p.Ymm - s.A.Ymm) * dy) / length, 0, 1);
        return Distance(p, new TruckLogisticsPoint(s.A.Xmm + t * dx, s.A.Ymm + t * dy));
    }
    private static double SegmentDistance(Segment a, Segment b) => Intersects(a, b) ? 0 : Math.Min(Math.Min(PointSegmentDistance(a.A, b), PointSegmentDistance(a.B, b)), Math.Min(PointSegmentDistance(b.A, a), PointSegmentDistance(b.B, a)));
    private static double SegmentBoxDistance(Segment segment, Box box)
    {
        if (segment.A.Xmm >= box.X && segment.A.Xmm <= box.X + box.Width && segment.A.Ymm >= box.Y && segment.A.Ymm <= box.Y + box.Depth) return 0;
        var corners = new[] { new TruckLogisticsPoint(box.X, box.Y), new TruckLogisticsPoint(box.X + box.Width, box.Y), new TruckLogisticsPoint(box.X + box.Width, box.Y + box.Depth), new TruckLogisticsPoint(box.X, box.Y + box.Depth) };
        var edges = Segments(corners.Append(corners[0]).ToList());
        return edges.Min(edge => SegmentDistance(segment, edge));
    }
    private static bool PolygonOverlaps(IReadOnlyList<TruckLogisticsPoint> first, IReadOnlyList<TruckLogisticsPoint> second)
    {
        var firstEdges = Segments(first.Append(first[0]).ToList());
        var secondEdges = Segments(second.Append(second[0]).ToList());
        return firstEdges.Any(a => secondEdges.Any(b => Intersects(a, b))) || first.Any(point => Inside(point, second)) || second.Any(point => Inside(point, first));
    }
    private static double SegmentPolygonDistance(Segment segment, IReadOnlyList<LoadingBayOutlinePoint> outline) =>
        SegmentPolygonDistance(segment, outline.Select(point => new TruckLogisticsPoint(point.Xmm, point.Ymm)).ToList());

    private static double SegmentPolygonDistance(Segment segment, IReadOnlyList<TruckLogisticsPoint> outline)
    {
        if (Inside(segment.A, outline) || Inside(segment.B, outline)) return 0;
        return Segments(outline.Append(outline[0]).ToList()).Min(edge => SegmentDistance(segment, edge));
    }

    private static List<TruckLogisticsPoint> BoxCorners(Box box) =>
    [
        new(box.X, box.Y), new(box.X + box.Width, box.Y),
        new(box.X + box.Width, box.Y + box.Depth), new(box.X, box.Y + box.Depth)
    ];
    private static bool Inside(TruckLogisticsPoint point, IReadOnlyList<TruckLogisticsPoint> outline)
    {
        var inside = false;
        for (int i = 0, j = outline.Count - 1; i < outline.Count; j = i++)
        {
            var a = outline[j]; var b = outline[i];
            if ((a.Ymm > point.Ymm) != (b.Ymm > point.Ymm) && point.Xmm < (b.Xmm - a.Xmm) * (point.Ymm - a.Ymm) / (b.Ymm - a.Ymm) + a.Xmm) inside = !inside;
        }
        return inside;
    }
    private static IEnumerable<TruckLogisticsPoint> Crossings(IReadOnlyList<TruckLogisticsPoint> first, IReadOnlyList<TruckLogisticsPoint> second)
    {
        foreach (var a in Segments(first)) foreach (var b in Segments(second))
        {
            if (!Intersects(a, b)) continue;
            var divisor = (a.B.Xmm - a.A.Xmm) * (b.B.Ymm - b.A.Ymm) - (a.B.Ymm - a.A.Ymm) * (b.B.Xmm - b.A.Xmm);
            if (Math.Abs(divisor) <= Epsilon) continue;
            var t = ((b.A.Xmm - a.A.Xmm) * (b.B.Ymm - b.A.Ymm) - (b.A.Ymm - a.A.Ymm) * (b.B.Xmm - b.A.Xmm)) / divisor;
            yield return new TruckLogisticsPoint(a.A.Xmm + t * (a.B.Xmm - a.A.Xmm), a.A.Ymm + t * (a.B.Ymm - a.A.Ymm));
        }
    }
    private static void ValidatePolygon(List<TruckLogisticsValidationIssue> issues, Guid id, string field, IReadOnlyList<TruckLogisticsPoint> outline)
    {
        if (outline.Count < 3 || !FinitePoints(outline)) { Add(issues, id, field, "The outline needs at least three finite points."); return; }
        var area = Math.Abs(outline.Select((p, i) => p.Xmm * outline[(i + 1) % outline.Count].Ymm - outline[(i + 1) % outline.Count].Xmm * p.Ymm).Sum()) / 2;
        if (!double.IsFinite(area) || area <= Epsilon) Add(issues, id, field, "The outline must have positive area.");
        var edges = Segments(outline.Append(outline[0]).ToList());
        for (var i = 0; i < edges.Count; i++) for (var j = i + 1; j < edges.Count; j++)
        {
            if (j == i + 1 || i == 0 && j == edges.Count - 1) continue;
            if (Intersects(edges[i], edges[j])) { Add(issues, id, field, "The outline must not self-intersect."); return; }
        }
    }
    private static (double Width, double Depth) Bounds(IReadOnlyList<TruckLogisticsPoint> points) => (points.Max(p => p.Xmm) - points.Min(p => p.Xmm), points.Max(p => p.Ymm) - points.Min(p => p.Ymm));
}
