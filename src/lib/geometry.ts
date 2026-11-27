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

// ---------------------------------------------------------------------------
// Rotated rectangles: a machine's real shape at any angle. The Box helpers above give the
// upright box around it, which is bigger than the machine at angles other than 0/90/180/270.
// ---------------------------------------------------------------------------

/** A rectangle that may be turned: centre, size along its own axes (mm) and rotation (degrees, clockwise). */
export interface Rect {
  cx: number
  cy: number
  width: number
  depth: number
  rotation: Rotation
}

/** Overlaps thinner than this don't count, so pieces that touch don't clash through rounding, mm. */
const OVERLAP_EPS = 1e-6

/** The machine's own rectangle, turned with it. */
export function bodyRect(type: MachineType, p: Placement): Rect {
  return { cx: p.x, cy: p.y, width: type.width, depth: type.depth, rotation: p.rotation }
}

/** The machine's rectangle grown by its clearances (front faces +y at rotation 0), turned with it. */
export function clearanceRect(type: MachineType, p: Placement): Rect {
  const { left, right, front, back } = type.clearance
  // The grown rectangle's centre moves off the machine's centre when the sides differ.
  const c = rotateVector({ x: (right - left) / 2, y: (front - back) / 2 }, p.rotation)
  return {
    cx: p.x + c.x,
    cy: p.y + c.y,
    width: type.width + left + right,
    depth: type.depth + front + back,
    rotation: p.rotation,
  }
}

/** An upright box as a Rect. */
export function boxToRect(b: Box): Rect {
  return { cx: b.x + b.width / 2, cy: b.y + b.depth / 2, width: b.width, depth: b.depth, rotation: 0 }
}

/** Turn a vector clockwise by degrees (y grows down). */
function rotateVector(p: Point, degrees: number): Point {
  const r = (degrees * Math.PI) / 180
  const cos = Math.cos(r)
  const sin = Math.sin(r)
  return { x: cos * p.x - sin * p.y, y: sin * p.x + cos * p.y }
}

/** A rectangle's four corners, in order around it. */
export function rectCorners(r: Rect): Point[] {
  const hw = r.width / 2
  const hd = r.depth / 2
  return [
    { x: -hw, y: -hd },
    { x: hw, y: -hd },
    { x: hw, y: hd },
    { x: -hw, y: hd },
  ].map((p) => {
    const q = rotateVector(p, r.rotation)
    return { x: r.cx + q.x, y: r.cy + q.y }
  })
}

/** A point in the rectangle's own frame (centre at 0, its axes along x/y). */
function toLocal(p: Point, r: Rect): Point {
  return rotateVector({ x: p.x - r.cx, y: p.y - r.cy }, -r.rotation)
}

/**
 * True if the rectangles share any area (separating-axis test). Touching edges, or an
 * overlap thinner than rounding, don't count.
 */
export function rectsOverlap(a: Rect, b: Rect): boolean {
  const ca = rectCorners(a)
  const cb = rectCorners(b)
  for (const r of [a, b]) {
    // Each rectangle's two edge directions are the candidate separating axes.
    for (const axis of [rotateVector({ x: 1, y: 0 }, r.rotation), rotateVector({ x: 0, y: 1 }, r.rotation)]) {
      const project = (ps: Point[]) => ps.map((p) => p.x * axis.x + p.y * axis.y)
      const pa = project(ca)
      const pb = project(cb)
      const overlap = Math.min(Math.max(...pa), Math.max(...pb)) - Math.max(Math.min(...pa), Math.min(...pb))
      if (overlap <= OVERLAP_EPS) return false
    }
  }
  return true
}

/** Shortest distance from a point to the rectangle (0 if inside), mm. */
export function distanceToRect(x: number, y: number, r: Rect): number {
  const p = toLocal({ x, y }, r)
  const dx = Math.max(Math.abs(p.x) - r.width / 2, 0)
  const dy = Math.max(Math.abs(p.y) - r.depth / 2, 0)
  return Math.hypot(dx, dy)
}

/** True if the point is strictly inside the rectangle (not on its edge). */
function pointStrictlyInRect(p: Point, r: Rect): boolean {
  const q = toLocal(p, r)
  return Math.abs(q.x) < r.width / 2 - OVERLAP_EPS && Math.abs(q.y) < r.depth / 2 - OVERLAP_EPS
}

/** The upright box around a rectangle. */
export function rectBounds(r: Rect): Box {
  const cs = rectCorners(r)
  const xs = cs.map((p) => p.x)
  const ys = cs.map((p) => p.y)
  const x = Math.min(...xs)
  const y = Math.min(...ys)
  return { x, y, width: Math.max(...xs) - x, depth: Math.max(...ys) - y }
}

/**
 * True if the whole rectangle lies on the floor: every corner is on the floor and no floor
 * corner pokes into it. At 0/90/180/270 this is the same test as boxInsideFloor.
 */
export function rectInsideFloor(r: Rect, floorplan: FloorBounds): boolean {
  if (r.rotation % 90 === 0) return boxInsideFloor(rectBounds(r), floorplan)
  if (!rectCorners(r).every((c) => pointInFloor(c, floorplan))) return false
  return !floorCorners(floorplan).some((v) => pointStrictlyInRect(v, r))
}

/**
 * Points of a rectangle to test reach against: the point nearest to `from`, the corners and
 * the edge midpoints.
 */
export function rectSamplePoints(r: Rect, from: Point): Point[] {
  const p = toLocal(from, r)
  const hw = r.width / 2
  const hd = r.depth / 2
  const local = [
    { x: Math.min(Math.max(p.x, -hw), hw), y: Math.min(Math.max(p.y, -hd), hd) },
    { x: -hw, y: -hd },
    { x: hw, y: -hd },
    { x: hw, y: hd },
    { x: -hw, y: hd },
    { x: 0, y: -hd },
    { x: hw, y: 0 },
    { x: 0, y: hd },
    { x: -hw, y: 0 },
  ]
  return local.map((q) => {
    const w = rotateVector(q, r.rotation)
    return { x: r.cx + w.x, y: r.cy + w.y }
  })
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
