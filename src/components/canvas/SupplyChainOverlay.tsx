import { Group, Rect } from 'react-konva'
import { SCALE } from '@/constants'
import { machineTypeFor } from '@/data/catalog'
import type { MachineInstance } from '@/types'
import { useSupplyChain } from '@/lib/supplyChainStore'
import { getMaterial, stationStatus, type StationStatus } from '@/lib/supplyChain'

const STATUS_COLOURS: Record<StationStatus, string> = {
  normal: '#22c55e', blocked: '#ef4444', alternative: '#3b82f6',
}

/** Coloured halos over machines while the simulator is open. Draw-only; never moves anything. */
export function SupplyChainOverlay({ machines }: { machines: MachineInstance[] }) {
  const { open, materialId, delayDays, useAlternative } = useSupplyChain()
  if (!open) return null
  const material = getMaterial(materialId)
  return (
    <Group listening={false}>
      {machines.map((m) => {
        const type = machineTypeFor(m)
        if (!type || type.conveyor) return null
        const colour = STATUS_COLOURS[stationStatus(type.category, material, delayDays, useAlternative)]
        const w = type.width * SCALE + 10
        const h = type.depth * SCALE + 10
        return (
          <Group key={m.id} x={m.x * SCALE} y={m.y * SCALE} rotation={m.rotation}>
            <Rect x={-w / 2} y={-h / 2} width={w} height={h} cornerRadius={6} stroke={colour} strokeWidth={4} fill={colour + '33'} />
          </Group>
        )
      })}
    </Group>
  )
}
