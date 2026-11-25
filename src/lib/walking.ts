import { floorCorners } from '@/lib/floorShapes'
import {
  distanceToBox,
  pointInFloor,
  segmentEntersBox,
  wallBox,
  type Box,
  type FloorBounds,
} from '@/lib/geometry'
import type { Point, Wall } from '@/types'

/**
 * Walking routes to exits.
 *
 * Machines and internal walls are obstacles, grown by WALK_MARGIN on every side, so a gap
 * narrower than 2 × WALK_MARGIN (0.8 m) is closed. Routes run between the corners of the
 * grown obstacles (a visibility graph), the exits, and points near the floor's corners, and
 * the shortest one is found with Dijkstra from all exits at once.
 */

/** Half the narrowest gap a person can walk through, mm. */
export const WALK_MARGIN = 400
/** Route points sit this far outside a grown obstacle so they don't count as inside it, mm. */
const NUDGE = 1

interface Obstacle {
  box: Box
}

const grow = (b: Box, m: number): Box => ({
  x: b.x - m,
  y: b.y - m,
  width: b.width + 2 * m,
  depth: b.depth + 2 * m,
})

const strictlyInside = (p: Point, b: Box) =>
  p.x > b.x && p.x < b.x + b.width && p.y > b.y && p.y < b.y + b.depth

const corners = (b: Box): Point[] => [
  { x: b.x, y: b.y },
  { x: b.x + b.width, y: b.y },
  { x: b.x + b.width, y: b.y + b.depth },
  { x: b.x, y: b.y + b.depth },
]

/** True if segments p1–p2 and q1–q2 cross at a point inside both (not just touching). */
function properlyCross(p1: Point, p2: Point, q1: Point, q2: Point) {
  const cross = (a: Point, b: Point, c: Point) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x)
  const d1 = cross(q1, q2, p1)
  const d2 = cross(q1, q2, p2)
  const d3 = cross(p1, p2, q1)
  const d4 = cross(p1, p2, q2)
  return d1 * d2 < 0 && d3 * d4 < 0
}

/** A machine's best walk to a source (an exit, an extinguisher). */
export interface WalkingRoute {
  /** Walking length, mm; Infinity when there is no route. */
  distance: number
  /** Index of the source it leads to; -1 when there is no route. */
  source: number
  /** From the source to the machine's edge; empty when there is no route. */
  path: Point[]
}

/**
 * A place people walk from. `allowance` (mm) lets sources with different limits share one
 * search: the best source is the one with the most allowance left, not the nearest.
 */
export interface WalkSource extends Point {
  allowance?: number
}

const NO_ROUTE: WalkingRoute = { distance: Infinity, source: -1, path: [] }

/**
 * Best walking route from the sources to each machine, by machine id: the shortest one, or with
 * allowances, the one leaving the most allowance (walk − allowance smallest).
 * Machines are listed by their body box.
 */
