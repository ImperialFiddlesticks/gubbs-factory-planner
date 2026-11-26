import { floorCorners } from '@/lib/floorShapes'
import type { Floorplan, MachineType, Pillar, Point, Rotation, Wall } from '@/types'

/** Axis-aligned rectangle on the floor, mm. (x, y) is the top-left corner. */
export interface Box {
  x: number
  y: number
  width: number
  depth: number
}

/** Where a machine is (or would be): centre point in mm plus rotation. */
export interface Placement {
  x: number
  y: number
  rotation: Rotation
}

/** Footprint (mm) of a machine type after rotation. */
export function footprint(type: MachineType, rotation: Rotation) {
    const radians = (rotation * Math.PI) / 180
    const cos = Math.abs(Math.cos(radians))
    const sin = Math.abs(Math.sin(radians))

    return{
        width: cos * type.width + sin * type.depth,
        depth: sin * type.width + cos * type.depth,
    }
}

/** The machine's own rectangle. */
export function bodyBox(type: MachineType, p: Placement): Box {
  const size = footprint(type, p.rotation)
  return { x: p.x - size.width / 2, y: p.y - size.depth / 2, ...size }
}

/** A pillar's rectangle. */
export function pillarBox(p: Pillar): Box {
  return { x: p.x - p.width / 2, y: p.y - p.depth / 2, width: p.width, depth: p.depth }
}

/** Make `end` line up with `start` horizontally or vertically, whichever is closer. */
export function straightenWall(start: Point, end: Point): Point {
  return Math.abs(end.x - start.x) >= Math.abs(end.y - start.y)
    ? { x: end.x, y: start.y }
    : { x: start.x, y: end.y }
}

/** Length of a wall's centre line, mm. */
export function wallLength(w: Pick<Wall, 'start' | 'end'>) {
  return Math.hypot(w.end.x - w.start.x, w.end.y - w.start.y)
}

/** A wall's rectangle: its centre line grown by half the thickness on every side (square ends). */
export function wallBox(w: Pick<Wall, 'start' | 'end' | 'thickness'>): Box {
  const half = w.thickness / 2
  const x = Math.min(w.start.x, w.end.x) - half
  const y = Math.min(w.start.y, w.end.y) - half
  return {
    x,
    y,
    width: Math.abs(w.end.x - w.start.x) + w.thickness,
    depth: Math.abs(w.end.y - w.start.y) + w.thickness,
  }
}

/**
 * Which side of the plan each clearance ends up on.
 * At rotation 0 the machine's front faces +y (down on the plan) and its left
 * side is -x. Rotation is clockwise.
 */
// export function clearanceMargins(c: Clearance, rotation: Rotation) {
//   switch (rotation) {
//     case 0:
//       return { top: c.back, right: c.right, bottom: c.front, left: c.left }
//     case 90:
//       return { top: c.left, right: c.back, bottom: c.right, left: c.front }
//     case 180:
//       return { top: c.front, right: c.left, bottom: c.back, left: c.right }
//     case 270:
//       return { top: c.right, right: c.front, bottom: c.left, left: c.back }
//   }
// }

/** The machine's rectangle grown by its clearances. */
export function clearanceBox(type: MachineType, p: Placement): Box {
  const radians = (p.rotation * Math.PI) / 180
  const cos = Math.cos(radians)
  const sin = Math.sin(radians)
  const absCos = Math.abs(cos)
  const absSin = Math.abs(sin)

  const outerWidth = type.width + type.clearance.left + type.clearance.right
  const outerDepth = type.depth + type.clearance.front + type.clearance.back

  const localOffsetX = (type.clearance.right - type.clearance.left) / 2
  const localOffsetY = (type.clearance.front - type.clearance.back) / 2

  const centerX = p.x + cos * localOffsetX - sin * localOffsetY
  const centerY = p.y + sin * localOffsetX + cos * localOffsetY

  const width = absCos * outerWidth + absSin * outerDepth
  const depth = absSin * outerWidth + absCos * outerDepth

  return {
    x: centerX - width / 2,
    y: centerY - depth / 2,
    width,
    depth,
  }
}

/** True if the boxes share any area. Touching edges do not count. */
export function boxesOverlap(a: Box, b: Box): boolean {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.depth && b.y < a.y + a.depth
}

/** Shortest distance from a point to a box (0 if the point is inside), mm. */
export function distanceToBox(x: number, y: number, box: Box): number {
  const dx = Math.max(box.x - x, 0, x - (box.x + box.width))
  const dy = Math.max(box.y - y, 0, y - (box.y + box.depth))
  return Math.hypot(dx, dy)
}

/** The parts of a floor that the wall helpers need; lets them run before a Floorplan exists. */
export type FloorBounds = Pick<Floorplan, 'width' | 'depth' | 'outline'>

/** Rounding slack for "on the wall" tests, mm. */
const EPS = 1e-6

/** The floor's walls as segments, following its outline (or rectangle). */
function walls(floorplan: FloorBounds): [Point, Point][] {
  const c = floorCorners(floorplan)
  return c.map((p, i) => [p, c[(i + 1) % c.length]])
}

/** Closest point to (x, y) on the segment a–b. */
function closestOnSegment(x: number, y: number, a: Point, b: Point): Point {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const len2 = dx * dx + dy * dy
  const t = len2 === 0 ? 0 : Math.min(1, Math.max(0, ((x - a.x) * dx + (y - a.y) * dy) / len2))
  return { x: a.x + t * dx, y: a.y + t * dy }
}

