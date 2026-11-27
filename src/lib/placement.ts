import { machineTypeFor } from '@/data/catalog'
import { bodyBox, bodyRect, rectInsideFloor, type FloorBounds } from '@/lib/geometry'
import type { MachineInstance, Point } from '@/types'

/**
 * Keeping machines on the floor while they are placed or dragged.
 *
 * `machines` are where they start; `shift` is how far the person is trying to move them all.
 * Returns the shift reduced so every machine's body stays inside the floor's outer walls (it
 * slides along a wall rather than going through it), or null when that isn't possible on a
 * shaped floor (e.g. the cut-out corner of an L) — then the caller keeps the last good spot.
 * A group bigger than the floor itself isn't held back, so it can still be moved.
 */
export function keepOnFloor(machines: MachineInstance[], shift: Point, floor: FloorBounds): Point | null {
  const placed = machines.flatMap((m) => {
    const type = machineTypeFor(m)
    return type ? [{ m, type }] : []
  })
  if (placed.length === 0) return shift

  // Slide along the floor's bounding rectangle: limit the shift so the bodies' outer edges stay in.
  const boxes = placed.map(({ m, type }) => bodyBox(type, m))
  const minX = Math.min(...boxes.map((b) => b.x))
  const minY = Math.min(...boxes.map((b) => b.y))
  const maxX = Math.max(...boxes.map((b) => b.x + b.width))
  const maxY = Math.max(...boxes.map((b) => b.y + b.depth))
  const clamp = (v: number, lo: number, hi: number) => (lo > hi ? v : Math.min(Math.max(v, lo), hi))
  const dx = clamp(shift.x, -minX, floor.width - maxX)
  const dy = clamp(shift.y, -minY, floor.depth - maxY)

  // A shaped floor has corners cut out of that rectangle: check the real shapes against it.
  if (floor.outline) {
    const fits = placed.every(({ m, type }) => rectInsideFloor(bodyRect(type, { ...m, x: m.x + dx, y: m.y + dy }), floor))
    if (!fits) return null
  }
  return { x: dx, y: dy }
}