export function walkingRoutes(
  floor: FloorBounds,
  exits: WalkSource[],
  machines: { id: string; body: Box }[],
  walls: Wall[],
): Map<string, WalkingRoute> {
  const result = new Map<string, WalkingRoute>(machines.map((m) => [m.id, NO_ROUTE]))
  if (exits.length === 0 || machines.length === 0) return result
  /** A source's head start: costs are walk − allowance. */
  const start = exits.map((e) => -(e.allowance ?? 0))

  const obstacles: Obstacle[] = [
    ...machines.map((m) => ({ box: grow(m.body, WALK_MARGIN) })),
    ...walls.map((w) => ({ box: grow(wallBox(w), WALK_MARGIN) })),
  ]
  const floorEdges = floor.outline
    ? floorCorners(floor).map((p, i, all) => [p, all[(i + 1) % all.length]] as const)
    : []

  /** A route point is usable if it's on the floor and not inside any grown obstacle. */
  const usable = (p: Point) => pointInFloor(p, floor) && !obstacles.some((o) => strictlyInside(p, o.box))

  // Route points: exits first (the sources), then obstacle corners, then floor-corner helpers.
  const nodes: Point[] = exits.map((e) => ({ x: e.x, y: e.y }))
  /** For each machine, the indexes of its own corner points (where a route can reach it). */
  const machineNodes = machines.map(() => [] as number[])

  obstacles.forEach((o, i) => {
    for (const c of corners(grow(o.box, NUDGE))) {
      if (!usable(c)) continue
      if (i < machines.length) machineNodes[i].push(nodes.length)
      nodes.push(c)
    }
  })
  // Points just inside each floor corner let routes turn around the inner corner of an L-shape.
  if (floor.outline) {
    const d = WALK_MARGIN + NUDGE
    for (const v of floor.outline) {
      for (const [sx, sy] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
        const p = { x: v.x + sx * d, y: v.y + sy * d }
        if (usable(p)) nodes.push(p)
      }
    }
  }

  /** Can someone walk straight from a to b? Exits may sit inside a grown obstacle (a machine near the door). */
  function clear(a: Point, b: Point) {
    for (const o of obstacles) {
      if (strictlyInside(a, o.box) || strictlyInside(b, o.box)) continue
      if (segmentEntersBox(a, b, o.box, 0) !== null) return false
    }
    // On a shaped floor the route must not cut across the outside (e.g. the missing block of an L).
    return !floorEdges.some(([p, q]) => properlyCross(a, b, p, q))
  }

  // Dijkstra over a dense graph; edges are checked lazily as nodes are settled.
  const dist = nodes.map((_, i) => (i < exits.length ? start[i] : Infinity))
  const done = nodes.map(() => false)
  /** The node each one is reached from, for tracing the route back to its exit. */
  const prev = nodes.map(() => -1)
  for (;;) {
    let u = -1
    for (let i = 0; i < nodes.length; i++) {
      if (!done[i] && dist[i] < Infinity && (u === -1 || dist[i] < dist[u])) u = i
    }
    if (u === -1) break
    done[u] = true
    for (let v = 0; v < nodes.length; v++) {
      if (done[v]) continue
      const d = dist[u] + Math.hypot(nodes[v].x - nodes[u].x, nodes[v].y - nodes[u].y)
      if (d < dist[v] && clear(nodes[u], nodes[v])) {
        dist[v] = d
        prev[v] = u
      }
    }
  }

  /** Route points from the source to node n, and that source's index. */
  function trace(n: number) {
    const path: Point[] = []
    let i = n
    for (; prev[i] !== -1; i = prev[i]) path.push(nodes[i])
    path.push(nodes[i])
    return { path: path.reverse(), source: i }
  }

  machines.forEach((m, i) => {
    // Straight from a source to the machine, when nothing is in the way.
    let best = NO_ROUTE
    let bestCost = Infinity
    exits.forEach((e, k) => {
      const near = nearestOnBox(e, m.body)
      const own = obstacles[i]
      const others = obstacles.filter((o) => o !== own)
      const blocked =
        others.some((o) => !strictlyInside(e, o.box) && segmentEntersBox(e, near, o.box, 0) !== null) ||
        floorEdges.some(([p, q]) => properlyCross(e, near, p, q))
      const d = Math.hypot(near.x - e.x, near.y - e.y)
      if (!blocked && start[k] + d < bestCost) {
        bestCost = start[k] + d
        best = { distance: d, source: k, path: [nodes[k], near] }
      }
    })
    // Otherwise via one of the points around it, plus the last step to its edge.
    for (const n of machineNodes[i]) {
      const cost = dist[n] + distanceToBox(nodes[n].x, nodes[n].y, m.body)
      if (cost < bestCost) {
        const { path, source } = trace(n)
        bestCost = cost
        best = { distance: cost - start[source], source, path: [...path, nearestOnBox(nodes[n], m.body)] }
      }
    }
    result.set(m.id, best)
  })
  return result
}

/** The point of box b closest to p. */
function nearestOnBox(p: Point, b: Box): Point {
  return {
    x: Math.min(Math.max(p.x, b.x), b.x + b.width),
    y: Math.min(Math.max(p.y, b.y), b.y + b.depth),
  }
}
