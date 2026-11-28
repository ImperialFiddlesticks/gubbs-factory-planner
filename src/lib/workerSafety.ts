import type { PedestrianRoute, Point, TruckRoute } from '@/types'
import { crossingPoints } from '@/lib/truckLogistics'

/** An obstacle the worker can bump into, as a floor polygon (mm). */
export interface Obstacle { name: string; corners: Point[]; hazard?: 'welding' | 'forming' | 'machining' }

export type RiskKind = 'vehicle-crossing' | 'vehicle-close' | 'tight-passage' | 'hazard-zone' | 'blind-corner'
export interface WorkerRisk {
  kind: RiskKind
  severity: 'high' | 'medium'
  point: Point
  /** Distance along the walk where the risk is, mm. */
  at: number
  message: string
}

/** Free space under this between the walkway centre and an obstacle is a tight passage, mm. */
export const TIGHT_PASSAGE_MM = 600
/** Walking closer than this to a forklift route (without crossing it) is a risk, mm. */
export const VEHICLE_CLOSE_MM = 1500
/** Walking closer than this to welding, forming or machining equipment is a hazard-zone risk, mm. */
export const HAZARD_ZONE_MM = 1500
/** A turn sharper than this next to an obstacle is a blind corner, degrees. */
export const BLIND_TURN_DEG = 60
/** An obstacle within this of a sharp turn blocks the view around it, mm. */
export const BLIND_OBSTACLE_MM = 1200

const SAMPLE_MM = 250

function segDist(p: Point, a: Point, b: Point) {
  const dx = b.x - a.x, dy = b.y - a.y
  const len = dx * dx + dy * dy
  const t = len ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len)) : 0
  return Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy)
}
function inside(p: Point, poly: Point[]) {
  let hit = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j]
    if ((a.y > p.y) !== (b.y > p.y) && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) hit = !hit
  }
  return hit
}
export function polygonDistance(p: Point, poly: Point[]) {
  if (inside(p, poly)) return 0
  let best = Infinity
  for (let i = 0; i < poly.length; i++) best = Math.min(best, segDist(p, poly[i], poly[(i + 1) % poly.length]))
  return best
}
function polylineDistance(p: Point, line: Point[]) {
  let best = Infinity
  for (let i = 1; i < line.length; i++) best = Math.min(best, segDist(p, line[i - 1], line[i]))
  return best
}

/** Points along the walk every SAMPLE_MM with their distance from the start. */
function samples(points: Point[]) {
  const out: { p: Point; at: number }[] = []
  let at = 0
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1], b = points[i]
    const len = Math.hypot(b.x - a.x, b.y - a.y)
    const steps = Math.max(1, Math.ceil(len / SAMPLE_MM))
    for (let s = i === 1 ? 0 : 1; s <= steps; s++) {
      const t = s / steps
      out.push({ p: { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }, at: at + len * t })
    }
    at += len
  }
  return out
}

/** Safety risks a worker meets walking along a pedestrian route, ordered along the walk. */
export function workerRisks(route: PedestrianRoute, obstacles: Obstacle[], trucks: TruckRoute[]): WorkerRisk[] {
  const risks: WorkerRisk[] = []
  const walk = samples(route.points)
  const atPoint = (q: Point) => walk.reduce((best, s) => (Math.hypot(s.p.x - q.x, s.p.y - q.y) < Math.hypot(best.p.x - q.x, best.p.y - q.y) ? s : best), walk[0]!).at

  for (const truck of trucks) {
    const crossings = crossingPoints(truck, route)
    for (const point of crossings) {
      risks.push({ kind: 'vehicle-crossing', severity: 'high', point, at: atPoint(point), message: `Crosses ${truck.name}. Look out for forklifts and mark the crossing.` })
    }
    // Walking alongside the route without crossing it.
    let reported = false
    for (const s of walk) {
      if (crossings.some((c) => Math.hypot(c.x - s.p.x, c.y - s.p.y) < VEHICLE_CLOSE_MM * 2)) continue
      const gap = polylineDistance(s.p, truck.points) - truck.usableWidthMm / 2
      if (!reported && gap < VEHICLE_CLOSE_MM) {
        reported = true
        risks.push({ kind: 'vehicle-close', severity: 'medium', point: s.p, at: s.at, message: `Walks within ${(Math.max(0, gap) / 1000).toFixed(1)} m of ${truck.name}. A barrier would separate people and forklifts.` })
      }
    }
  }

  for (const o of obstacles) {
    let tight: { p: Point; at: number; gap: number } | null = null
    let hazard: { p: Point; at: number } | null = null
    for (const s of walk) {
      const gap = polygonDistance(s.p, o.corners)
      if (gap < TIGHT_PASSAGE_MM && (!tight || gap < tight.gap)) tight = { ...s, gap }
      if (o.hazard && gap < HAZARD_ZONE_MM && !hazard) hazard = s
    }
    if (tight) risks.push({ kind: 'tight-passage', severity: tight.gap < TIGHT_PASSAGE_MM / 2 ? 'high' : 'medium', point: tight.p, at: tight.at, message: `Tight passage at ${o.name}: only ${(tight.gap / 1000).toFixed(1)} m free.` })
    if (hazard) risks.push({ kind: 'hazard-zone', severity: o.hazard === 'welding' ? 'high' : 'medium', point: hazard.p, at: hazard.at, message: `Passes close to ${o.name} (${o.hazard}). Consider screens or protective equipment.` })
  }

  let along = 0
  for (let i = 1; i < route.points.length - 1; i++) {
    const a = route.points[i - 1]!, b = route.points[i]!, c = route.points[i + 1]!
    along += Math.hypot(b.x - a.x, b.y - a.y)
    const turn = Math.abs(Math.atan2(c.y - b.y, c.x - b.x) - Math.atan2(b.y - a.y, b.x - a.x)) * 180 / Math.PI
    const angle = turn > 180 ? 360 - turn : turn
    const blocker = obstacles.find((o) => polygonDistance(b, o.corners) < BLIND_OBSTACLE_MM)
    if (angle > BLIND_TURN_DEG && blocker) {
      risks.push({ kind: 'blind-corner', severity: 'medium', point: b, at: along, message: `Blind corner by ${blocker.name}. Hard to see who is coming; a mirror would help.` })
    }
  }
  return risks.sort((x, y) => x.at - y.at)
}
