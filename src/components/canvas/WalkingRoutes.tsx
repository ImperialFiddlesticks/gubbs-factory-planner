import { Group, Label, Line, Tag, Text } from 'react-konva'
import { SCALE } from '@/constants'
import { machineTypeFor } from '@/data/catalog'
import { EXIT_MAX_DISTANCE, UTILITY_KINDS, utilityRadius } from '@/data/utilities'
import { bodyBox } from '@/lib/geometry'
import { extinguisherRoutes } from '@/lib/validation'
import { walkingRoutes, type WalkingRoute } from '@/lib/walking'
import { CANVAS, COLORS, CANVAS_FONT } from '@/theme'
import type { Floorplan, MachineInstance, Utility, Wall } from '@/types'

/** Colours for a route kind: within the limit, and too far. */
const STYLE = {
  exit: { ok: CANVAS.valid, tooFar: CANVAS.invalid },
  // Extinguishers are red already, so a route that is too far is drawn grey with a red tag.
  extinguisher: { ok: UTILITY_KINDS.extinguisher.colour, tooFar: COLORS.charcoal600 },
} as const

/**
 * Dashed walking route from machines to their exit or fire extinguisher, with the distance.
 * With `all` off, only routes touching `focusId` (the machine, or the exit/extinguisher it
 * leads to) are drawn. Machines with no route get no line; their warning covers it.
 */
export function WalkingRoutes({
  kind,
  all,
  focusId,
  machines,
  utilities,
  walls,
  floorplan,
  fit,
}: {
  kind: 'exit' | 'extinguisher'
  all: boolean
  focusId: string | null
  /** Every machine on the floor; they all block routes. */
  machines: MachineInstance[]
  utilities: Utility[]
  walls: Wall[]
  floorplan: Floorplan
  fit: number
}) {
  if (!all && !focusId) return null
  const sources = utilities.filter((u) => u.kind === kind)
  if (sources.length === 0) return null

  const bodies = machines.flatMap((m) => {
    const type = machineTypeFor(m)
    return type ? [{ id: m.id, body: bodyBox(type, m) }] : []
  })
  const routes: { id: string; route: WalkingRoute; limit: number; ok: boolean }[] = []
  if (kind === 'exit') {
    for (const [id, route] of walkingRoutes(floorplan, sources, bodies, walls)) {
      routes.push({ id, route, limit: EXIT_MAX_DISTANCE, ok: route.distance <= EXIT_MAX_DISTANCE })
    }
  } else {
    for (const [id, route] of extinguisherRoutes(floorplan, sources, bodies, walls)) {
      const limit = route.source >= 0 ? utilityRadius(sources[route.source]) : 0
      routes.push({ id, route, limit, ok: route.withinReach })
    }
  }

  const touches = (r: (typeof routes)[number]) =>
    r.id === focusId || (r.route.source >= 0 && sources[r.route.source].id === focusId)
  const shown = routes
    .filter((r) => r.route.path.length >= 2 && (all || touches(r)))
    // Focused routes last, so they are drawn over the others.
    .sort((a, b) => Number(touches(a)) - Number(touches(b)))
  const style = STYLE[kind]

  return (
    <Group listening={false}>
      {shown.map((r) => {
        const strong = touches(r)
        const colour = r.ok ? style.ok : style.tooFar
        const end = r.route.path[r.route.path.length - 1]
        const walked = `${(r.route.distance / 1000).toFixed(1)} m`
        return (
          <Group key={`${kind}-route-${r.id}`} opacity={strong || shown.length === 1 ? 1 : 0.7}>
            <Line
              points={r.route.path.flatMap((p) => [p.x * SCALE, p.y * SCALE])}
              stroke={colour}
              strokeWidth={strong ? 3 : 2}
              strokeScaleEnabled={false}
              dash={kind === 'exit' ? [8, 5] : [3, 5]}
              lineCap="round"
              lineJoin="round"
            />
            {/* Distance tag at the machine end, kept the same size on screen. */}
            {/* Exit tags point down from above, extinguisher tags up from below, so both fit. */}
            <Group x={end.x * SCALE} y={end.y * SCALE} scaleX={1 / fit} scaleY={1 / fit}>
              <Label y={kind === 'exit' ? -4 : 4}>
                <Tag
                  fill={r.ok ? colour : CANVAS.invalid}
                  cornerRadius={3}
                  pointerDirection={kind === 'exit' ? 'down' : 'up'}
                  pointerWidth={8}
                  pointerHeight={5}
                />
                <Text fontFamily={CANVAS_FONT}
                  text={r.ok ? walked : `${walked} > ${r.limit / 1000} m`}
                  fontSize={11}
                  padding={3}
                  fill="white"
                />
              </Label>
            </Group>
          </Group>
        )
      })}
    </Group>
  )
}
