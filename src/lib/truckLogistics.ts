import { bodyBox, bodyRect, boxToRect, pillarBox, rectCorners, rectInsideFloor, rectsOverlap, wallBox, type Box, type Rect } from '@/lib/geometry'
import { machineTypeFor } from '@/data/catalog'
import type {
  Floorplan,
  ForkliftInstance,
  LoadingBay,
  MachineInstance,
  PedestrianCrossing,
  PedestrianRoute,
  Pillar,
  Point,
  SafetyBarrier,
  TruckParkingSpot,
  TruckRoute,
  TruckServiceStation,
  TruckType,
  Utility,
  Wall,
} from '@/types'

export interface TruckLogisticsIssue {
  key: string
  message: string
  ids: string[]
}

interface TruckLogisticsLayout {
  truckTypes: TruckType[]
  utilities: Utility[]
  parkingSpots: TruckParkingSpot[]
  serviceStations: TruckServiceStation[]
  truckRoutes: TruckRoute[]
  pedestrianRoutes: PedestrianRoute[]
  pedestrianCrossings: PedestrianCrossing[]
  safetyBarriers: SafetyBarrier[]
  machines: MachineInstance[]
  forkliftInstances?: ForkliftInstance[]
  pillars: Pillar[]
  walls: Wall[]
  loadingBays: LoadingBay[]
  floorplan?: Floorplan | null
}

const EPSILON = 1e-6
const CROSSING_MARK_TOLERANCE_MM = 250
export const DEFAULT_FORKLIFT_ROUTE_WIDTH_MM = 2500
export const DEFAULT_PEDESTRIAN_ROUTE_WIDTH_MM = 1200
export const DEFAULT_BARRIER_THICKNESS_MM = 100
export const GENERATED_BARRIER_CLEARANCE_MM = 2

type Segment = { a: Point; b: Point }

const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y)
const segments = (points: Point[]): Segment[] => points.slice(1).map((point, index) => ({ a: points[index], b: point }))

export function forkliftRect(type: TruckType, instance: Pick<ForkliftInstance, 'x' | 'y' | 'rotation'>): Rect | null {
  if (type.widthMm === null || type.widthMm <= 0 || type.lengthMm === null || type.lengthMm <= 0) return null
  return { cx: instance.x, cy: instance.y, width: type.widthMm, depth: type.lengthMm, rotation: instance.rotation }
}

export function forkliftFootprint(type: TruckType, instance: Pick<ForkliftInstance, 'x' | 'y' | 'rotation'>): Point[] | null {
  const rect = forkliftRect(type, instance)
  return rect ? rectCorners(rect) : null
}

function pointSegmentDistance(point: Point, segment: Segment) {
  const dx = segment.b.x - segment.a.x
  const dy = segment.b.y - segment.a.y
  const length = dx * dx + dy * dy
  const t = length <= 0 ? 0 : Math.max(0, Math.min(1, ((point.x - segment.a.x) * dx + (point.y - segment.a.y) * dy) / length))
  return distance(point, { x: segment.a.x + t * dx, y: segment.a.y + t * dy })
}

function cross(a: Point, b: Point, c: Point) {
  return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x)
}

function segmentsIntersect(first: Segment, second: Segment) {
  const a = cross(first.a, first.b, second.a)
  const b = cross(first.a, first.b, second.b)
  const c = cross(second.a, second.b, first.a)
  const d = cross(second.a, second.b, first.b)
  if (a * b < -EPSILON && c * d < -EPSILON) return true
  const on = (point: Point, segment: Segment, value: number) => Math.abs(value) <= EPSILON &&
    point.x >= Math.min(segment.a.x, segment.b.x) - EPSILON && point.x <= Math.max(segment.a.x, segment.b.x) + EPSILON &&
    point.y >= Math.min(segment.a.y, segment.b.y) - EPSILON && point.y <= Math.max(segment.a.y, segment.b.y) + EPSILON
  return on(second.a, first, a) || on(second.b, first, b) || on(first.a, second, c) || on(first.b, second, d)
}

function segmentDistance(first: Segment, second: Segment) {
  if (segmentsIntersect(first, second)) return 0
  return Math.min(
    pointSegmentDistance(first.a, second), pointSegmentDistance(first.b, second),
    pointSegmentDistance(second.a, first), pointSegmentDistance(second.b, first),
  )
}

function pointInPolygon(point: Point, outline: Point[]) {
  let inside = false
  for (let i = 0, j = outline.length - 1; i < outline.length; j = i++) {
    const a = outline[j]
    const b = outline[i]
    if ((a.y > point.y) !== (b.y > point.y) && point.x < (b.x - a.x) * (point.y - a.y) / (b.y - a.y) + a.x) inside = !inside
  }
  return inside
}

