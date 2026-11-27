import { machineTypeFor } from '@/data/catalog'
import { EXIT_MAX_DISTANCE, utilityRadius } from '@/data/utilities'
import {
  bodyBox,
  bodyRect,
  boxInsideFloor,
  boxToRect,
  clearanceRect,
  clearLine,
  distanceToRect,
  pillarBox,
  rectInsideFloor,
  rectSamplePoints,
  rectsOverlap,
  segmentEntersBox,
  wallBox,
  type Box,
  type FloorBounds,
  type Rect,
} from '@/lib/geometry'
import { conveyorMachineLinks, conveyorRuns, type ConveyorRun } from '@/lib/conveyors'
import { machineName } from '@/lib/machineLabels'
import { walkingRoutes, type WalkingRoute } from '@/lib/walking'
import type { Floorplan, MachineInstance, MachineType, Pillar, Point, Utility, Wall } from '@/types'

/**
 * - space:   machines clash with each other or the walls (red outline on the canvas)
 * - utility: a machine is missing a utility, or a utility is overloaded (shown as "needs" badges)
 */
export type IssueCategory = 'space' | 'utility'

/** What is missing, for the "needs" badges above a machine. */
export type Need = 'power' | 'water' | 'sprinkler' | 'extinguisher' | 'exit'

export interface LayoutIssue {
  /** Stable key for React lists. */
  key: string
  category: IssueCategory
  /** Set when the issue is a machine lacking a utility. */
  need?: Need
  /** Machines and/or utilities involved (may be empty for floor-wide issues). */
  ids: string[]
  message: string
}

interface Resolved {
  machine: MachineInstance
  type: MachineType
  /** What warnings call it: its own name or its automatic one ("CNC 02"). */
  name: string
  /** The machine's real shape, turned with it: used for clashes, the floor edge and reach. */
  shape: Rect
  /** Its clearance zone, turned with it. */
  clearance: Rect
  /** The upright box around the shape: used for routing (walking routes, supply lines). */
  body: Box
}

function resolve(machines: MachineInstance[]): Resolved[] {
  const out: Resolved[] = []
  for (const machine of machines) {
    const type = machineTypeFor(machine)
    if (type) {
      out.push({
        machine,
        type,
        name: machineName(machine, machines),
        shape: bodyRect(type, machine),
        clearance: clearanceRect(type, machine),
        body: bodyBox(type, machine),
      })
    }
  }
  return out
}

/**
 * Utilities of a kind that reach the machine's body, closest first. A utility reaches it when
 * some point of the body (nearest point, a corner or an edge midpoint) is within its radius
 * with no internal wall in between. `at` is the closest such point, where a supply line meets it.
 */
function inReach(r: Resolved, utilities: Utility[], kind: Utility['kind'], walls: Wall[]) {
  const out: { u: Utility; d: number; at: Point }[] = []
  for (const u of utilities) {
    if (u.kind !== kind) continue
    const radius = utilityRadius(u)
    if (distanceToRect(u.x, u.y, r.shape) > radius) continue
    // The nearest point comes first; with no walls it is always reachable.
    const reachable = rectSamplePoints(r.shape, u)
      .map((p) => ({ p, d: Math.hypot(p.x - u.x, p.y - u.y) }))
      .filter(({ p, d }) => d <= radius && (walls.length === 0 || clearLine(u, p, walls)))
      .sort((a, b) => a.d - b.d)[0]
    if (reachable) out.push({ u, d: reachable.d, at: reachable.p })
  }
  return out.sort((a, b) => a.d - b.d)
}

/** Which supply a machine type needs from each utility kind (exits are checked separately). */
const NEEDS: Record<Exclude<Utility['kind'], 'exit' | 'extinguisher'>, (t: MachineType) => boolean> = {
  water: (t) => t.needsWater,
  power: (t) => t.powerKw > 0,
  sprinkler: (t) => t.needsFireSuppression,
}

/**
 * A machine fed by a utility: the nearest one of that kind in reach. A conveyor run gets one
 * power line, to whichever of its pieces is nearest a power point.
 */
