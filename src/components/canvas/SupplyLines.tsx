import { Circle, Group, Label, Line, Tag, Text } from 'react-konva'
import { SCALE } from '@/constants'
import { UTILITY_KINDS } from '@/data/utilities'
import { powerAssignments, supplyLines } from '@/lib/validation'
import { CANVAS } from '@/theme'
import type { MachineInstance, Utility, Wall } from '@/types'

/**
 * Solid horizontal/vertical runs from each utility of a kind to the machines it feeds (water pipes, power wires).
 * With `all` off, only the lines touching `focusId` (a machine or the utility) are drawn.
 */
export function SupplyLines({
  kind,
  all,
  focusId,
  machines,
  utilities,
  walls,
  fit,
}: {
  kind: 'water' | 'power'
  all: boolean
  focusId: string | null
  machines: MachineInstance[]
  utilities: Utility[]
  walls: Wall[]
  fit: number
}) {
  if (!all && !focusId) return null
  const lines = supplyLines(machines, utilities, kind, walls).filter(
    (l) => all || l.machineId === focusId || l.utilityId === focusId,
  )
  if (lines.length === 0) return null
  const colour = UTILITY_KINDS[kind].colour

  return (
    <Group listening={false}>
      {lines.map((l) => {
        const strong = l.machineId === focusId || l.utilityId === focusId
        return (
          <Group key={`${kind}-${l.machineId}`} opacity={strong ? 1 : 0.75}>
            <Line
              points={l.path.flatMap((p) => [p.x * SCALE, p.y * SCALE])}
              stroke={colour}
              strokeWidth={strong ? 3 : 2}
              strokeScaleEnabled={false}
              lineCap="round"
              lineJoin="round"
            />
            {/* Connection dot where the line meets the machine. */}
            <Circle
              x={l.to.x * SCALE}
              y={l.to.y * SCALE}
              radius={4 / fit}
              fill={colour}
              stroke="white"
              strokeWidth={1.5}
              strokeScaleEnabled={false}
            />
          </Group>
        )
      })}
    </Group>
  )
}

/**
 * Load tag above each power point, e.g. "42 / 63 kW"; red when overloaded.
 * With `all` off, only the focused power point gets one.
 */
export function PowerLoadTags({
  all,
  focusId,
  machines,
  utilities,
  walls,
  fit,
}: {
  all: boolean
  focusId: string | null
  machines: MachineInstance[]
  utilities: Utility[]
  walls: Wall[]
  fit: number
}) {
  const points = utilities.filter((u) => u.kind === 'power' && (all || u.id === focusId))
  if (points.length === 0) return null
  const { loads } = powerAssignments(machines, utilities, walls)

  return (
    <Group listening={false}>
      {points.map((u) => {
        const load = loads.get(u.id) ?? 0
        const over = u.capacityKw !== undefined && load > u.capacityKw
        const text = u.capacityKw === undefined ? `${load} kW` : `${load} / ${u.capacityKw} kW`
        return (
          // Kept the same size on screen, just above the icon.
          <Group key={`load-${u.id}`} x={u.x * SCALE} y={u.y * SCALE} scaleX={1 / fit} scaleY={1 / fit}>
            <Label y={-ICON_GAP}>
              <Tag
                fill={over ? CANVAS.invalid : UTILITY_KINDS.power.colour}
                cornerRadius={3}
                pointerDirection="down"
                pointerWidth={8}
                pointerHeight={5}
              />
              <Text text={text} fontSize={11} fontStyle="bold" padding={3} fill="white" />
            </Label>
          </Group>
        )
      })}
    </Group>
  )
}

/** Gap from a utility's centre to the tip of a tag above it, px (icon radius + a little). */
const ICON_GAP = 14
