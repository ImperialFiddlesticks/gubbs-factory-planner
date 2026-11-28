import { conveyorPorts, joined } from '@/lib/conveyors'
import type { MachineInstance, Point, TruckRoute, PedestrianRoute } from '@/types'

export type FlowKind = 'material' | 'worker' | 'truck'
export interface FlowPath { kind: FlowKind; points: Point[]; distances: number[]; length: number; returnTrip: boolean }

function makePath(kind: FlowKind, points: Point[], returnTrip = false): FlowPath | null {
  const distances = [0]
  for (let i = 1; i < points.length; i++) {
    distances.push(distances[i - 1] + Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y))
  }
  const length = distances[distances.length - 1]
  return Number.isFinite(length) && length > 0 ? { kind, points, distances, length, returnTrip } : null
}

export function flowPaths(machines: MachineInstance[], workers: PedestrianRoute[], trucks: TruckRoute[]) {
  const belts = machines.flatMap((machine) => {
    const ports = conveyorPorts(machine)
    return ports ? [ports] : []
  })
  const next = belts.map((belt, i) => belts.findIndex((other, j) => i !== j && joined(belt.out, other.in)))
  const visited = new Set<number>()
  const paths: FlowPath[] = []
  const append = (path: FlowPath | null) => { if (path) paths.push(path) }
  function follow(start: number) {
    const points: Point[] = []
    let i = start
    while (i >= 0 && !visited.has(i)) {
      visited.add(i)
      const belt = belts[i]
      const a = belt.in.point
      const b = belt.out.point
      const control = belt.in.dir.x * belt.out.dir.x + belt.in.dir.y * belt.out.dir.y < 0.5
        ? { x: a.x + belt.in.dir.x * Math.hypot(b.x - a.x, b.y - a.y) / Math.SQRT2,
            y: a.y + belt.in.dir.y * Math.hypot(b.x - a.x, b.y - a.y) / Math.SQRT2 }
        : null
      points.push(a)
      if (control) {
        for (let step = 1; step < 8; step++) {
          const t = step / 8
          const u = 1 - t
          points.push({ x: u * u * a.x + 2 * u * t * control.x + t * t * b.x,
            y: u * u * a.y + 2 * u * t * control.y + t * t * b.y })
        }
      }
      points.push(b)
      i = next[i]
    }
    append(makePath('material', points))
  }
  const hasPredecessor = new Set(next)
  belts.forEach((_, i) => { if (!hasPredecessor.has(i)) follow(i) })
  belts.forEach((_, i) => follow(i))
  workers.forEach((route) => append(makePath('worker', route.points, true)))
  trucks.forEach((route) => append(makePath('truck', route.points, route.direction === 'two-way')))
  return paths
}

export function flowPosition(path: FlowPath, distance: number) {
  const cycle = (path.returnTrip ? 2 : 1) * path.length
  let offset = distance % cycle
  if (offset > path.length) offset = cycle - offset
  const segment = path.distances.findIndex((end, i) => i > 0 && end >= offset && end > path.distances[i - 1])
  if (segment < 1) return path.points[0]
  const a = path.points[segment - 1]
  const b = path.points[segment]
  const t = (offset - path.distances[segment - 1]) / (path.distances[segment] - path.distances[segment - 1])
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }
}

export function trafficCells(paths: FlowPath[], size: number) {
  const cells = new Map<string, { x: number; y: number; count: number }>()
  for (const path of paths) {
    const steps = Math.min(5000, Math.ceil(path.length / (size / 3)))
    let previous = ''
    for (let i = 0; i <= steps; i++) {
      const position = flowPosition(path, Math.min(path.length * i / steps, path.length - 1e-6))
      const x = Math.floor(position.x / size) * size
      const y = Math.floor(position.y / size) * size
      const key = x + ':' + y
      if (key === previous) continue
      previous = key
      const cell = cells.get(key) ?? { x, y, count: 0 }
      cell.count++
      cells.set(key, cell)
    }
  }
  return [...cells.values()]
}