export interface SupplyLine {
  /** The machine (or conveyor piece) the line ends at. */
  machineId: string
  /** Everything the line supplies: the machine, or every piece of the conveyor run. */
  servedIds: string[]
  /** Load it puts on the utility, kW (power lines). */
  powerKw: number
  utilityId: string
  /** The utility's position. */
  from: Point
  /** Where the line meets the machine's edge. */
  to: Point
  /** Drawn route from the utility to the machine: horizontal/vertical runs with 90° turns. */
  path: Point[]
}

/**
 * One line per machine that needs the kind and has a utility of it in reach; for power, one
 * line per conveyor run (its drive) instead of one per piece.
 */
export function supplyLines(
  machines: MachineInstance[],
  utilities: Utility[],
  kind: keyof typeof NEEDS,
  walls: Wall[],
): SupplyLine[] {
  const lines: SupplyLine[] = []
  const resolved = resolve(machines)
  const bodies = resolved.map((o) => o.body)
  const { runs, runOf } = kind === 'power' ? conveyorRuns(machines) : { runs: [], runOf: new Map<string, ConveyorRun>() }

  const lineTo = (r: Resolved, nearest: ReturnType<typeof inReach>[number], servedIds: string[], powerKw: number) => {
    const from = { x: nearest.u.x, y: nearest.u.y }
    const path = orthogonalRoute(from, r.body, nearest.at, walls, bodies)
    lines.push({ machineId: r.machine.id, servedIds, powerKw, utilityId: nearest.u.id, from, to: path[path.length - 1], path })
  }

  for (const r of resolved) {
    if (runOf.has(r.machine.id) || !NEEDS[kind](r.type)) continue
    const nearest = inReach(r, utilities, kind, walls)[0]
    if (nearest) lineTo(r, nearest, [r.machine.id], r.type.powerKw)
  }
  for (const run of runs) {
    // The run's drive is fed by the power point nearest to any of its pieces.
    let best: { r: Resolved; nearest: ReturnType<typeof inReach>[number] } | null = null
    for (const r of resolved) {
      if (runOf.get(r.machine.id) !== run) continue
      const nearest = inReach(r, utilities, kind, walls)[0]
      if (nearest && (!best || nearest.d < best.nearest.d)) best = { r, nearest }
    }
    if (best) lineTo(best.r, best.nearest, run.pieceIds, run.powerKw)
  }
  return lines
}

/**
 * A pipe/cable route from `from` to the machine body: straight when lined up with the machine,
 * otherwise one 90° turn, entering the middle of the side it faces. The first candidate that
 * crosses no wall or machine is used; `at` (a point the utility can see) is the fallback target.
 */
function orthogonalRoute(from: Point, body: Box, at: Point, walls: Wall[], bodies: Box[]): Point[] {
  const { x, y, width: w, depth: d } = body
  const cx = x + w / 2
  const cy = y + d / 2
  const edgeY = from.y < cy ? y : y + d // top or bottom side, whichever faces the utility
  const edgeX = from.x < cx ? x : x + w // left or right side
  const candidates: Point[][] = []
  if (from.x >= x && from.x <= x + w) candidates.push([from, { x: from.x, y: edgeY }])
  if (from.y >= y && from.y <= y + d) candidates.push([from, { x: edgeX, y: from.y }])
  const viaX = [from, { x: cx, y: from.y }, { x: cx, y: edgeY }] // across, then down/up into the side
  const viaY = [from, { x: from.x, y: cy }, { x: edgeX, y: cy }] // down/up, then across
  candidates.push(...(pathLength(viaX) <= pathLength(viaY) ? [viaX, viaY] : [viaY, viaX]))
  candidates.push([from, { x: at.x, y: from.y }, at], [from, { x: from.x, y: at.y }, at])

  const clearRoute = (path: Point[]) =>
    path.every((p, i) => {
      const q = path[i + 1]
      if (!q) return true
      return clearLine(p, q, walls) && bodies.every((b) => segmentEntersBox(p, q, b) === null)
    })
  return withoutRepeats(candidates.find(clearRoute) ?? candidates[0])
}

