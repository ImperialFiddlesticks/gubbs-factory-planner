import { useRef } from 'react'
import type Konva from 'konva'
import { Group, Label, Rect, Tag, Text } from 'react-konva'
import type { Outline } from '@/components/canvas/MachineNode'
import { clickItem, dragGroup, pressItem, setCursor, type DragState } from '@/components/canvas/shared'
import { SCALE } from '@/constants'
import { wallBox, wallLength } from '@/lib/geometry'
import { usePlanner } from '@/store'
import { CANVAS, CANVAS_FONT, COLORS } from '@/theme'
import type { Point, Wall } from '@/types'

type WallShape = Pick<Wall, 'start' | 'end' | 'thickness'>

/**
 * A placed wall. Draggable as a whole unless `interactive` is off (placing something, or
 * structures locked). The group sits at the wall's centre so the delete animation shrinks
 * it in place.
 */
export function WallNode({
  wall,
  fit,
  selected,
  invalid,
  interactive,
  onDrag,
}: {
  wall: Wall
  fit: number
  selected: boolean
  invalid: boolean
  interactive: boolean
  /** Live drag offset in mm (as x/y), or null when the drag ends. */
  onDrag: (drag: DragState | null) => void
}) {
  const updateWall = usePlanner((s) => s.updateWall)
  const moveItems = usePlanner((s) => s.moveItems)
  /** Set on drag start: what moves with it (see dragGroup). */
  const groupIds = useRef<string[]>([])
  const group = () => (groupIds.current.length ? groupIds.current : undefined)

  const cx = ((wall.start.x + wall.end.x) / 2) * SCALE
  const cy = ((wall.start.y + wall.end.y) / 2) * SCALE
  const offset = (node: Konva.Node) => ({ x: (node.x() - cx) / SCALE, y: (node.y() - cy) / SCALE })
  const shift = (p: Point, d: Point) => ({ x: p.x + d.x, y: p.y + d.y })

  return (
    <Group
      id={wall.id}
      name="wall"
      x={cx}
      y={cy}
      draggable={interactive}
      listening={interactive}
      onMouseDown={(e) => pressItem(wall.id, e)}
      onTouchStart={(e) => pressItem(wall.id, e)}
      onClick={(e) => clickItem(wall.id, e)}
      onTap={(e) => clickItem(wall.id, e)}
      onDragStart={(e) => {
        groupIds.current = dragGroup(wall.id)
        onDrag({ id: wall.id, ...offset(e.target), group: group() })
      }}
      onDragMove={(e) => onDrag({ id: wall.id, ...offset(e.target), group: group() })}
      onDragEnd={(e) => {
        const d = offset(e.target)
        if (groupIds.current.length) moveItems([wall.id, ...groupIds.current], d.x, d.y)
        else updateWall(wall.id, { start: shift(wall.start, d), end: shift(wall.end, d) })
        groupIds.current = []
        onDrag(null)
      }}
      onMouseEnter={(e) => setCursor(e, 'move')}
      onMouseLeave={(e) => setCursor(e, '')}
    >
      <Group x={-cx} y={-cy}>
        <WallBody
          wall={wall}
          fit={fit}
          outline={invalid ? 'invalid' : selected ? 'selected' : 'none'}
          showLength={selected}
        />
      </Group>
    </Group>
  )
}

/** Solid bar along the wall's centre line, in floor coordinates (not centred). */
export function WallBody({
  wall,
  fit,
  outline = 'none',
  showLength = false,
}: {
  wall: WallShape
  fit: number
  outline?: Outline
  /** Length label at the wall's middle, e.g. while drawing. */
  showLength?: boolean
}) {
  const box = wallBox(wall)
  const stroke =
    outline === 'invalid'
      ? CANVAS.invalid
      : outline === 'selected'
        ? CANVAS.selected
        : outline === 'valid'
          ? CANVAS.valid
          : CANVAS.wallFill

  return (
    <>
      <Rect
        x={box.x * SCALE}
        y={box.y * SCALE}
        width={box.width * SCALE}
        height={box.depth * SCALE}
        fill={CANVAS.wallFill}
        stroke={stroke}
        strokeWidth={outline === 'none' ? 1 : 3}
        strokeScaleEnabled={false}
        hitStrokeWidth={12 / fit}
      />
      {showLength && (
        <Group
          x={((wall.start.x + wall.end.x) / 2) * SCALE}
          y={((wall.start.y + wall.end.y) / 2) * SCALE}
          // Keep the label the same size on screen, offset so it doesn't sit on the wall.
          scaleX={1 / fit}
          scaleY={1 / fit}
          listening={false}
        >
          <Label y={-14}>
            <Tag
              fill={COLORS.white}
              stroke={COLORS.warm300}
              strokeWidth={1}
              cornerRadius={8}
              pointerDirection="down"
              pointerWidth={8}
              pointerHeight={5}
              shadowColor={COLORS.charcoal900}
              shadowOpacity={0.14}
              shadowBlur={10}
              shadowOffsetY={3}
            />
            <Text fontFamily={CANVAS_FONT} text={metres(wallLength(wall))} fontSize={12} fontStyle="bold" padding={5} fill={COLORS.charcoal} />
          </Label>
        </Group>
      )}
    </>
  )
}

function metres(mm: number) {
  return `${Number((mm / 1000).toFixed(2))} m`
}
