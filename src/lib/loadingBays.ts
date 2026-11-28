import type { Floorplan, LoadingBay, LoadingDock, Point } from '@/types'
import { floorCorners } from '@/lib/floorShapes'
import { loadingDockSpans } from '@/lib/loadingDocks'

const EPSILON = 1e-6

export const MIN_LOADING_BAY_SIZE_MM = 500
export const LOADING_BAY_DRAW_MARGIN_MM = 5000
export const MAX_LOADING_BAY_DOCK_GAP_MM = 2000

export interface LoadingBayConnection {
  bayPoint: Point
  dockPoint: Point
  distanceMm: number
}

const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y)
const cross = (a: Point, b: Point, c: Point) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x)

function pointOnSegment(point: Point, a: Point, b: Point) {
  return Math.abs(cross(a, b, point)) <= EPSILON &&
    point.x >= Math.min(a.x, b.x) - EPSILON && point.x <= Math.max(a.x, b.x) + EPSILON &&
    point.y >= Math.min(a.y, b.y) - EPSILON && point.y <= Math.max(a.y, b.y) + EPSILON
}

function orientation(a: Point, b: Point, c: Point) {
  const value = cross(a, b, c)
  return Math.abs(value) <= EPSILON ? 0 : value > 0 ? 1 : -1
}

function segmentsIntersect(a: Point, b: Point, c: Point, d: Point) {
  const abC = orientation(a, b, c)
  const abD = orientation(a, b, d)
  const cdA = orientation(c, d, a)
  const cdB = orientation(c, d, b)
  if (abC * abD < 0 && cdA * cdB < 0) return true
  return (abC === 0 && pointOnSegment(c, a, b)) ||
    (abD === 0 && pointOnSegment(d, a, b)) ||
    (cdA === 0 && pointOnSegment(a, c, d)) ||
    (cdB === 0 && pointOnSegment(b, c, d))
}

function intersectionPoint(a: Point, b: Point, c: Point, d: Point): Point | null {
  const denominator = (b.x - a.x) * (d.y - c.y) - (b.y - a.y) * (d.x - c.x)
  if (Math.abs(denominator) <= EPSILON) {
    if (pointOnSegment(a, c, d)) return a
    if (pointOnSegment(b, c, d)) return b
    if (pointOnSegment(c, a, b)) return c
    if (pointOnSegment(d, a, b)) return d
    return null
  }
  const t = ((c.x - a.x) * (d.y - c.y) - (c.y - a.y) * (d.x - c.x)) / denominator
  return { x: a.x + t * (b.x - a.x), y: a.y + t * (b.y - a.y) }
}

function closestOnSegment(point: Point, a: Point, b: Point): Point {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const lengthSquared = dx * dx + dy * dy
  const t = lengthSquared === 0 ? 0 : Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / lengthSquared))
  return { x: a.x + dx * t, y: a.y + dy * t }
}

function pointInPolygon(point: Point, polygon: Point[], includeBoundary = true) {
  let inside = false
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[j]
    const b = polygon[i]
    if (pointOnSegment(point, a, b)) return includeBoundary
    if ((a.y > point.y) !== (b.y > point.y) && point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x) {
      inside = !inside
    }
  }
  return inside
}

function properIntersection(a: Point, b: Point, c: Point, d: Point) {
  return orientation(a, b, c) * orientation(a, b, d) < 0 && orientation(c, d, a) * orientation(c, d, b) < 0
}

function signedPolygonArea(outline: Point[]) {
  return outline.reduce((sum, point, index) => {
    const next = outline[(index + 1) % outline.length]
    return sum + point.x * next.y - next.x * point.y
  }, 0) / 2
}

function polygonArea(outline: Point[]) {
  return Math.abs(signedPolygonArea(outline))
}