const pathLength = (path: Point[]) =>
  path.reduce((sum, p, i) => (i === 0 ? 0 : sum + Math.hypot(p.x - path[i - 1].x, p.y - path[i - 1].y)), 0)

/** Drops points equal to the one before (a zero-length run). */
const withoutRepeats = (path: Point[]) =>
  path.filter((p, i) => i === 0 || p.x !== path[i - 1].x || p.y !== path[i - 1].y)

/**
 * Which power point feeds each machine (its nearest one in reach) and the
 * total load on each power point, kW.
 */
export function powerAssignments(machines: MachineInstance[], utilities: Utility[], walls: Wall[]) {
  const feeds = new Map<string, string>() // machine id -> power point id
  const loads = new Map<string, number>() // power point id -> kW
  for (const line of supplyLines(machines, utilities, 'power', walls)) {
    for (const id of line.servedIds) feeds.set(id, line.utilityId)
    loads.set(line.utilityId, Math.round(((loads.get(line.utilityId) ?? 0) + line.powerKw) * 100) / 100)
  }
  return { feeds, loads }
}

/**
 * Space rules ("Standard"):
 * - a body may not overlap another body;
 * - a body may not sit in another machine's clearance (either way round);
 * - body and clearance must stay inside the floor.
 * Two clearance zones may overlap (a shared aisle). Pieces of one conveyor run don't block each
 * other's clearance (nor does a belt joined to a machine's front), and a run is powered as one
 * drive (see supplyLines).
 *
 * Structure rules (pillars and internal walls):
 * - a body may not overlap a structure;
 * - a structure may not sit in a machine's clearance;
 * - a structure must be inside the floor.
 * Structures touching each other or utilities are not checked (normal in a building).
 *
 * Utility rules (reach is measured to the nearest edge of the machine):
 * - needsWater -> a water point in reach;
 * - needsFireSuppression -> a sprinkler in reach;
 * - powerKw > 0 -> a power point in reach, and no power point over capacity;
 * - at least one exit, and every machine within EXIT_MAX_DISTANCE walk of one;
 * - at least one fire extinguisher, and every machine within the walking distance of one.
 */
export function findLayoutIssues(
  machines: MachineInstance[],
  utilities: Utility[],
  floorplan: Floorplan,
  structures: Structures,
): LayoutIssue[] {
  const resolved = resolve(machines)
  const { runs, runOf } = conveyorRuns(machines)
  const boxes: StructureBox[] = [
    ...structures.pillars.map((p) => ({ id: p.id, noun: 'pillar' as const, box: pillarBox(p) })),
    ...structures.walls.map((w) => ({ id: w.id, noun: 'wall' as const, box: wallBox(w) })),
  ]
  return [
    ...spaceIssues(resolved, floorplan, runOf, conveyorMachineLinks(machines)),
    ...structureIssues(resolved, boxes, floorplan),
    ...utilityIssues(resolved, machines, utilities, structures.walls, floorplan, runs, runOf),
  ]
}

/** The fixed parts of the building that the layout checks take into account. */
export interface Structures {
  pillars: Pillar[]
  walls: Wall[]
}

interface StructureBox {
  id: string
  /** For messages: "a pillar", "a wall". */
  noun: 'pillar' | 'wall'
  box: Box
}

function structureIssues(resolved: Resolved[], structures: StructureBox[], floorplan: Floorplan): LayoutIssue[] {
  const issues: LayoutIssue[] = []
  for (const s of structures) {
    if (!boxInsideFloor(s.box, floorplan)) {
      issues.push({ key: `${s.noun}-out:${s.id}`, category: 'space', ids: [s.id], message: `A ${s.noun} is outside the floor.` })
    }
    const structure = boxToRect(s.box)
    for (const r of resolved) {
      const ids = [r.machine.id, s.id]
      const key = ids.join('|')
      if (rectsOverlap(r.shape, structure)) {
        issues.push({ key: `${s.noun}-on:${key}`, category: 'space', ids, message: `${r.name} stands on a ${s.noun}.` })
      } else if (rectsOverlap(r.clearance, structure)) {
        issues.push({ key: `${s.noun}-clear:${key}`, category: 'space', ids, message: `A ${s.noun} blocks the clearance of ${r.name}.` })
      }
    }
  }
  return issues
}

