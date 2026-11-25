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

/**
 * Shortest walking distance (mm) from any exit to each machine, by machine id.
 * Infinity when there is no route. Machines are listed by their body box.
 */
export function walkingDistances(
  floor: FloorBounds,
  exits: Point[],
  machines: { id: string; body: Box }[],
  walls: Wall[],
): Map<string, number> {
  const result = new Map<string, number>(machines.map((m) => [m.id, Infinity]))
  if (exits.length === 0 || machines.length === 0) return result

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
  const nodes: Point[] = [...exits]
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
  const dist = nodes.map((_, i) => (i < exits.length ? 0 : Infinity))
  const done = nodes.map(() => false)
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
      if (d < dist[v] && clear(nodes[u], nodes[v])) dist[v] = d
    }
  }

  machines.forEach((m, i) => {
    // Straight from an exit to the machine, when nothing is in the way.
    let best = Infinity
    for (const e of exits) {
      const near = {
        x: Math.min(Math.max(e.x, m.body.x), m.body.x + m.body.width),
        y: Math.min(Math.max(e.y, m.body.y), m.body.y + m.body.depth),
      }
      const own = obstacles[i]
      const others = obstacles.filter((o) => o !== own)
      const blocked =
        others.some((o) => !strictlyInside(e, o.box) && segmentEntersBox(e, near, o.box, 0) !== null) ||
        floorEdges.some(([p, q]) => properlyCross(e, near, p, q))
      if (!blocked) best = Math.min(best, Math.hypot(near.x - e.x, near.y - e.y))
    }
    // Otherwise via one of the points around it, plus the last step to its edge.
    for (const n of machineNodes[i]) {
      best = Math.min(best, dist[n] + distanceToBox(nodes[n].x, nodes[n].y, m.body))
    }
    result.set(m.id, best)
  })
  return result
}
