import { floorCorners } from '@/lib/floorShapes'
import type { Floorplan, LoadingDock, Point } from '@/types'

const EPSILON = 1e-6

export const DEFAULT_LOADING_DOCK_WIDTH_MM = 3000
export const DEFAULT_LOADING_DOCK_HEIGHT_MM = 3000
export const DEFAULT_LOADING_DOCK_DEPTH_MM = 1000

type BoundarySegment = {
  start: Point
  end: Point
  startOffset: number
  length: number
}

export interface LoadingDockSpan {
  start: Point
  end: Point
  midpoint: Point
  inward: Point
}

export interface LoadingDockPosition {
  point: Point
  offsetMm: number
  distanceMm: number
}

function boundary(floorplan: Pick<Floorplan, 'width' | 'depth' | 'outline'>) {
  const corners = floorCorners(floorplan)
  const segments: BoundarySegment[] = []
  let perimeter = 0
  let signedArea = 0

  for (let i = 0; i < corners.length; i++) {
    const start = corners[i]
    const end = corners[(i + 1) % corners.length]
    const length = Math.hypot(end.x - start.x, end.y - start.y)
    signedArea += start.x * end.y - end.x * start.y
    if (length <= EPSILON) continue
    segments.push({ start, end, startOffset: perimeter, length })
    perimeter += length
  }

  return { segments, perimeter, orientation: signedArea >= 0 ? 1 : -1 }
}

function normalizedOffset(offset: number, perimeter: number) {
  return ((offset % perimeter) + perimeter) % perimeter
}

function pointOnSegment(segment: BoundarySegment, offset: number): Point {
  const t = Math.min(1, Math.max(0, (offset - segment.startOffset) / segment.length))
  return {
    x: segment.start.x + (segment.end.x - segment.start.x) * t,
    y: segment.start.y + (segment.end.y - segment.start.y) * t,
  }
}

export function loadingDockPerimeter(floorplan: Pick<Floorplan, 'width' | 'depth' | 'outline'>) {
  return boundary(floorplan).perimeter
}

export function loadingDockPointAt(
  floorplan: Pick<Floorplan, 'width' | 'depth' | 'outline'>,
  offsetMm: number,
): Point | null {
  const { segments, perimeter } = boundary(floorplan)
  if (!Number.isFinite(offsetMm) || perimeter <= EPSILON || segments.length === 0) return null
  const offset = normalizedOffset(offsetMm, perimeter)
  const segment = segments.find((item) => offset < item.startOffset + item.length) ?? segments[segments.length - 1]
  return pointOnSegment(segment, offset < segment.startOffset ? offset + perimeter : offset)
}

export function nearestLoadingDockPosition(
  x: number,
  y: number,
  floorplan: Pick<Floorplan, 'width' | 'depth' | 'outline'>,
): LoadingDockPosition | null {
  const { segments, perimeter } = boundary(floorplan)
  let nearest: LoadingDockPosition | null = null

  for (const segment of segments) {
    const dx = segment.end.x - segment.start.x
    const dy = segment.end.y - segment.start.y
    const t = Math.min(1, Math.max(0, ((x - segment.start.x) * dx + (y - segment.start.y) * dy) / (segment.length * segment.length)))
    const point = { x: segment.start.x + t * dx, y: segment.start.y + t * dy }
    const distanceMm = Math.hypot(point.x - x, point.y - y)
    if (!nearest || distanceMm < nearest.distanceMm) {
      const rawOffset = segment.startOffset + t * segment.length
      nearest = {
        point,
        offsetMm: rawOffset >= perimeter - EPSILON ? 0 : rawOffset,
        distanceMm,
      }
    }
  }

  return nearest
}

function dockIntervals(dock: Pick<LoadingDock, 'boundaryOffsetMm' | 'widthMm'>, perimeter: number) {
  const start = normalizedOffset(dock.boundaryOffsetMm - dock.widthMm / 2, perimeter)
  const end = start + dock.widthMm
  return end <= perimeter + EPSILON
    ? [[start, Math.min(end, perimeter)] as const]
    : ([[start, perimeter] as const, [0, end - perimeter] as const])
}

