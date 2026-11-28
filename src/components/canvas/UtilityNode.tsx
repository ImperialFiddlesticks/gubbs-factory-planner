import { useRef } from 'react'
import Konva from 'konva'
import { Circle, Group, Line, Path, Rect } from 'react-konva'
import { clickItem, dragGroup, pressItem, setCursor, type DragState } from '@/components/canvas/shared'
import { SCALE } from '@/constants'
import { EXIT_WIDTH, UTILITY_KINDS, utilityRadius } from '@/data/utilities'
import { coverageShape, nearestWall, snapToWall } from '@/lib/geometry'
import { usePlanner } from '@/store'
import { CANVAS, COLORS } from '@/theme'
import type { Floorplan, Utility, UtilityKind, Wall } from '@/types'

/** On-screen radius of a utility icon, px (kept constant when the floor is scaled to fit). */
const ICON_R = 11

/** A placed utility: icon (and door, for exits). Draggable; exits slide along the walls. */
export function UtilityNode({
  utility,
  floorplan,
  fit,
  selected,
  invalid,
  interactive,
  onDrag,
}: {
  utility: Utility
  floorplan: Floorplan
  fit: number
  selected: boolean
  /** e.g. an overloaded power point. */
  invalid: boolean
  interactive: boolean
  onDrag: (drag: DragState | null) => void
}) {
  const moveUtility = usePlanner((s) => s.moveUtility)
  const moveItems = usePlanner((s) => s.moveItems)
  /** Set on drag start: where it started and what moves with it (see dragGroup). */
  const drag = useRef<{ from: { x: number; y: number }; group: string[] }>({ from: { x: 0, y: 0 }, group: [] })
  const group = () => (drag.current.group.length ? drag.current.group : undefined)

  /** Current node position in mm; exits are pulled onto the nearest wall (when moved alone). */
  function position(node: Konva.Node) {
    const x = node.x() / SCALE
    const y = node.y() / SCALE
    if (utility.kind !== 'exit' || drag.current.group.length) return { x, y }
    const p = snapToWall(x, y, floorplan)
    node.position({ x: p.x * SCALE, y: p.y * SCALE })
    return p
  }

  return (
    <Group
      id={utility.id}
      name="utility"
      x={utility.x * SCALE}
      y={utility.y * SCALE}
      draggable={interactive}
      listening={interactive}
      onMouseDown={(e) => pressItem(utility.id, e)}
      onTouchStart={(e) => pressItem(utility.id, e)}
      onClick={(e) => clickItem(utility.id, e)}
      onTap={(e) => clickItem(utility.id, e)}
      onDragStart={(e) => {
        const from = usePlanner.getState().utilities.find((u) => u.id === utility.id) ?? utility
        drag.current = { from, group: dragGroup(utility.id) }
        onDrag({ id: utility.id, ...position(e.target), group: group() })
      }}
      onDragMove={(e) => onDrag({ id: utility.id, ...position(e.target), group: group() })}
      onDragEnd={(e) => {
        const p = position(e.target)
        const { from, group: ids } = drag.current
        if (ids.length) moveItems([utility.id, ...ids], p.x - from.x, p.y - from.y)
        else moveUtility(utility.id, p.x, p.y)
        drag.current = { from: { x: 0, y: 0 }, group: [] }
        onDrag(null)
      }}
      onMouseEnter={(e) => setCursor(e, 'move')}
      onMouseLeave={(e) => setCursor(e, '')}
    >
      <UtilityGlyph utility={utility} floorplan={floorplan} fit={fit} selected={selected} invalid={invalid} />
    </Group>
  )
}

/** Icon (plus the door for exits), drawn centred on (0, 0). */
export function UtilityGlyph({
  utility,
  floorplan,
  fit,
  selected = false,
  invalid = false,
}: {
  utility: Pick<Utility, 'kind' | 'x' | 'y'>
  floorplan: Floorplan
  fit: number
  selected?: boolean
  invalid?: boolean
}) {
  const ring = invalid ? CANVAS.invalid : selected ? CANVAS.selected : COLORS.white
  return (
    <>
      {utility.kind === 'exit' && <ExitDoor x={utility.x} y={utility.y} floorplan={floorplan} fit={fit} />}
      <UtilityIcon kind={utility.kind} radius={ICON_R} fit={fit} ring={ring} ringWidth={selected || invalid ? 3 : 2} />
    </>
  )
}

/** Round icon badge in the utility's colour. `radius` is in screen px. */
export function UtilityIcon({
  kind,
  radius,
  fit,
  ring = COLORS.white,
  ringWidth = 2,
}: {
  kind: UtilityKind
  radius: number
  fit: number
  ring?: string
  ringWidth?: number
}) {
  const info = UTILITY_KINDS[kind]
  const glyph = radius * 1.25 // icon size inside the circle, px
  return (
    // Undo the floor's fit scaling so icons stay the same size on screen.
    <Group scaleX={1 / fit} scaleY={1 / fit}>
      <Circle
        radius={radius}
        fill={info.colour}
        stroke={ring}
        strokeWidth={ringWidth}
        shadowColor="black"
        shadowOpacity={0.25}
        shadowBlur={3}
      />
      <Path
        data={info.iconPath}
        x={-glyph / 2}
        y={-glyph / 2}
        scaleX={glyph / 24}
        scaleY={glyph / 24}
        stroke={COLORS.white}
        strokeWidth={2}
        lineCap="round"
        lineJoin="round"
        listening={false}
      />
    </Group>
  )
}

/** Green opening in the wall, drawn along whichever wall the exit sits on. */
function ExitDoor({ x, y, floorplan, fit }: { x: number; y: number; floorplan: Floorplan; fit: number }) {
  const along = EXIT_WIDTH * SCALE
  const thick = 6 / fit
  // Lies along the wall, including the slanted wall of a chamfered floor.
  const { angle } = nearestWall(x, y, floorplan)
  return (
    <Rect
      x={0}
      y={0}
      offsetX={along / 2}
      offsetY={thick / 2}
      width={along}
      height={thick}
      rotation={angle}
      fill={UTILITY_KINDS.exit.colour}
      listening={false}
    />
  )
}

/** Faint coverage circle for sprinklers; power and water are automatically connected. */
export function CoverageCircle({
  utility,
  strong,
  walls,
}: {
  utility: Utility
  strong: boolean
  walls: Wall[]
}) {
  const radius = utilityRadius(utility)
  if (utility.kind !== 'sprinkler' || radius <= 0) return null
  const colour = UTILITY_KINDS[utility.kind].colour
  const shape = coverageShape(utility, radius, walls)
  if (shape) {
    return (
      <Line
        points={shape.flatMap((p) => [p.x * SCALE, p.y * SCALE])}
        closed
        fill={colour}
        opacity={strong ? 0.22 : 0.1}
        stroke={colour}
        strokeWidth={strong ? 2 : 1}
        strokeScaleEnabled={false}
        dash={[6, 4]}
        lineJoin="round"
        listening={false}
      />
    )
  }
  return (
    <Circle
      x={utility.x * SCALE}
      y={utility.y * SCALE}
      radius={radius * SCALE}
      fill={colour}
      opacity={strong ? 0.22 : 0.1}
      stroke={colour}
      strokeWidth={strong ? 2 : 1}
      strokeScaleEnabled={false}
      dash={[6, 4]}
      listening={false}
    />
  )
}
