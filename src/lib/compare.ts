import { isStation, machineTypeFor } from '@/data/catalog'
import { conveyorRuns } from '@/lib/conveyors'
import { floorCorners, polygonArea } from '@/lib/floorShapes'
import { bodyBox } from '@/lib/geometry'
import { findLayoutIssues } from '@/lib/validation'
import { walkingRoutes } from '@/lib/walking'
import type { Project } from '@/store'

/** Key figures of a project, for comparing layouts side by side. */
export interface ProjectFigures {
  /** Placed stations (conveyor pieces and storage don't count) and the wizard's target. */
  stations: number
  stationTarget: number
  warnings: number
  /** Floor area, m². */
  floorArea: number
  /** Share of the floor covered by machine bodies, 0–1. */
  floorUsed: number
  /** Longest walk from a machine to its nearest exit, mm (Infinity: a machine has no route; null: no machines or no exits). */
  longestWalk: number | null
  /** Total power demand, kW (a conveyor run counts once, as one drive). */
  powerKw: number
  /** Total conveyor length, mm. */
  conveyorLength: number
}

export function projectFigures(p: Project): ProjectFigures {
  const floorArea = polygonArea(floorCorners(p.floorplan))
  const bodies = p.machines.flatMap((m) => {
    const type = machineTypeFor(m)
    return type ? [{ id: m.id, body: bodyBox(type, m), type }] : []
  })
  const { runs, runOf } = conveyorRuns(p.machines)
  const exits = p.utilities.filter((u) => u.kind === 'exit')
  // People walk from workplaces; belts are left out (as in the exit check).
  const belts = new Set(bodies.filter((b) => b.type.conveyor).map((b) => b.id))
  const walks = [...walkingRoutes(p.floorplan, exits, bodies, p.walls)]
    .filter(([id]) => !belts.has(id))
    .map(([, r]) => r.distance)

  return {
    stations: p.machines.filter((m) => isStation(m.typeId)).length,
    stationTarget: p.setup.stationTarget,
    warnings: findLayoutIssues(p.machines, p.utilities, p.floorplan, { pillars: p.pillars, walls: p.walls, zones: p.zones ?? [] }, p.truckServiceStations ?? [], p.truckTypes ?? []).length,
    floorArea: floorArea / 1e6,
    floorUsed: floorArea > 0 ? bodies.reduce((sum, b) => sum + b.body.width * b.body.depth, 0) / floorArea : 0,
    longestWalk: walks.length && exits.length ? Math.max(...walks) : null,
    powerKw:
      Math.round(
        (bodies.filter((b) => !runOf.has(b.id)).reduce((sum, b) => sum + b.type.powerKw, 0) +
          runs.reduce((sum, r) => sum + r.powerKw, 0) +
          (p.truckServiceStations ?? []).reduce((sum, station) => {
            if (station.kind === 'charging') return sum + (station.chargerPowerKw ?? 0) * station.serviceCapacity
            if (station.requiresPower) return sum + (station.powerDemandKw ?? 0) * station.serviceCapacity
            return sum
          }, 0)) *
          100,
      ) / 100,
    conveyorLength: runs.reduce((sum, r) => sum + r.length, 0),
  }
}