export function loadingBayIssue(
  bay: LoadingBay,
  floorplan: Floorplan,
  docks: LoadingDock[],
  otherBays: LoadingBay[] = [],
): string | null {
  if (!bay.name.trim()) return 'Name must not be empty or whitespace.'
  if (bay.outline.length < 3 || bay.outline.some((point) => !Number.isFinite(point.x) || !Number.isFinite(point.y))) {
    return 'The bay outline must have at least three finite points.'
  }
  const area = polygonArea(bay.outline)
  if (new Set(bay.outline.map((point) => `${point.x},${point.y}`)).size < 3 || !Number.isFinite(area) || area <= EPSILON) {
    return 'The bay outline must have positive area and at least three distinct points.'
  }
  const xs = bay.outline.map((point) => point.x)
  const ys = bay.outline.map((point) => point.y)
  if (Math.max(...xs) - Math.min(...xs) < MIN_LOADING_BAY_SIZE_MM || Math.max(...ys) - Math.min(...ys) < MIN_LOADING_BAY_SIZE_MM) {
    return `Loading bays must be at least ${MIN_LOADING_BAY_SIZE_MM / 1000} m wide and deep.`
  }

  for (let i = 0; i < bay.outline.length; i++) {
    const a = bay.outline[i]
    const b = bay.outline[(i + 1) % bay.outline.length]
    if (distance(a, b) <= EPSILON) return 'The bay outline cannot contain zero-length edges.'
    const next = bay.outline[(i + 2) % bay.outline.length]
    const incomingX = b.x - a.x
    const incomingY = b.y - a.y
    const outgoingX = next.x - b.x
    const outgoingY = next.y - b.y
    if (Math.abs(cross(a, b, next)) <= EPSILON && incomingX * outgoingX + incomingY * outgoingY < -EPSILON) {
      return 'The bay outline cannot reverse over the same edge.'
    }
    for (let j = i + 1; j < bay.outline.length; j++) {
      const adjacent = j === i + 1 || (i === 0 && j === bay.outline.length - 1)
      if (adjacent) continue
      if (segmentsIntersect(a, b, bay.outline[j], bay.outline[(j + 1) % bay.outline.length])) {
        return 'The bay outline must not cross itself.'
      }
    }
  }

  if (polygonsOverlap(bay.outline, floorCorners(floorplan))) {
    return 'Loading bays must be placed outside the hall.'
  }

  if (bay.loadingDockId) {
    const dock = docks.find((item) => item.id === bay.loadingDockId)
    if (!dock) return 'The selected loading dock no longer exists.'
    const connection = loadingBayConnection(bay, dock, floorplan)
    if (!connection || connection.distanceMm > MAX_LOADING_BAY_DOCK_GAP_MM) {
      return `The bay must connect to its loading dock within ${MAX_LOADING_BAY_DOCK_GAP_MM / 1000} m.`
    }
  }

  for (const other of otherBays) {
    if (other.id === bay.id || other.outline.length < 3 || other.outline.some((point) => !Number.isFinite(point.x) || !Number.isFinite(point.y))) continue
    if (polygonsOverlap(bay.outline, other.outline)) return `The bay overlaps ${other.name || 'another loading bay'}.`
  }

  return null
}

function polygonsOverlap(first: Point[], second: Point[]) {
  for (let i = 0; i < first.length; i++) {
    const a = first[i]
    const b = first[(i + 1) % first.length]
    for (let j = 0; j < second.length; j++) {
      const c = second[j]
      const d = second[(j + 1) % second.length]
      if (properIntersection(a, b, c, d)) return true
    }
  }

  if (first.some((point) => pointInPolygon(point, second, false)) || second.some((point) => pointInPolygon(point, first, false))) return true
  if (first.some((point, index) => pointInPolygon({ x: (point.x + first[(index + 1) % first.length].x) / 2, y: (point.y + first[(index + 1) % first.length].y) / 2 }, second, false))) return true
  if (collinearInteriorOverlap(first, second)) return true
  return first.length === second.length && first.every((point) => second.some((other) => distance(point, other) <= EPSILON))
}

