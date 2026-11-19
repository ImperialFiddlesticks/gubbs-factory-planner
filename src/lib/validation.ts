import { getMachineType } from '@/data/catalog'
import { EXIT_MAX_DISTANCE, utilityRadius } from '@/data/utilities'
import {
  bodyBox,
  boxesOverlap,
  boxInsideFloor,
  clearanceBox,
  distanceToBox,
  type Box,
} from '@/lib/geometry'
import type { Floorplan, MachineInstance, MachineType, Utility } from '@/types'

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

/** Utilities of a kind that reach the machine's body (nearest edge), closest first. */
function inReach(r: Resolved, utilities: Utility[], kind: Utility['kind']) {
  return utilities
    .filter((u) => u.kind === kind)
    .map((u) => ({ u, d: distanceToBox(u.x, u.y, r.body) }))
    .filter(({ u, d }) => d <= utilityRadius(u))
    .sort((a, b) => a.d - b.d)
}

/**
 * Which power point feeds each machine (its nearest one in reach) and the
 * total load on each power point, kW.
 */
export function powerAssignments(machines: MachineInstance[], utilities: Utility[]) {
  const feeds = new Map<string, string>() // machine id -> power point id
  const loads = new Map<string, number>() // power point id -> kW
  for (const r of resolve(machines)) {
    if (r.type.powerKw <= 0) continue
    const nearest = inReach(r, utilities, 'power')[0]
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
): LayoutIssue[] {
  const resolved = resolve(machines)
  return [...spaceIssues(resolved, floorplan), ...utilityIssues(resolved, machines, utilities)]
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
): LayoutIssue[] {
  const issues: LayoutIssue[] = []
  const exits = utilities.filter((u) => u.kind === 'exit')
  if (resolved.length > 0 && exits.length === 0) {
    issues.push({ key: 'no-exit', category: 'utility', ids: [], message: 'The floor has no exit.' })
  }

  for (const r of resolved) {
    const id = r.machine.id
    const name = r.type.name
    if (r.type.needsWater && inReach(r, utilities, 'water').length === 0) {
      issues.push({ key: `water:${id}`, category: 'utility', need: 'water', ids: [id], message: `${name} has no water point in reach.` })
    }
    if (r.type.needsFireSuppression && inReach(r, utilities, 'sprinkler').length === 0) {
      issues.push({ key: `sprinkler:${id}`, category: 'utility', need: 'sprinkler', ids: [id], message: `${name} is not covered by a sprinkler.` })
    }
    if (r.type.powerKw > 0 && inReach(r, utilities, 'power').length === 0) {
      issues.push({ key: `power:${id}`, category: 'utility', need: 'power', ids: [id], message: `${name} has no power point in reach.` })
    }
    if (exits.length > 0 && !exits.some((e) => distanceToBox(e.x, e.y, r.body) <= EXIT_MAX_DISTANCE)) {
      issues.push({
        key: `exit:${id}`,
        category: 'utility',
        need: 'exit',
        ids: [id],
        message: `${name} is more than ${EXIT_MAX_DISTANCE / 1000} m from an exit.`,
      })
    }
  }

  const { feeds, loads } = powerAssignments(machines, utilities)
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
