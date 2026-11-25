import { floorCorners } from '@/lib/floorShapes'
import type { Clearance, Floorplan, MachineType, Point, Rotation } from '@/types'

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
  const sideways = rotation === 90 || rotation === 270
  return sideways
    ? { width: type.depth, depth: type.width }
    : { width: type.width, depth: type.depth }
}

/** The machine's own rectangle. */
export function bodyBox(type: MachineType, p: Placement): Box {
  const size = footprint(type, p.rotation)
  return { x: p.x - size.width / 2, y: p.y - size.depth / 2, ...size }
}

/**
 * Which side of the plan each clearance ends up on.
 * At rotation 0 the machine's front faces +y (down on the plan) and its left
 * side is -x. Rotation is clockwise.
 */
export function clearanceMargins(c: Clearance, rotation: Rotation) {
  switch (rotation) {
    case 0:
      return { top: c.back, right: c.right, bottom: c.front, left: c.left }
    case 90:
      return { top: c.left, right: c.back, bottom: c.right, left: c.front }
    case 180:
      return { top: c.front, right: c.left, bottom: c.back, left: c.right }
    case 270:
      return { top: c.right, right: c.front, bottom: c.left, left: c.back }
  }
}

/** The machine's rectangle grown by its clearances. */
export function clearanceBox(type: MachineType, p: Placement): Box {
  const body = bodyBox(type, p)
  const m = clearanceMargins(type.clearance, p.rotation)
  return {
    x: body.x - m.left,
    y: body.y - m.top,
    width: body.width + m.left + m.right,
    depth: body.depth + m.top + m.bottom,
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

/** Rounding slack for "on the wall" tests, mm. */
const EPS = 1e-6

/** The floor's walls as segments, following its outline (or rectangle). */
function walls(floorplan: Floorplan): [Point, Point][] {
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
export function nearestWall(x: number, y: number, floorplan: Floorplan) {
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
export function snapToWall(x: number, y: number, floorplan: Floorplan): Point {
  return nearestWall(x, y, floorplan).point
}

/** True if the point is inside the floor or on its wall. */
export function pointInFloor(p: Point, floorplan: Floorplan): boolean {
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
export function boxInsideFloor(box: Box, floorplan: Floorplan): boolean {
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