function collinearInteriorOverlap(first: Point[], second: Point[]) {
  const windingA = Math.sign(signedPolygonArea(first))
  const windingB = Math.sign(signedPolygonArea(second))
  for (let i = 0; i < first.length; i++) {
    const a = first[i]
    const b = first[(i + 1) % first.length]
    const dx = b.x - a.x
    const dy = b.y - a.y
    const length = Math.hypot(dx, dy)
    if (length <= EPSILON) continue
    for (let j = 0; j < second.length; j++) {
      const c = second[j]
      const d = second[(j + 1) % second.length]
      if (Math.abs(cross(a, b, c)) > EPSILON || Math.abs(cross(a, b, d)) > EPSILON) continue
      const direction = dx * (d.x - c.x) + dy * (d.y - c.y)
      if (windingA * windingB * Math.sign(direction) <= 0) continue
      const cProjection = ((c.x - a.x) * dx + (c.y - a.y) * dy) / length
      const dProjection = ((d.x - a.x) * dx + (d.y - a.y) * dy) / length
      const overlap = Math.min(length, Math.max(cProjection, dProjection)) - Math.max(0, Math.min(cProjection, dProjection))
      if (overlap > EPSILON) return true
    }
  }
  return false
}

export function loadingBayConnection(
  bay: Pick<LoadingBay, 'outline'>,
  dock: LoadingDock,
  floorplan: Pick<Floorplan, 'width' | 'depth' | 'outline'>,
): LoadingBayConnection | null {
  const dockSpans = loadingDockSpans(dock, floorplan)
  if (bay.outline.length < 2 || dockSpans.length === 0) return null
  let nearest: LoadingBayConnection | null = null

  for (let i = 0; i < bay.outline.length; i++) {
    const a = bay.outline[i]
    const b = bay.outline[(i + 1) % bay.outline.length]
    for (const span of dockSpans) {
      if (segmentsIntersect(a, b, span.start, span.end)) {
        const intersection = intersectionPoint(a, b, span.start, span.end)
        if (intersection) return { bayPoint: intersection, dockPoint: intersection, distanceMm: 0 }
      }
      for (const [bayPoint, dockPoint] of [
        [closestOnSegment(a, span.start, span.end), a],
        [closestOnSegment(b, span.start, span.end), b],
        [closestOnSegment(span.start, a, b), span.start],
        [closestOnSegment(span.end, a, b), span.end],
      ] as const) {
        const distanceMm = distance(bayPoint, dockPoint)
        if (!nearest || distanceMm < nearest.distanceMm) nearest = { bayPoint, dockPoint, distanceMm }
      }
    }
  }

  return nearest
}

export function loadingBayCentroid(bay: Pick<LoadingBay, 'outline'>): Point {
  return bay.outline.reduce((sum, point) => ({ x: sum.x + point.x / bay.outline.length, y: sum.y + point.y / bay.outline.length }), { x: 0, y: 0 })
}

export function loadingBayBounds(bay: Pick<LoadingBay, 'outline'>) {
  if (!bay.outline.length) return null
  const xs = bay.outline.map((point) => point.x)
  const ys = bay.outline.map((point) => point.y)
  const x = Math.min(...xs)
  const y = Math.min(...ys)
  return { x, y, width: Math.max(...xs) - x, depth: Math.max(...ys) - y }
}

export function loadingBayWorldBounds(floorplan: Floorplan, bays: LoadingBay[]) {
  const points = [
    { x: 0, y: 0 },
    { x: floorplan.width, y: 0 },
    { x: floorplan.width, y: floorplan.depth },
    { x: 0, y: floorplan.depth },
    ...(floorplan.outline ?? []),
    ...bays.flatMap((bay) => bay.outline),
  ]
  const xs = points.map((point) => point.x)
  const ys = points.map((point) => point.y)
  return {
    minX: Math.min(...xs),
    minY: Math.min(...ys),
    maxX: Math.max(...xs),
    maxY: Math.max(...ys),
  }
}
