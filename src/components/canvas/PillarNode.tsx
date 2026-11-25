import type { Outline } from '@/components/canvas/MachineNode'
import { Group, Rect, Shape } from 'react-konva'
import { setCursor, type DragState } from '@/components/canvas/shared'
import { SCALE } from '@/constants'
import { usePlanner } from '@/store'
import { CANVAS } from '@/theme'
import type { Pillar } from '@/types'

/** Distance between hatch lines on screen, px. */
const HATCH_PX = 5

/** A placed pillar. Draggable unless `interactive` is off (placing something, or pillars locked). */
export function PillarNode({
  pillar,
  fit,
  selected,
  invalid,
  interactive,
  onDrag,
}: {
  pillar: Pillar
  fit: number
  selected: boolean
  /** Clashes with a machine or sits outside the floor. */
  invalid: boolean
  interactive: boolean
  onDrag: (drag: DragState | null) => void
}) {
  const select = usePlanner((s) => s.select)
  const movePillar = usePlanner((s) => s.movePillar)

  const position = (x: number, y: number) => ({ x: x / SCALE, y: y / SCALE })

  return (
    <Group
      id={pillar.id}
      name="pillar"
      x={pillar.x * SCALE}
      y={pillar.y * SCALE}
      draggable={interactive}
      listening={interactive}
      onMouseDown={() => select(pillar.id)}
      onTouchStart={() => select(pillar.id)}
      onDragStart={(e) => {
        select(pillar.id)
        onDrag({ id: pillar.id, ...position(e.target.x(), e.target.y()) })
      }}
      onDragMove={(e) => onDrag({ id: pillar.id, ...position(e.target.x(), e.target.y()) })}
      onDragEnd={(e) => {
        const p = position(e.target.x(), e.target.y())
        movePillar(pillar.id, p.x, p.y)
        onDrag(null)
      }}
      onMouseEnter={(e) => setCursor(e, 'move')}
      onMouseLeave={(e) => setCursor(e, '')}
    >
      <PillarBody
        width={pillar.width}
        depth={pillar.depth}
        fit={fit}
        outline={invalid ? 'invalid' : selected ? 'selected' : 'none'}
      />
    </Group>
  )
}

/** Hatched block centred on (0, 0); sizes in mm. Also used for the placing ghost. */
export function PillarBody({
  width,
  depth,
  fit,
  outline = 'none',
}: {
  width: number
  depth: number
  fit: number
  outline?: Outline
}) {
  const w = width * SCALE
  const h = depth * SCALE
  const stroke =
    outline === 'invalid'
      ? CANVAS.invalid
      : outline === 'selected'
        ? CANVAS.selected
        : outline === 'valid'
          ? CANVAS.valid
          : CANVAS.pillarStroke
  const step = HATCH_PX / fit

  return (
    <>
      <Rect x={-w / 2} y={-h / 2} width={w} height={h} fill={CANVAS.pillarFill} />
      {/* Diagonal hatching, clipped to the block. */}
      <Shape
        listening={false}
        stroke={CANVAS.pillarHatch}
        strokeWidth={1}
        strokeScaleEnabled={false}
        sceneFunc={(ctx, shape) => {
          ctx.save()
          ctx.beginPath()
          ctx.rect(-w / 2, -h / 2, w, h)
          ctx.clip()
          ctx.beginPath()
          for (let d = -h; d < w; d += step) {
            ctx.moveTo(-w / 2 + d, h / 2)
            ctx.lineTo(-w / 2 + d + h, -h / 2)
          }
          ctx.strokeShape(shape)
          ctx.restore()
        }}
      />
      <Rect
        x={-w / 2}
        y={-h / 2}
        width={w}
        height={h}
        stroke={stroke}
        strokeWidth={outline === 'none' ? 1.5 : 3}
        strokeScaleEnabled={false}
      />
    </>
  )
}