function segmentPolygonDistance(segment: Segment, outline: Point[]) {
  if (pointInPolygon(segment.a, outline) || pointInPolygon(segment.b, outline)) return 0
  const edges = [...outline.map((point, index) => ({ a: point, b: outline[(index + 1) % outline.length] }))]
  return Math.min(...edges.map((edge) => segmentDistance(segment, edge)))
}

function segmentBoxDistance(segment: Segment, box: Box) {
  const corners = [
    { x: box.x, y: box.y }, { x: box.x + box.width, y: box.y },
    { x: box.x + box.width, y: box.y + box.depth }, { x: box.x, y: box.y + box.depth },
  ]
  if (segment.a.x >= box.x && segment.a.x <= box.x + box.width && segment.a.y >= box.y && segment.a.y <= box.y + box.depth) return 0
  const edges = corners.map((point, index) => ({ a: point, b: corners[(index + 1) % corners.length] }))
  return Math.min(...edges.map((edge) => segmentDistance(segment, edge)))
}

function crossingPoints(truckRoute: TruckRoute, pedestrianRoute: PedestrianRoute) {
  const intersections: Point[] = []
  for (const truckSegment of segments(truckRoute.points)) {
    for (const pedestrianSegment of segments(pedestrianRoute.points)) {
      if (!segmentsIntersect(truckSegment, pedestrianSegment)) continue
      const denominator = (truckSegment.b.x - truckSegment.a.x) * (pedestrianSegment.b.y - pedestrianSegment.a.y) -
        (truckSegment.b.y - truckSegment.a.y) * (pedestrianSegment.b.x - pedestrianSegment.a.x)
      if (Math.abs(denominator) <= EPSILON) continue
      const t = ((pedestrianSegment.a.x - truckSegment.a.x) * (pedestrianSegment.b.y - pedestrianSegment.a.y) -
        (pedestrianSegment.a.y - truckSegment.a.y) * (pedestrianSegment.b.x - pedestrianSegment.a.x)) / denominator
      intersections.push({
        x: truckSegment.a.x + t * (truckSegment.b.x - truckSegment.a.x),
        y: truckSegment.a.y + t * (truckSegment.b.y - truckSegment.a.y),
      })
    }
  }
  return intersections.filter((point, index) => intersections.findIndex((other) => distance(point, other) <= EPSILON) === index)
}

export function crossingPlacementAt(
  point: Point,
  truckRoutes: TruckRoute[],
  pedestrianRoutes: PedestrianRoute[],
  onlyTruckRouteId?: string,
): { truckRouteId: string; pedestrianRouteIds: string[]; point: Point } | null {
  let nearest: { route: TruckRoute; point: Point; distance: number } | null = null
  for (const route of truckRoutes) {
    if (onlyTruckRouteId && route.id !== onlyTruckRouteId) continue
    for (const segment of segments(route.points)) {
      const dx = segment.b.x - segment.a.x
      const dy = segment.b.y - segment.a.y
      const lengthSquared = dx * dx + dy * dy
      if (lengthSquared <= EPSILON) continue
      const t = Math.max(0, Math.min(1, ((point.x - segment.a.x) * dx + (point.y - segment.a.y) * dy) / lengthSquared))
      const projected = { x: segment.a.x + t * dx, y: segment.a.y + t * dy }
      const distanceMm = distance(point, projected)
      if (distanceMm <= Math.max(0, route.usableWidthMm) / 2 + CROSSING_MARK_TOLERANCE_MM && (!nearest || distanceMm < nearest.distance)) {
        nearest = { route, point: projected, distance: distanceMm }
      }
    }
  }
  if (!nearest) return null

  const pedestrianRouteIds = pedestrianRoutes.filter((route) => {
    if (route.parallel?.truckRouteId === nearest!.route.id) return true
    return crossingPoints(nearest!.route, route).some((crossing) => distance(crossing, nearest!.point) <= CROSSING_MARK_TOLERANCE_MM)
  }).map((route) => route.id)
  return pedestrianRouteIds.length > 0
    ? { truckRouteId: nearest.route.id, pedestrianRouteIds, point: nearest.point }
    : null
}

export function distanceToPath(point: Point, points: Point[]): number {
  return Math.min(...segments(points).map((segment) => pointSegmentDistance(point, segment)), Infinity)
}

export function distanceAlongPath(points: Point[], point: Point): number | null {
  if (points.length < 2 || !finitePoints(points)) return null
  let traveled = 0
  let nearest: { distance: number; along: number } | null = null
  for (const segment of segments(points)) {
    const dx = segment.b.x - segment.a.x
    const dy = segment.b.y - segment.a.y
    const length = Math.hypot(dx, dy)
    if (length <= EPSILON) continue
    const t = Math.max(0, Math.min(1, ((point.x - segment.a.x) * dx + (point.y - segment.a.y) * dy) / (length * length)))
    const projected = { x: segment.a.x + t * dx, y: segment.a.y + t * dy }
    const distanceMm = distance(point, projected)
    if (!nearest || distanceMm < nearest.distance) nearest = { distance: distanceMm, along: traveled + length * t }
    traveled += length
  }
  return nearest?.along ?? null
}

