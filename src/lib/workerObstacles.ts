import { machineTypeFor } from '@/data/catalog'
import { bodyRect, boxToRect, pillarBox, rectCorners, wallBox } from '@/lib/geometry'
import type { Obstacle } from '@/lib/workerSafety'
import type { MachineInstance, Pillar, Wall } from '@/types'

/** Machines, walls and pillars as obstacles for the worker-safety checks (same as Worker view). */
export function layoutObstacles(machines: MachineInstance[], walls: Wall[], pillars: Pillar[]): Obstacle[] {
  return [
    ...machines.flatMap((m) => {
      const type = machineTypeFor(m)
      if (!type) return []
      const hazard = type.category === 'welding' || type.category === 'forming' || type.category === 'machining' ? type.category : undefined
      return [{ name: m.name ?? type.shortName, corners: rectCorners(bodyRect(type, m)), hazard }]
    }),
    ...walls.map((w) => ({ name: 'a wall', corners: rectCorners(boxToRect(wallBox(w))) })),
    ...pillars.map((p) => ({ name: 'a pillar', corners: rectCorners(boxToRect(pillarBox(p))) })),
  ]
}
