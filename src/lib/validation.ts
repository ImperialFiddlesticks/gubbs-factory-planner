import { getMachineType } from '@/data/catalog'
import { EXIT_MAX_DISTANCE, utilityRadius } from '@/data/utilities'
import {
  bodyBox,
  boxesOverlap,
  boxInsideFloor,
  clearanceBox,
  clearLine,
  distanceToBox,
  pillarBox,
  samplePoints,
  wallBox,
  type Box,
} from '@/lib/geometry'
import { walkingDistances } from '@/lib/walking'
import type { Floorplan, MachineInstance, MachineType, Pillar, Utility, Wall } from '@/types'

/**
 * - space:   machines clash with each other or the walls (red outline on the canvas)
 * - utility: a machine is missing a utility, or a utility is overloaded (shown as "needs" badges)
 */
export type IssueCategory = 'space' | 'utility'

/** What is missing, for the "needs" badges above a machine. */
export type Need = 'power' | 'water' | 'sprinkler' | 'exit'

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
  body: Box
  clearance: Box
}

function resolve(machines: MachineInstance[]): Resolved[] {
  const out: Resolved[] = []
  for (const machine of machines) {
    const type = getMachineType(machine.typeId)
    if (type) out.push({ machine, type, body: bodyBox(type, machine), clearance: clearanceBox(type, machine) })
  }
  return out
}

/**
 * Utilities of a kind that reach the machine's body, closest first. A utility reaches it when
 * some point of the body (nearest point, a corner or an edge midpoint) is within its radius
 * with no internal wall in between.
 */
function inReach(r: Resolved, utilities: Utility[], kind: Utility['kind'], walls: Wall[]) {
  return utilities
    .filter((u) => u.kind === kind)
    .map((u) => ({ u, d: distanceToBox(u.x, u.y, r.body) }))
    .filter(({ u, d }) => {
      const radius = utilityRadius(u)
      if (d > radius) return false
      if (walls.length === 0) return true
      return samplePoints(r.body, u).some(
        (p) => Math.hypot(p.x - u.x, p.y - u.y) <= radius && clearLine(u, p, walls),
      )
    })
    .sort((a, b) => a.d - b.d)
}

/**
 * Which power point feeds each machine (its nearest one in reach) and the
 * total load on each power point, kW.
 */
export function powerAssignments(machines: MachineInstance[], utilities: Utility[], walls: Wall[]) {
  const feeds = new Map<string, string>() // machine id -> power point id
  const loads = new Map<string, number>() // power point id -> kW
  for (const r of resolve(machines)) {
    if (r.type.powerKw <= 0) continue
    const nearest = inReach(r, utilities, 'power', walls)[0]
    if (!nearest) continue
    feeds.set(r.machine.id, nearest.u.id)
    loads.set(nearest.u.id, (loads.get(nearest.u.id) ?? 0) + r.type.powerKw)
  }
  return { feeds, loads }
}

/**
 * Space rules ("Standard"):
 * - a body may not overlap another body;
 * - a body may not sit in another machine's clearance (either way round);
 * - body and clearance must stay inside the floor.
 * Two clearance zones may overlap (a shared aisle).
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
 * - at least one exit, and every machine within EXIT_MAX_DISTANCE of one.
 */
export function findLayoutIssues(
  machines: MachineInstance[],
  utilities: Utility[],
  floorplan: Floorplan,
  structures: Structures,
): LayoutIssue[] {
  const resolved = resolve(machines)
  const boxes: StructureBox[] = [
    ...structures.pillars.map((p) => ({ id: p.id, noun: 'pillar' as const, box: pillarBox(p) })),
    ...structures.walls.map((w) => ({ id: w.id, noun: 'wall' as const, box: wallBox(w) })),
  ]
  return [
    ...spaceIssues(resolved, floorplan),
    ...structureIssues(resolved, boxes, floorplan),
    ...utilityIssues(resolved, machines, utilities, structures.walls, floorplan),
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
    for (const r of resolved) {
      const ids = [r.machine.id, s.id]
      const key = ids.join('|')
      if (boxesOverlap(r.body, s.box)) {
        issues.push({ key: `${s.noun}-on:${key}`, category: 'space', ids, message: `${r.type.name} stands on a ${s.noun}.` })
      } else if (boxesOverlap(r.clearance, s.box)) {
        issues.push({ key: `${s.noun}-clear:${key}`, category: 'space', ids, message: `A ${s.noun} blocks the clearance of ${r.type.name}.` })
      }
    }
  }
  return issues
}

function spaceIssues(resolved: Resolved[], floorplan: Floorplan): LayoutIssue[] {
  const issues: LayoutIssue[] = []
  for (const r of resolved) {
    const id = r.machine.id
    if (!boxInsideFloor(r.body, floorplan)) {
      issues.push({ key: `out:${id}`, category: 'space', ids: [id], message: `${r.type.name} is outside the floor.` })
    } else if (!boxInsideFloor(r.clearance, floorplan)) {
      issues.push({ key: `edge:${id}`, category: 'space', ids: [id], message: `${r.type.name} needs more space from the wall.` })
    }
  }

  for (let i = 0; i < resolved.length; i++) {
    for (let j = i + 1; j < resolved.length; j++) {
      const a = resolved[i]
      const b = resolved[j]
      const ids = [a.machine.id, b.machine.id]
      const key = ids.join('|')
      if (boxesOverlap(a.body, b.body)) {
        issues.push({ key: `overlap:${key}`, category: 'space', ids, message: `${a.type.name} overlaps ${b.type.name}.` })
      } else if (boxesOverlap(a.body, b.clearance)) {
        issues.push({ key: `clear:${key}`, category: 'space', ids, message: `${a.type.name} blocks the clearance of ${b.type.name}.` })
      } else if (boxesOverlap(b.body, a.clearance)) {
        issues.push({ key: `clear:${key}`, category: 'space', ids, message: `${b.type.name} blocks the clearance of ${a.type.name}.` })
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
): LayoutIssue[] {
  const issues: LayoutIssue[] = []
  const exits = utilities.filter((u) => u.kind === 'exit')
  if (resolved.length > 0 && exits.length === 0) {
    issues.push({ key: 'no-exit', category: 'utility', ids: [], message: 'The floor has no exit.' })
  }
  // Walking distance around machines and internal walls, not a straight line.
  const walk = walkingDistances(
    floorplan,
    exits,
    resolved.map((r) => ({ id: r.machine.id, body: r.body })),
    walls,
  )

  for (const r of resolved) {
    const id = r.machine.id
    const name = r.type.name
    if (r.type.needsWater && inReach(r, utilities, 'water', walls).length === 0) {
      issues.push({ key: `water:${id}`, category: 'utility', need: 'water', ids: [id], message: `${name} has no water point in reach.` })
    }
    if (r.type.needsFireSuppression && inReach(r, utilities, 'sprinkler', walls).length === 0) {
      issues.push({ key: `sprinkler:${id}`, category: 'utility', need: 'sprinkler', ids: [id], message: `${name} is not covered by a sprinkler.` })
    }
    if (r.type.powerKw > 0 && inReach(r, utilities, 'power', walls).length === 0) {
      issues.push({ key: `power:${id}`, category: 'utility', need: 'power', ids: [id], message: `${name} has no power point in reach.` })
    }
    const walked = walk.get(id) ?? Infinity
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