export function barrierCollisionSegments(barrier: Pick<SafetyBarrier, 'points' | 'openings'>): Segment[] {
  const edges = segments(barrier.points)
  const intervals = (barrier.openings ?? []).filter((opening) => Number.isFinite(opening.distanceMm) && Number.isFinite(opening.widthMm) && opening.widthMm > 0)
    .map((opening) => [Math.max(0, opening.distanceMm - opening.widthMm / 2), opening.distanceMm + opening.widthMm / 2] as const)
  let traveled = 0
  const visible: Segment[] = []
  for (const edge of edges) {
    const dx = edge.b.x - edge.a.x
    const dy = edge.b.y - edge.a.y
    const length = Math.hypot(dx, dy)
    if (length <= EPSILON) continue
    const edgeEnd = traveled + length
    const cuts = [0, 1]
    for (const [start, end] of intervals) {
      if (start > traveled && start < edgeEnd) cuts.push((start - traveled) / length)
      if (end > traveled && end < edgeEnd) cuts.push((end - traveled) / length)
    }
    cuts.sort((a, b) => a - b)
    for (let index = 1; index < cuts.length; index++) {
      const from = cuts[index - 1]
      const to = cuts[index]
      const middle = traveled + (from + to) / 2 * length
      if (intervals.some(([start, end]) => middle >= start && middle <= end)) continue
      if ((to - from) * length <= EPSILON) continue
      visible.push({
        a: { x: edge.a.x + dx * from, y: edge.a.y + dy * from },
        b: { x: edge.a.x + dx * to, y: edge.a.y + dy * to },
      })
    }
    traveled = edgeEnd
  }
  return visible
}

export function parallelRoutePoints(points: Point[], side: 'left' | 'right', offsetMm: number): Point[] | null {
  if (points.length < 2 || !Number.isFinite(offsetMm) || offsetMm < 0 || !finitePoints(points)) return null
  const sideSign = side === 'left' ? 1 : -1
  const normals: Point[] = []
  for (let index = 1; index < points.length; index++) {
    const dx = points[index].x - points[index - 1].x
    const dy = points[index].y - points[index - 1].y
    const length = Math.hypot(dx, dy)
    if (length <= EPSILON) return null
    normals.push({ x: sideSign * dy / length, y: -sideSign * dx / length })
  }
  const shifted = points.map((point, index) => {
    const normal = index === 0 ? normals[0] : index === points.length - 1 ? normals[normals.length - 1] : {
      x: normals[index - 1].x + normals[index].x,
      y: normals[index - 1].y + normals[index].y,
    }
    const magnitude = Math.hypot(normal.x, normal.y)
    if (magnitude <= EPSILON) return null
    const unit = { x: normal.x / magnitude, y: normal.y / magnitude }
    const scale = index === 0 || index === points.length - 1
      ? offsetMm
      : offsetMm / (unit.x * normals[index].x + unit.y * normals[index].y)
    if (!Number.isFinite(scale) || Math.abs(scale) > Math.max(offsetMm * 10, 1)) return null
    return { x: Math.round(point.x + unit.x * scale), y: Math.round(point.y + unit.y * scale) }
  })
  return shifted.every((point): point is Point => point !== null) ? shifted : null
}

function issue(key: string, message: string, ids: string[]): TruckLogisticsIssue {
  return { key, message, ids: [...new Set(ids)] }
}