function spaceIssues(
  resolved: Resolved[],
  floorplan: Floorplan,
  runOf: Map<string, ConveyorRun>,
  linked: (a: string, b: string) => boolean,
): LayoutIssue[] {
  const issues: LayoutIssue[] = []
  for (const r of resolved) {
    const id = r.machine.id
    if (!rectInsideFloor(r.shape, floorplan)) {
      issues.push({ key: `out:${id}`, category: 'space', ids: [id], message: `${r.name} is outside the floor.` })
    } else if (!rectInsideFloor(r.clearance, floorplan)) {
      issues.push({ key: `edge:${id}`, category: 'space', ids: [id], message: `${r.name} needs more space from the wall.` })
    }
  }

  for (let i = 0; i < resolved.length; i++) {
    for (let j = i + 1; j < resolved.length; j++) {
      const a = resolved[i]
      const b = resolved[j]
      const ids = [a.machine.id, b.machine.id]
      const key = ids.join('|')
      // Pieces of one conveyor run sit end to end: they may not overlap, but don't block each other.
      // Likewise a belt joined to a machine's front.
      const noClash =
        (runOf.has(a.machine.id) && runOf.get(a.machine.id) === runOf.get(b.machine.id)) ||
        linked(a.machine.id, b.machine.id)
      if (rectsOverlap(a.shape, b.shape)) {
        issues.push({ key: `overlap:${key}`, category: 'space', ids, message: `${a.name} overlaps ${b.name}.` })
      } else if (noClash) {
        continue
      } else if (rectsOverlap(a.shape, b.clearance)) {
        issues.push({ key: `clear:${key}`, category: 'space', ids, message: `${a.name} blocks the clearance of ${b.name}.` })
      } else if (rectsOverlap(b.shape, a.clearance)) {
        issues.push({ key: `clear:${key}`, category: 'space', ids, message: `${b.name} blocks the clearance of ${a.name}.` })
      }
    }
  }

  return issues
}

