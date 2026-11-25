import type { Point } from '@/types'

/** Shapes the setup wizard can create. All sizes in mm. */
export type FloorShape =
  | { kind: 'rectangle'; width: number; depth: number }
  /** Rectangle with its top-right corner cut off at 45°. */
  | { kind: 'chamfer'; width: number; depth: number; chamfer: number }
  /** Rectangle with a block missing from its top-right corner. */
  | { kind: 'l-shape'; width: number; depth: number; notchWidth: number; notchDepth: number }

export type FloorShapeKind = FloorShape['kind']

/** Starting sizes for each shape (30 × 20 m hall). */
export const DEFAULT_SHAPES: { [K in FloorShapeKind]: Extract<FloorShape, { kind: K }> } = {
  rectangle: { kind: 'rectangle', width: 30000, depth: 20000 },
  chamfer: { kind: 'chamfer', width: 30000, depth: 20000, chamfer: 6000 },
  'l-shape': { kind: 'l-shape', width: 30000, depth: 20000, notchWidth: 12000, notchDepth: 8000 },
}

const positive = (n: number) => Number.isFinite(n) && n > 0

/** Why the sizes don't make a valid floor, or null when they do. */
export function shapeError(shape: FloorShape): string | null {
  const { width, depth } = shape
  if (!positive(width) || !positive(depth)) return 'Width and depth must be greater than 0.'
  if (shape.kind === 'chamfer') {
    if (!positive(shape.chamfer)) return 'The cut-off corner must be greater than 0.'
    if (shape.chamfer >= Math.min(width, depth))
      return 'The cut-off corner must be smaller than both width and depth.'
  }
  if (shape.kind === 'l-shape') {
    if (!positive(shape.notchWidth) || !positive(shape.notchDepth))
      return 'The missing corner must be greater than 0.'
    if (shape.notchWidth >= width || shape.notchDepth >= depth)
      return 'The missing corner must be smaller than the floor.'
  }
  return null
}

/** Clockwise corners from the top-left, or undefined for a plain rectangle. */
export function shapeOutline(shape: FloorShape): Point[] | undefined {
  const { width: w, depth: d } = shape
  switch (shape.kind) {
    case 'rectangle':
      return undefined
    case 'chamfer':
      return [
        { x: 0, y: 0 },
        { x: w - shape.chamfer, y: 0 },
        { x: w, y: shape.chamfer },
        { x: w, y: d },
        { x: 0, y: d },
      ]
    case 'l-shape':
      return [
        { x: 0, y: 0 },
        { x: w - shape.notchWidth, y: 0 },
        { x: w - shape.notchWidth, y: shape.notchDepth },
        { x: w, y: shape.notchDepth },
        { x: w, y: d },
        { x: 0, y: d },
      ]
  }
}

/** The floor's corners, falling back to its rectangle when there is no outline. */
export function floorCorners(floor: { width: number; depth: number; outline?: Point[] }): Point[] {
  return (
    floor.outline ?? [
      { x: 0, y: 0 },
      { x: floor.width, y: 0 },
      { x: floor.width, y: floor.depth },
      { x: 0, y: floor.depth },
    ]
  )
}

/** Shoelace area, mm². */
export function polygonArea(points: Point[]) {
  let sum = 0
  points.forEach((p, i) => {
    const q = points[(i + 1) % points.length]
    sum += p.x * q.y - q.x * p.y
  })
  return Math.abs(sum) / 2
}