export function findTruckLogisticsIssues(layout: TruckLogisticsLayout): TruckLogisticsIssue[] {
  const issues: TruckLogisticsIssue[] = []
  const truckById = new Map(layout.truckTypes.map((truck) => [truck.id, truck]))
  const forkliftInstances = layout.forkliftInstances ?? []
  const truckRouteById = new Map(layout.truckRoutes.map((route) => [route.id, route]))
  const pedestrianRouteById = new Map(layout.pedestrianRoutes.map((route) => [route.id, route]))

  for (const spot of layout.parkingSpots) {
    if (spot.outline.length < 3 || !finitePoints(spot.outline) || !validPolygon(spot.outline)) {
      issues.push(issue(`parking-outline:${spot.id}`, `${spot.name} needs a finite, non-self-intersecting outline with positive area.`, [spot.id]))
    }
    for (const id of spot.compatibleTruckTypeIds) {
      const truck = truckById.get(id)
      if (!truck) issues.push(issue(`parking-type:${spot.id}:${id}`, `${spot.name} refers to an unknown forklift type.`, [spot.id]))
      else if (spot.outline.length >= 3 && finitePoints(spot.outline)) {
        if (truck.widthMm === null || truck.lengthMm === null) {
          issues.push(issue(`parking-spec:${spot.id}:${id}`, `${spot.name} cannot be checked against ${truck.name} because its dimensions are not specified.`, [spot.id, truck.id]))
          continue
        }
        const bounds = boundsOf(spot.outline)
        const fits = bounds.width >= truck.widthMm && bounds.depth >= truck.lengthMm || bounds.width >= truck.lengthMm && bounds.depth >= truck.widthMm
        if (!fits) {
          issues.push(issue(`parking-size:${spot.id}:${id}`, `${spot.name} may be too small for ${truck.name} (${truck.widthMm} × ${truck.lengthMm} mm).`, [spot.id, truck.id]))
        }
      }
    }
  }

  for (const instance of forkliftInstances) {
    const truck = truckById.get(instance.typeId)
    if (!truck) {
      issues.push(issue(`forklift-type:${instance.id}`, 'Placed forklift refers to an unknown catalogue model.', [instance.id]))
      continue
    }
    if (![instance.x, instance.y, instance.rotation].every(Number.isFinite)) {
      issues.push(issue(`forklift-position:${instance.id}`, `${truck.name} needs finite coordinates and rotation.`, [instance.id]))
      continue
    }
    const rect = forkliftRect(truck, instance)
    if (!rect) {
      issues.push(issue(`forklift-dimensions:${instance.id}`, `${truck.name} needs positive width and length before it can be placed.`, [instance.id, truck.id]))
      continue
    }
    if (layout.floorplan && !rectInsideFloor(rect, layout.floorplan)) {
      issues.push(issue(`forklift-floor:${instance.id}`, `${truck.name} does not fit inside the factory boundary.`, [instance.id]))
    }
    for (const machine of layout.machines) {
      const machineType = machineTypeFor(machine)
      if (machineType && rectsOverlap(rect, bodyRect(machineType, machine))) {
        issues.push(issue(`forklift-machine:${instance.id}:${machine.id}`, `${truck.name} overlaps ${machine.name ?? machineType.name}.`, [instance.id, machine.id]))
      }
    }
    for (const other of forkliftInstances) {
      if (other.id <= instance.id) continue
      const otherType = truckById.get(other.typeId)
      const otherRect = otherType && forkliftRect(otherType, other)
      if (otherRect && rectsOverlap(rect, otherRect)) {
        issues.push(issue(`forklift-overlap:${instance.id}:${other.id}`, `${truck.name} overlaps ${otherType.name}.`, [instance.id, other.id]))
      }
    }
    for (const pillar of layout.pillars) {
      if (rectsOverlap(rect, boxToRect(pillarBox(pillar)))) {
        issues.push(issue(`forklift-pillar:${instance.id}:${pillar.id}`, `${truck.name} overlaps a pillar.`, [instance.id, pillar.id]))
      }
    }
    for (const wall of layout.walls) {
      if (rectsOverlap(rect, boxToRect(wallBox(wall)))) {
        issues.push(issue(`forklift-wall:${instance.id}:${wall.id}`, `${truck.name} overlaps a wall.`, [instance.id, wall.id]))
      }
    }
    const footprint = rectCorners(rect)
    for (const barrier of layout.safetyBarriers) {
      if (barrierCollisionSegments(barrier).some((segment) => segmentPolygonDistance(segment, footprint) < Math.max(0, barrier.thicknessMm) / 2 - EPSILON)) {
        issues.push(issue(`forklift-barrier:${instance.id}:${barrier.id}`, `${truck.name} overlaps safety barrier '${barrier.name}'.`, [instance.id, barrier.id]))
      }
    }
    for (const barrier of layout.safetyBarriers) {
      if (barrier.keepClearOutline && validPolygon(barrier.keepClearOutline) && polygonOverlaps(footprint, barrier.keepClearOutline)) {
        issues.push(issue(`forklift-protected-area:${instance.id}:${barrier.id}`, `${truck.name} occupies the protected access area of '${barrier.name}'.`, [instance.id, barrier.id]))
      }
    }
  }

  for (const station of layout.serviceStations) {
    if (!Number.isFinite(station.x) || !Number.isFinite(station.y)) issues.push(issue(`station-position:${station.id}`, `${station.name} needs finite coordinates.`, [station.id]))
    if (station.kind === 'charging' && !station.chargerType?.trim()) {
      issues.push(issue(`station-charger-type:${station.id}`, `${station.name} needs a configured charger type.`, [station.id]))
    }
    for (const id of station.compatibleTruckTypeIds) {
      const truck = truckById.get(id)
      if (!truck) {
        issues.push(issue(`station-type:${station.id}:${id}`, `${station.name} refers to an unknown forklift type.`, [station.id]))
        continue
      }
      if (station.kind === 'charging') {
        const compatible = truck.energyType === 'electric' && Boolean(station.chargerType) && truck.compatibleChargerTypes.includes(station.chargerType!)
        if (!compatible) issues.push(issue(`station-charge:${station.id}:${id}`, `${station.name} is not configured for ${truck.name}'s energy or charger type.`, [station.id, truck.id]))
      } else if (!truck.batteryType || !station.compatibleBatteryTypes.includes(truck.batteryType)) {
        issues.push(issue(`station-water:${station.id}:${id}`, `${station.name} is not configured for ${truck.name}'s battery-watering type.`, [station.id, truck.id]))
      }
    }
    if (!Number.isInteger(station.serviceCapacity) || station.serviceCapacity <= 0) {
      issues.push(issue(`station-capacity:${station.id}`, `${station.name} needs a positive whole-number simultaneous service capacity.`, [station.id]))
    }
    const needsPower = station.kind === 'charging' || station.requiresPower === true
    const demand = station.kind === 'charging' ? station.chargerPowerKw : station.powerDemandKw
    if (needsPower && (demand === undefined || !Number.isFinite(demand) || demand <= 0)) {
      issues.push(issue(`station-power-demand:${station.id}`, `${station.name} needs a positive configured power demand in kW.`, [station.id]))
    }
  }

  const obstacles: { id: string; name: string; box?: Box; outline?: Point[]; halfWidth?: number }[] = []
  for (const machine of layout.machines) {
    const type = machineTypeFor(machine)
    if (type) obstacles.push({ id: machine.id, name: machine.name ?? type.name, box: bodyBox(type, machine) })
  }
  for (const pillar of layout.pillars) obstacles.push({
    id: pillar.id, name: 'pillar', box: { x: pillar.x - pillar.width / 2, y: pillar.y - pillar.depth / 2, width: pillar.width, depth: pillar.depth },
  })
  for (const wall of layout.walls) obstacles.push({ id: wall.id, name: 'wall', box: wallBox(wall) })
  for (const bay of layout.loadingBays) obstacles.push({ id: bay.id, name: bay.name, outline: bay.outline })

  for (let first = 0; first < layout.parkingSpots.length; first++) {
    for (let second = first + 1; second < layout.parkingSpots.length; second++) {
      if (polygonOverlaps(layout.parkingSpots[first].outline, layout.parkingSpots[second].outline)) {
        issues.push(issue(`parking-overlap:${layout.parkingSpots[first].id}:${layout.parkingSpots[second].id}`, `${layout.parkingSpots[first].name} overlaps ${layout.parkingSpots[second].name}.`, [layout.parkingSpots[first].id, layout.parkingSpots[second].id]))
      }
    }
  }

  for (const route of layout.truckRoutes) {
    if (route.points.length < 2 || !finitePoints(route.points)) {
      issues.push(issue(`route-path:${route.id}`, `${route.name} needs at least two finite path points.`, [route.id]))
      continue
    }
    if (!Number.isFinite(route.usableWidthMm) || route.usableWidthMm <= 0) {
      issues.push(issue(`route-width:${route.id}`, `${route.name} needs a positive usable width.`, [route.id]))
    }
    for (const truckId of route.allowedTruckTypeIds) {
      const truck = truckById.get(truckId)
      if (!truck) {
        issues.push(issue(`route-type:${route.id}:${truckId}`, `${route.name} refers to an unknown forklift type.`, [route.id]))
        continue
      }
      if (truck.widthMm === null || truck.minimumAisleWidthMm === null || truck.turningRadiusMm === null) {
        issues.push(issue(`route-spec:${route.id}:${truck.id}`, `${route.name} cannot be fully checked for ${truck.name}; width, aisle width, and turning radius must be specified.`, [route.id, truck.id]))
        continue
      }
      const requiredWidth = Math.max(truck.widthMm, truck.minimumAisleWidthMm)
      if (route.usableWidthMm > 0 && route.usableWidthMm < requiredWidth) {
        issues.push(issue(`route-fit:${route.id}:${truck.id}`, `${route.name} is ${route.usableWidthMm} mm wide; ${truck.name} requires ${requiredWidth} mm.`, [route.id, truck.id]))
      }
      for (let index = 1; index < route.points.length - 1; index++) {
        const before = route.points[index - 1]
        const corner = route.points[index]
        const after = route.points[index + 1]
        const incoming = { x: corner.x - before.x, y: corner.y - before.y }
        const outgoing = { x: after.x - corner.x, y: after.y - corner.y }
        const lengths = [Math.hypot(incoming.x, incoming.y), Math.hypot(outgoing.x, outgoing.y)]
        if (lengths.some((length) => length <= EPSILON)) continue
        const cosine = Math.max(-1, Math.min(1, (incoming.x * outgoing.x + incoming.y * outgoing.y) / (lengths[0] * lengths[1])))
        const deflection = Math.acos(cosine)
        const tangentDistance = truck.turningRadiusMm * Math.tan(deflection / 2)
        if (!Number.isFinite(tangentDistance) || lengths.some((length) => length + EPSILON < tangentDistance)) {
          issues.push(issue(`route-turn:${route.id}:${truck.id}:${index}`, `${route.name} has a turn that does not provide ${truck.name}'s configured ${truck.turningRadiusMm} mm turning radius.`, [route.id, truck.id]))
        }
      }
    }

    for (const instance of forkliftInstances) {
      if (!route.allowedTruckTypeIds.includes(instance.typeId)) continue
      const truck = truckById.get(instance.typeId)
      const rect = truck && forkliftRect(truck, instance)
      if (!truck || !rect || route.usableWidthMm <= 0) continue
      const footprint = rectCorners(rect)
      for (const segment of segments(route.points)) {
        if (segmentPolygonDistance(segment, footprint) > route.usableWidthMm / 2 + EPSILON) continue
        const heading = Math.atan2(segment.b.y - segment.a.y, segment.b.x - segment.a.x)
        const orientation = instance.rotation * Math.PI / 180
        const delta = orientation - heading
        const crossSection = truck.widthMm! * Math.abs(Math.sin(delta)) + truck.lengthMm! * Math.abs(Math.cos(delta))
        if (crossSection > route.usableWidthMm + EPSILON) {
          issues.push(issue(`route-instance-fit:${route.id}:${instance.id}`, `${route.name} is too narrow for the ${truck.name} footprint in its current orientation (${Math.round(crossSection)} mm required).`, [route.id, instance.id, truck.id]))
          break
        }
      }
    }

    const halfWidth = Math.max(0, route.usableWidthMm) / 2
    if (layout.floorplan && !routeWithinFloor(route.points, halfWidth, layout.floorplan)) {
      issues.push(issue(`route-boundary:${route.id}`, `${route.name} and its usable width must stay inside the factory boundary.`, [route.id]))
    }
    for (const obstacle of obstacles) {
      const blocked = segments(route.points).some((segment) =>
        obstacle.box ? segmentBoxDistance(segment, obstacle.box) < halfWidth - EPSILON
          : obstacle.outline && obstacle.outline.length >= 3 && segmentPolygonDistance(segment, obstacle.outline) < halfWidth - EPSILON)
      if (blocked) issues.push(issue(`route-clearance:${route.id}:${obstacle.id}`, `${route.name} does not have configured clearance from ${obstacle.name}.`, [route.id, obstacle.id]))
    }
    for (const barrier of layout.safetyBarriers) {
      const required = halfWidth + Math.max(0, barrier.thicknessMm) / 2
      if (segments(route.points).some((segment) => barrierCollisionSegments(barrier).some((edge) => segmentDistance(segment, edge) < required - EPSILON))) {
        issues.push(issue(`route-barrier:${route.id}:${barrier.id}`, `${route.name} intersects or lacks clearance from ${barrier.name} (${barrier.purpose}).`, [route.id, barrier.id]))
      }
    }
  }

  for (const pedestrianRoute of layout.pedestrianRoutes) {
    if (pedestrianRoute.points.length < 2 || !finitePoints(pedestrianRoute.points)) {
      issues.push(issue(`pedestrian-path:${pedestrianRoute.id}`, `${pedestrianRoute.name} needs at least two finite path points.`, [pedestrianRoute.id]))
    }
    if (!Number.isFinite(pedestrianRoute.usableWidthMm) || pedestrianRoute.usableWidthMm <= 0) {
      issues.push(issue(`pedestrian-width:${pedestrianRoute.id}`, `${pedestrianRoute.name} needs a positive usable width.`, [pedestrianRoute.id]))
    }
    if (pedestrianRoute.parallel) {
      const source = truckRouteById.get(pedestrianRoute.parallel.truckRouteId)
      const expected = source && parallelRoutePoints(source.points, pedestrianRoute.parallel.side, pedestrianRoute.parallel.offsetMm)
      if (!source || !expected || expected.length !== pedestrianRoute.points.length || expected.some((point, index) => distance(point, pedestrianRoute.points[index]) > 1)) {
        issues.push(issue(`pedestrian-parallel:${pedestrianRoute.id}`, `${pedestrianRoute.name} is not a valid parallel offset from its selected forklift route.`, [pedestrianRoute.id, pedestrianRoute.parallel.truckRouteId]))
      }
    }
  }

  for (const barrier of layout.safetyBarriers) {
    if (barrier.points.length < 2 || !finitePoints(barrier.points) || !Number.isFinite(barrier.thicknessMm) || barrier.thicknessMm <= 0) {
      issues.push(issue(`barrier-shape:${barrier.id}`, `${barrier.name} needs at least two finite path points and a finite positive thickness.`, [barrier.id]))
      continue
    }
    const halfThickness = barrier.thicknessMm / 2
    const barrierSegments = barrierCollisionSegments(barrier)
    for (const machine of layout.machines) {
      const type = machineTypeFor(machine)
      if (!type || barrierSegments.every((segment) => segmentBoxDistance(segment, bodyBox(type, machine)) >= halfThickness - EPSILON)) continue
      issues.push(issue(`barrier-machine:${barrier.id}:${machine.id}`, `${barrier.name} intersects ${machine.name ?? type.name}.`, [barrier.id, machine.id]))
    }
    for (const spot of layout.parkingSpots) {
      if (validPolygon(spot.outline) && barrierCollisionSegments(barrier).some((segment) => segmentPolygonDistance(segment, spot.outline) < halfThickness - EPSILON)) {
        issues.push(issue(`barrier-parking:${barrier.id}:${spot.id}`, `${barrier.name} intersects ${spot.name}; keep parking areas clear of barrier segments.`, [barrier.id, spot.id]))
      }
    }
    if (barrier.protectedTargetId) {
      const targetMachine = layout.machines.find((machine) => machine.id === barrier.protectedTargetId)
      const targetExit = layout.utilities.find((utility) => utility.id === barrier.protectedTargetId && utility.kind === 'exit')
      if (!targetMachine && !targetExit) {
        issues.push(issue(`barrier-target:${barrier.id}`, `${barrier.name} refers to a missing machine or exit.`, [barrier.id]))
      }
      const clearOutline = barrier.keepClearOutline
      if (!clearOutline || !validPolygon(clearOutline)) {
        issues.push(issue(`barrier-keep-clear:${barrier.id}`, `${barrier.name} needs a valid explicit keep-clear outline for its protected target.`, [barrier.id]))
      } else {
        const target = targetMachine ? { x: targetMachine.x, y: targetMachine.y } : targetExit ? { x: targetExit.x, y: targetExit.y } : null
        if (target && !pointInPolygon(target, clearOutline)) {
          issues.push(issue(`barrier-target-area:${barrier.id}`, `${barrier.name}'s keep-clear outline must include its protected target.`, [barrier.id]))
        }
        for (const otherBarrier of layout.safetyBarriers) {
          if (otherBarrier.points.length >= 2 && finitePoints(otherBarrier.points) && barrierCollisionSegments(otherBarrier).some((segment) => segmentPolygonDistance(segment, clearOutline) < Math.max(0, otherBarrier.thicknessMm) / 2 - EPSILON)) {
            issues.push(issue(`barrier-blocks-access:${barrier.id}:${otherBarrier.id}`, `${otherBarrier.name} blocks the protected keep-clear area of ${barrier.name}.`, [barrier.id, otherBarrier.id]))
          }
        }
        for (const machine of layout.machines) {
          if (machine.id === barrier.protectedTargetId) continue
          const type = machineTypeFor(machine)
          if (type && polygonOverlaps(clearOutline, boxCorners(bodyBox(type, machine)))) {
            issues.push(issue(`protected-machine:${barrier.id}:${machine.id}`, `${machine.name ?? type.name} occupies the protected keep-clear area of ${barrier.name}.`, [barrier.id, machine.id]))
          }
        }
        for (const obstacle of obstacles.filter((item) => item.box && item.id !== barrier.protectedTargetId && !layout.machines.some((machine) => machine.id === item.id))) {
          if (polygonOverlaps(clearOutline, boxCorners(obstacle.box!))) {
            issues.push(issue(`protected-obstacle:${barrier.id}:${obstacle.id}`, `${obstacle.name} occupies the protected keep-clear area of ${barrier.name}.`, [barrier.id, obstacle.id]))
          }
        }
        for (const spot of layout.parkingSpots) {
          if (validPolygon(spot.outline) && polygonOverlaps(clearOutline, spot.outline)) {
            issues.push(issue(`protected-parking:${barrier.id}:${spot.id}`, `${spot.name} occupies the protected keep-clear area of ${barrier.name}.`, [barrier.id, spot.id]))
          }
        }
        for (const bay of layout.loadingBays) {
          if (validPolygon(bay.outline) && polygonOverlaps(clearOutline, bay.outline)) {
            issues.push(issue(`protected-loading-bay:${barrier.id}:${bay.id}`, `${bay.name} overlaps the protected keep-clear area of ${barrier.name}.`, [barrier.id, bay.id]))
          }
        }
        for (const route of layout.truckRoutes) {
          if (segments(route.points).some((segment) => segmentPolygonDistance(segment, clearOutline) < route.usableWidthMm / 2 - EPSILON)) {
            issues.push(issue(`protected-route:${barrier.id}:${route.id}`, `${route.name} passes through the protected keep-clear area of ${barrier.name}.`, [barrier.id, route.id]))
          }
        }
      }
    } else if (barrier.keepClearOutline) {
      issues.push(issue(`barrier-area-target:${barrier.id}`, `${barrier.name} has a keep-clear outline but no protected target.`, [barrier.id]))
    }
  }

  for (const truckRoute of layout.truckRoutes) {
    for (const pedestrianRoute of layout.pedestrianRoutes) {
      for (const point of crossingPoints(truckRoute, pedestrianRoute)) {
        const marked = layout.pedestrianCrossings.some((crossing) => crossing.truckRouteId === truckRoute.id &&
          (crossing.pedestrianRouteIds ?? [crossing.pedestrianRouteId]).includes(pedestrianRoute.id) && distance(point, crossing) <= CROSSING_MARK_TOLERANCE_MM)
        if (!marked) issues.push(issue(`unmarked-crossing:${truckRoute.id}:${pedestrianRoute.id}:${Math.round(point.x)}:${Math.round(point.y)}`,
          `${truckRoute.name} crosses ${pedestrianRoute.name} without an explicit pedestrian crossing marker.`, [truckRoute.id, pedestrianRoute.id]))
      }
    }
  }

  for (const crossing of layout.pedestrianCrossings) {
    const truckRoute = truckRouteById.get(crossing.truckRouteId)
    const pedestrianRouteIds = crossing.pedestrianRouteIds ?? [crossing.pedestrianRouteId]
    const pedestrianRoutes = pedestrianRouteIds.map((id) => pedestrianRouteById.get(id))
    if (!truckRoute || pedestrianRoutes.length === 0 || pedestrianRoutes.some((route) => !route)) {
      issues.push(issue(`crossing-routes:${crossing.id}`, `${crossing.name} must reference an existing forklift route and at least one existing pedestrian route.`, [crossing.id]))
      continue
    }
    const onTruckRoute = distanceToPath(crossing, truckRoute.points) <= truckRoute.usableWidthMm / 2 + CROSSING_MARK_TOLERANCE_MM
    const connectsToPedestrianRoute = pedestrianRoutes.some((route) => {
      if (!route || route.parallel?.truckRouteId === truckRoute.id) return Boolean(route)
      return crossingPoints(truckRoute, route).some((point) => distance(point, crossing) <= CROSSING_MARK_TOLERANCE_MM)
    })
    if (!onTruckRoute || !connectsToPedestrianRoute) {
      issues.push(issue(`crossing-position:${crossing.id}`, `${crossing.name} must be on its forklift route and connect to an adjacent pedestrian route.`, [crossing.id, truckRoute.id, ...pedestrianRouteIds]))
    }
  }

  return issues
}