function utilityIssues(
  resolved: Resolved[],
  machines: MachineInstance[],
  utilities: Utility[],
  walls: Wall[],
  floorplan: Floorplan,
  runs: ConveyorRun[],
  runOf: Map<string, ConveyorRun>,
): LayoutIssue[] {
  const issues: LayoutIssue[] = []
  // Who gets power: a machine, or every piece of a conveyor run through its drive.
  const powered = new Set(supplyLines(machines, utilities, 'power', walls).flatMap((l) => l.servedIds))
  for (const run of runs) {
    if (run.powerKw > 0 && !powered.has(run.id)) {
      const what = run.pieceIds.length > 1 ? 'Conveyor run' : 'Conveyor'
      issues.push({ key: `power-run:${run.id}`, category: 'utility', need: 'power', ids: run.pieceIds, message: `${what} has no power point in reach.` })
    }
  }
  const exits = utilities.filter((u) => u.kind === 'exit')
  if (resolved.length > 0 && exits.length === 0) {
    issues.push({ key: 'no-exit', category: 'utility', ids: [], message: 'The floor has no exit.' })
  }
  const extinguishers = utilities.filter((u) => u.kind === 'extinguisher')
  if (resolved.length > 0 && extinguishers.length === 0) {
    issues.push({ key: 'no-extinguisher', category: 'utility', ids: [], message: 'The floor has no fire extinguisher.' })
  }
  // Walking distance around machines and internal walls, not a straight line.
  const bodies = resolved.map((r) => ({ id: r.machine.id, body: r.body }))
  const walk = walkingRoutes(floorplan, exits, bodies, walls)
  const toExtinguisher = extinguisherRoutes(floorplan, extinguishers, bodies, walls)

  for (const r of resolved) {
    const id = r.machine.id
    const name = r.name
    if (r.type.needsWater && inReach(r, utilities, 'water', walls).length === 0) {
      issues.push({ key: `water:${id}`, category: 'utility', need: 'water', ids: [id], message: `${name} has no water point in reach.` })
    }
    if (r.type.needsFireSuppression && inReach(r, utilities, 'sprinkler', walls).length === 0) {
      issues.push({ key: `sprinkler:${id}`, category: 'utility', need: 'sprinkler', ids: [id], message: `${name} is not covered by a sprinkler.` })
    }
    if (r.type.powerKw > 0 && !runOf.has(id) && !powered.has(id)) {
      issues.push({ key: `power:${id}`, category: 'utility', need: 'power', ids: [id], message: `${name} has no power point in reach.` })
    }
    const walked = walk.get(id)?.distance ?? Infinity
    if (exits.length > 0 && walked > EXIT_MAX_DISTANCE) {
      issues.push({
        key: `exit:${id}`,
        category: 'utility',
        need: 'exit',
        ids: [id],
        message:
          walked === Infinity
            ? `${name} has no walking route to an exit.`
            : `${name} is more than ${EXIT_MAX_DISTANCE / 1000} m walk from an exit.`,
      })
    }
    const ext = toExtinguisher.get(id)
    if (extinguishers.length > 0 && !ext?.withinReach) {
      issues.push({
        key: `extinguisher:${id}`,
        category: 'utility',
        need: 'extinguisher',
        ids: [id],
        message:
          !ext || ext.distance === Infinity
            ? `${name} has no walking route to a fire extinguisher.`
            : `${name} is more than ${metres(utilityRadius(extinguishers[ext.source]))} m walk from a fire extinguisher.`,
      })
    }
  }

  const { feeds, loads } = powerAssignments(machines, utilities, walls)
  for (const u of utilities) {
    const load = loads.get(u.id) ?? 0
    if (u.kind === 'power' && u.capacityKw !== undefined && load > u.capacityKw) {
      const fed = [...feeds].filter(([, p]) => p === u.id).map(([m]) => m)
      issues.push({
        key: `overload:${u.id}`,
        category: 'utility',
        ids: [u.id, ...fed],
        message: `Power point overloaded: ${load} of ${u.capacityKw} kW.`,
      })
    }
  }

  return issues
}

/**
 * Each machine's walk to the extinguisher that best covers it (the one with the most of its
 * walking distance to spare), and whether that is within the extinguisher's distance.
 */
export function extinguisherRoutes(
  floorplan: FloorBounds,
  extinguishers: Utility[],
  bodies: { id: string; body: Box }[],
  walls: Wall[],
) {
  const sources = extinguishers.map((u) => ({ x: u.x, y: u.y, allowance: utilityRadius(u) }))
  const out = new Map<string, WalkingRoute & { withinReach: boolean }>()
  for (const [id, route] of walkingRoutes(floorplan, sources, bodies, walls)) {
    const limit = route.source >= 0 ? sources[route.source].allowance : 0
    out.set(id, { ...route, withinReach: route.distance <= limit })
  }
  return out
}

/** Metres for messages, without trailing zeros (25, 12.5). */
const metres = (mm: number) => String(Math.round(mm / 100) / 10)

/** IDs of every machine/utility in at least one issue of the category. */
export function idsWithIssues(issues: LayoutIssue[], category: IssueCategory): Set<string> {
  return new Set(issues.filter((i) => i.category === category).flatMap((i) => i.ids))
}

/** For each machine id, the utilities it is missing. */
export function needsByMachine(issues: LayoutIssue[]): Map<string, Need[]> {
  const out = new Map<string, Need[]>()
  for (const issue of issues) {
    if (!issue.need) continue
    const id = issue.ids[0]
    out.set(id, [...(out.get(id) ?? []), issue.need])
  }
  return out
}