/** The wall closest to a point: where on it, and its direction in degrees (0 = along +x). */
export function nearestWall(x: number, y: number, floorplan: FloorBounds) {
  let best = { point: { x, y }, angle: 0, distance: Infinity }
  for (const [a, b] of walls(floorplan)) {
    const point = closestOnSegment(x, y, a, b)
    const distance = Math.hypot(point.x - x, point.y - y)
    if (distance < best.distance) {
      best = { point, angle: (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI, distance }
    }
  }
  return best
}

/** Move a point onto the nearest wall (used for exits). */
export function snapToWall(x: number, y: number, floorplan: FloorBounds): Point {
  return nearestWall(x, y, floorplan).point
}

/** True if the point is inside the floor or on its wall. */
export function pointInFloor(p: Point, floorplan: FloorBounds): boolean {
  const ws = walls(floorplan)
  // On a wall counts as inside.
  if (ws.some(([a, b]) => {
    const q = closestOnSegment(p.x, p.y, a, b)
    return Math.hypot(q.x - p.x, q.y - p.y) <= EPS
  })) return true
  // Even-odd ray cast towards +x.
  let inside = false
  for (const [a, b] of ws) {
    if (a.y > p.y !== b.y > p.y) {
      const xCross = a.x + ((p.y - a.y) * (b.x - a.x)) / (b.y - a.y)
      if (p.x < xCross) inside = !inside
    }
  }
  return inside
}

/**
 * True if the whole box lies on the floor. For a shaped floor: every box corner is
 * on the floor and no floor corner pokes into the box (which catches the inner
 * corner of an L-shape cutting across it).
 */
export function boxInsideFloor(box: Box, floorplan: FloorBounds): boolean {
  if (!floorplan.outline) {
    return (
      box.x >= 0 &&
      box.y >= 0 &&
      box.x + box.width <= floorplan.width &&
      box.y + box.depth <= floorplan.depth
    )
  }
  const corners: Point[] = [
    { x: box.x, y: box.y },
    { x: box.x + box.width, y: box.y },
    { x: box.x + box.width, y: box.y + box.depth },
    { x: box.x, y: box.y + box.depth },
  ]
  if (!corners.every((c) => pointInFloor(c, floorplan))) return false
  return !floorplan.outline.some(
    (v) =>
      v.x > box.x + EPS &&
      v.x < box.x + box.width - EPS &&
      v.y > box.y + EPS &&
      v.y < box.y + box.depth - EPS,
  )
}

/**
 * Where the segment a→b first enters the box, as a fraction 0..1 along it, or null if it
 * misses. The box is shrunk by `inset` so a segment that only touches its edge doesn't count.
 * (Liang–Barsky clipping.)
 */
export function segmentEntersBox(a: Point, b: Point, box: Box, inset = 1): number | null {
  const minX = box.x + inset
  const maxX = box.x + box.width - inset
  const minY = box.y + inset
  const maxY = box.y + box.depth - inset
  if (minX >= maxX || minY >= maxY) return null
  const dx = b.x - a.x
  const dy = b.y - a.y
  let t0 = 0
  let t1 = 1
  const edges: [number, number][] = [
    [-dx, a.x - minX],
    [dx, maxX - a.x],
    [-dy, a.y - minY],
    [dy, maxY - a.y],
  ]
  for (const [p, q] of edges) {
    if (p === 0) {
      if (q < 0) return null // parallel to this edge and outside it
      continue
    }
    const t = q / p
    if (p < 0) {
      if (t > t1) return null
      if (t > t0) t0 = t
    } else {
      if (t < t0) return null
      if (t < t1) t1 = t
    }
  }
  return t0
}

/** True if no wall stands between the two points. */
export function clearLine(a: Point, b: Point, walls: Wall[]): boolean {
  return !walls.some((w) => segmentEntersBox(a, b, wallBox(w)) !== null)
}

/** Points on a box used for line-of-sight checks: nearest point to `from`, corners, edge midpoints. */
export function samplePoints(box: Box, from: Point): Point[] {
  const { x, y, width: w, depth: d } = box
  const nearest = {
    x: Math.min(Math.max(from.x, x), x + w),
    y: Math.min(Math.max(from.y, y), y + d),
  }
  return [
    nearest,
    { x, y },
    { x: x + w, y },
    { x: x + w, y: y + d },
    { x, y: y + d },
    { x: x + w / 2, y },
    { x: x + w, y: y + d / 2 },
    { x: x + w / 2, y: y + d },
    { x, y: y + d / 2 },
  ]
}

/** Rays cast for a coverage shape; enough for a smooth outline at planner zoom levels. */
const COVERAGE_RAYS = 180

/**
 * The area a utility at `origin` covers within `radius`, cut off behind walls: a polygon of
 * ray end points, or null when no wall is in range (draw a plain circle).
 */
export function coverageShape(origin: Point, radius: number, walls: Wall[]): Point[] | null {
  const near = walls.filter(
    (w) => distanceToBox(origin.x, origin.y, wallBox(w)) < radius,
  )
  if (near.length === 0) return null
  const boxes = near.map(wallBox)
  return Array.from({ length: COVERAGE_RAYS }, (_, i) => {
    const angle = (i / COVERAGE_RAYS) * Math.PI * 2
    const end = { x: origin.x + Math.cos(angle) * radius, y: origin.y + Math.sin(angle) * radius }
    let t = 1
    for (const box of boxes) {
      // inset 0: the shadow should start right at the wall's face.
      const hit = segmentEntersBox(origin, end, box, 0)
      if (hit !== null && hit < t) t = hit
    }
    return { x: origin.x + (end.x - origin.x) * t, y: origin.y + (end.y - origin.y) * t }
  })
}
