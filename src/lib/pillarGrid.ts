import { DEFAULT_PILLAR_SIZE } from '@/data/structures'
import { boxInsideFloor, pillarBox, type FloorBounds } from '@/lib/geometry'
import type { Point } from '@/types'

/** A regular grid of pillars set up in the wizard. Sizes in mm; NaN while a field is being typed. */
export interface PillarGrid {
  enabled: boolean
  /** Centre-to-centre distance along x. */
  spacingX: number
  /** Centre-to-centre distance along y. */
  spacingY: number
  /** Square pillar size. */
  size: number
}

export const DEFAULT_PILLAR_GRID: PillarGrid = {
  enabled: false,
  spacingX: 6000,
  spacingY: 6000,
  size: DEFAULT_PILLAR_SIZE,
}

const positive = (n: number) => Number.isFinite(n) && n > 0

/** Why the grid settings don't work, or null when they do (or the grid is off). */
export function pillarGridError(grid: PillarGrid): string | null {
  if (!grid.enabled) return null
  if (!positive(grid.spacingX) || !positive(grid.spacingY)) return 'Pillar spacing must be greater than 0.'
  if (!positive(grid.size)) return 'Pillar size must be greater than 0.'
  if (grid.size >= Math.min(grid.spacingX, grid.spacingY)) return 'Pillars must be smaller than their spacing.'
  return null
}

/** Evenly spread positions along one side: as many as fit, with equal margins at both ends. */
function axis(length: number, spacing: number): number[] {
  const count = Math.max(1, Math.floor(length / spacing))
  const margin = (length - (count - 1) * spacing) / 2
  return Array.from({ length: count }, (_, i) => Math.round(margin + i * spacing))
}

/** Pillar centres for the grid, leaving out any that would not sit fully on the floor. */
export function pillarGridPositions(floor: FloorBounds, grid: PillarGrid): Point[] {
  if (!grid.enabled || pillarGridError(grid)) return []
  const xs = axis(floor.width, grid.spacingX)
  const ys = axis(floor.depth, grid.spacingY)
  return ys
    .flatMap((y) => xs.map((x) => ({ x, y })))
    .filter((p) => boxInsideFloor(pillarBox({ id: '', ...p, width: grid.size, depth: grid.size }), floor))
}
