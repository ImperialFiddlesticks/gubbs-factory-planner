/**
 * Time estimates for the demo. All figures are MOCK DATA: they show the idea of
 * build-time and production-time estimates, not real Saab numbers.
 */
import { machineTypeFor } from '@/data/catalog'
import type { EquipmentCategoryId } from '@/data/categories'
import type { MachineInstance, Utility, Wall } from '@/types'

/** Working days to install and commission one piece of equipment (mock). */
export const INSTALL_DAYS: Record<EquipmentCategoryId, number> = {
  machining: 5,
  forming: 6,
  welding: 3,
  'material-handling': 1,
  'assembly-packing': 2,
  storage: 0.5,
  support: 1.5,
}

/** Minutes of work per product at one station of each category (mock). */
export const PROCESS_MINUTES: Record<EquipmentCategoryId, number> = {
  machining: 18,
  forming: 9,
  welding: 14,
  'material-handling': 0,
  'assembly-packing': 22,
  storage: 0,
  support: 0,
}

/** The order a product passes through the station categories. */
export const PROCESS_ORDER: EquipmentCategoryId[] = ['machining', 'forming', 'welding', 'assembly-packing']

/** Parts move with a forklift / trolley at this speed, metres per minute (mock). */
export const TRANSPORT_M_PER_MIN = 40
const WORK_HOURS_PER_DAY = 8

export interface BuildPhase {
  name: string
  days: number
}

export interface BuildEstimate {
  phases: BuildPhase[]
  totalDays: number
  weeks: number
}

export function estimateBuild(input: {
  floorAreaM2: number
  machines: MachineInstance[]
  walls: Wall[]
  utilities: Utility[]
  crews: number
}): BuildEstimate {
  const crews = Math.max(1, input.crews)
  const groundwork = 5 + input.floorAreaM2 / 150
  const wallMetres = input.walls.reduce(
    (sum, w) => sum + Math.hypot(w.end.x - w.start.x, w.end.y - w.start.y) / 1000,
    0,
  )
  const walls = wallMetres / 12
  const utilities = 2 + input.utilities.length * 0.5
  const install = input.machines.reduce((sum, m) => {
    const type = machineTypeFor(m)
    return sum + (type ? INSTALL_DAYS[type.category] : 0)
  }, 0)
  const commissioning = 3 + input.machines.length * 0.25
  const phases: BuildPhase[] = [
    { name: 'Groundwork & floor', days: groundwork },
    { name: 'Walls', days: walls },
    { name: 'Power, water & safety', days: utilities },
    { name: 'Install equipment', days: install / crews },
    { name: 'Test & commissioning', days: commissioning },
  ].map((p) => ({ ...p, days: Math.round(p.days * 10) / 10 }))
  const totalDays = Math.round(phases.reduce((s, p) => s + p.days, 0) * 10) / 10
  return { phases, totalDays, weeks: Math.ceil(totalDays / 5) }
}

export interface ProductionStep {
  category: EquipmentCategoryId
  stations: number
  processMinutes: number
  transportMinutes: number
  distanceM: number
}

export interface ProductionEstimate {
  steps: ProductionStep[]
  /** Time for the first product through the line, minutes. */
  leadMinutes: number
  /** Slowest step per product, minutes; sets the pace once the line is full. */
  bottleneckMinutes: number
  bottleneck: EquipmentCategoryId | null
  totalMinutes: number
  totalTransportM: number
  workDays: number
  missing: EquipmentCategoryId[]
}

/**
 * How long a batch takes: the product visits one station of each category in PROCESS_ORDER,
 * always going to the nearest one, so the layout (distances) changes the result.
 */
export function estimateProduction(machines: MachineInstance[], quantity: number): ProductionEstimate {
  const qty = Math.max(1, Math.round(quantity))
  const typed = machines.flatMap((m) => {
    const type = machineTypeFor(m)
    return type ? [{ m, category: type.category }] : []
  })
  const steps: ProductionStep[] = []
  const missing: EquipmentCategoryId[] = []
  let at: { x: number; y: number } | null = null
  for (const category of PROCESS_ORDER) {
    const group = typed.filter((t) => t.category === category)
    if (group.length === 0) {
      missing.push(category)
      continue
    }
    let next = group[0]!.m
    let distanceM = 0
    if (at) {
      const from = at
      const dist = (m: MachineInstance) => Math.hypot(m.x - from.x, m.y - from.y) / 1000
      next = group.reduce((best, t) => (dist(t.m) < dist(best) ? t.m : best), next)
      distanceM = dist(next)
    }
    at = { x: next.x, y: next.y }
    steps.push({
      category,
      stations: group.length,
      processMinutes: PROCESS_MINUTES[category],
      transportMinutes: distanceM / TRANSPORT_M_PER_MIN,
      distanceM,
    })
  }
  const leadMinutes = steps.reduce((s, x) => s + x.processMinutes + x.transportMinutes, 0)
  let bottleneckMinutes = 0
  let bottleneck: EquipmentCategoryId | null = null
  for (const s of steps) {
    const pace = s.processMinutes / s.stations
    if (pace > bottleneckMinutes) {
      bottleneckMinutes = pace
      bottleneck = s.category
    }
  }
  const totalMinutes = steps.length === 0 ? 0 : leadMinutes + (qty - 1) * bottleneckMinutes
  return {
    steps,
    leadMinutes,
    bottleneckMinutes,
    bottleneck,
    totalMinutes,
    totalTransportM: steps.reduce((s, x) => s + x.distanceM, 0),
    workDays: totalMinutes / 60 / WORK_HOURS_PER_DAY,
    missing,
  }
}