function finitePoints(points: Point[]) {
  return points.every((point) => Number.isFinite(point.x) && Number.isFinite(point.y))
}

export function isValidLogisticsPolygon(outline: Point[]) {
  return validPolygon(outline)
}

function validPolygon(outline: Point[]) {
  if (outline.length < 3 || !finitePoints(outline)) return false
  let area = 0
  for (let index = 0; index < outline.length; index++) {
    const next = outline[(index + 1) % outline.length]
    area += outline[index].x * next.y - next.x * outline[index].y
  }
  if (Math.abs(area) <= EPSILON) return false
  for (let first = 0; first < outline.length; first++) {
    const a = { a: outline[first], b: outline[(first + 1) % outline.length] }
    if (distance(a.a, a.b) <= EPSILON) return false
    for (let second = first + 1; second < outline.length; second++) {
      if (second === first + 1 || first === 0 && second === outline.length - 1) continue
      if (segmentsIntersect(a, { a: outline[second], b: outline[(second + 1) % outline.length] })) return false
    }
  }
  return true
}

function polygonOverlaps(first: Point[], second: Point[]) {
  if (!validPolygon(first) || !validPolygon(second)) return false
  return first.some((point) => pointInPolygon(point, second)) || second.some((point) => pointInPolygon(point, first)) ||
    first.some((point, index) => second.some((other, otherIndex) => segmentsIntersect(
      { a: point, b: first[(index + 1) % first.length] },
      { a: other, b: second[(otherIndex + 1) % second.length] },
    )))
}

function routeWithinFloor(points: Point[], halfWidth: number, floorplan: Floorplan) {
  const outline = floorplan.outline ?? [{ x: 0, y: 0 }, { x: floorplan.width, y: 0 }, { x: floorplan.width, y: floorplan.depth }, { x: 0, y: floorplan.depth }]
  if (!validPolygon(outline)) return false
  const edges = outline.map((point, index) => ({ a: point, b: outline[(index + 1) % outline.length] }))
  return segments(points).every((segment) => pointInPolygon(segment.a, outline) && pointInPolygon(segment.b, outline) &&
    edges.every((edge) => segmentDistance(segment, edge) + EPSILON >= halfWidth))
}

function boundsOf(points: Point[]): Box {
  const xs = points.map((point) => point.x)
  const ys = points.map((point) => point.y)
  const x = Math.min(...xs)
  const y = Math.min(...ys)
  return { x, y, width: Math.max(...xs) - x, depth: Math.max(...ys) - y }
}

function boxCorners(box: Box): Point[] {
  return [
    { x: box.x, y: box.y }, { x: box.x + box.width, y: box.y },
    { x: box.x + box.width, y: box.y + box.depth }, { x: box.x, y: box.y + box.depth },
  ]
}
