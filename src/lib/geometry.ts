import type { Clearance, Floorplan, MachineType, Rotation } from '@/types'

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

export type WallSide = 'top' | 'bottom' | 'left' | 'right'

/** The floor edge closest to a point. */
export function nearestWall(x: number, y: number, floorplan: Floorplan): WallSide {
  const d: Record<WallSide, number> = {
    top: Math.abs(y),
    bottom: Math.abs(floorplan.depth - y),
    left: Math.abs(x),
    right: Math.abs(floorplan.width - x),
  }
  return (Object.keys(d) as WallSide[]).reduce((a, b) => (d[b] < d[a] ? b : a))
}

/** Move a point onto the nearest floor edge (used for exits). */
export function snapToWall(x: number, y: number, floorplan: Floorplan) {
  const clampX = Math.min(Math.max(x, 0), floorplan.width)
  const clampY = Math.min(Math.max(y, 0), floorplan.depth)
  switch (nearestWall(x, y, floorplan)) {
    case 'top':
      return { x: clampX, y: 0 }
    case 'bottom':
      return { x: clampX, y: floorplan.depth }
    case 'left':
      return { x: 0, y: clampY }
    case 'right':
      return { x: floorplan.width, y: clampY }
  }
}

export function boxInsideFloor(box: Box, floorplan: Floorplan): boolean {
  return (
    box.x >= 0 &&
    box.y >= 0 &&
    box.x + box.width <= floorplan.width &&
    box.y + box.depth <= floorplan.depth
  )
}