export function loadingDockIssue(
  dock: LoadingDock,
  floorplan: Pick<Floorplan, 'width' | 'depth' | 'outline'>,
  otherDocks: LoadingDock[] = [],
): string | null {
  const perimeter = loadingDockPerimeter(floorplan)
  if (!dock.name.trim()) return 'Name must not be empty or whitespace.'
  if (!Number.isFinite(dock.widthMm) || dock.widthMm <= 0) return 'Opening width must be greater than zero.'
  if (!Number.isFinite(dock.heightMm) || dock.heightMm <= 0) return 'Door height must be greater than zero.'
  if (!Number.isFinite(dock.depthMm) || dock.depthMm <= 0) return 'Door depth must be greater than zero.'
  if (!Number.isFinite(dock.boundaryOffsetMm) || perimeter <= EPSILON || dock.boundaryOffsetMm < 0 || dock.boundaryOffsetMm >= perimeter) {
    return 'The loading dock must be positioned on the floor boundary.'
  }
  if (dock.widthMm > perimeter + EPSILON) return 'Opening width cannot exceed the floor perimeter.'

  const intervals = dockIntervals(dock, perimeter)
  for (const other of otherDocks) {
    if (other.id === dock.id || !Number.isFinite(other.widthMm) || other.widthMm <= 0 || other.widthMm > perimeter) continue
    if (!Number.isFinite(other.boundaryOffsetMm) || other.boundaryOffsetMm < 0 || other.boundaryOffsetMm >= perimeter) continue
    if (intervals.some(([a0, a1]) => dockIntervals(other, perimeter).some(([b0, b1]) => Math.min(a1, b1) - Math.max(a0, b0) > EPSILON))) {
      return `The opening overlaps ${other.name || 'another loading dock'}.`
    }
  }

  return null
}

export function loadingDockSpans(
  dock: Pick<LoadingDock, 'boundaryOffsetMm' | 'widthMm'>,
  floorplan: Pick<Floorplan, 'width' | 'depth' | 'outline'>,
): LoadingDockSpan[] {
  const { segments, perimeter, orientation } = boundary(floorplan)
  if (
    perimeter <= EPSILON ||
    !Number.isFinite(dock.boundaryOffsetMm) ||
    !Number.isFinite(dock.widthMm) ||
    dock.widthMm <= 0 ||
    dock.widthMm > perimeter
  ) return []

  const spans: LoadingDockSpan[] = []
  for (const [rangeStart, rangeEnd] of dockIntervals(dock, perimeter)) {
    for (const segment of segments) {
      const startOffset = Math.max(rangeStart, segment.startOffset)
      const endOffset = Math.min(rangeEnd, segment.startOffset + segment.length)
      if (endOffset - startOffset <= EPSILON) continue

      const start = pointOnSegment(segment, startOffset)
      const end = pointOnSegment(segment, endOffset)
      const dx = segment.end.x - segment.start.x
      const dy = segment.end.y - segment.start.y
      const length = segment.length
      spans.push({
        start,
        end,
        midpoint: { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 },
        inward: { x: (-dy / length) * orientation, y: (dx / length) * orientation },
      })
    }
  }
  return spans
}

export function loadingDockBounds(
  dock: Pick<LoadingDock, 'boundaryOffsetMm' | 'widthMm'>,
  floorplan: Pick<Floorplan, 'width' | 'depth' | 'outline'>,
) {
  const points = loadingDockSpans(dock, floorplan).flatMap((span) => [span.start, span.end])
  if (!points.length) return null
  const xs = points.map((point) => point.x)
  const ys = points.map((point) => point.y)
  const x = Math.min(...xs)
  const y = Math.min(...ys)
  return { x, y, width: Math.max(...xs) - x, depth: Math.max(...ys) - y }
}
