import { Arc, Arrow, Circle, Group, Line, Rect } from 'react-konva'
import { SCALE } from '@/constants'
import type { ConveyorPiece } from '@/data/conveyors'
import { CATEGORY_COLOURS } from '@/data/machineColours'
import { COLORS, mixColours } from '@/theme'
import { freeEnds } from '@/lib/conveyors'
import type { MachineInstance, Rotation } from '@/types'

/** Spacing of the roller lines across a belt, mm. */
const ROLLER_PITCH = 250
/** Roughly one flow chevron per this much belt, mm. */
const CHEVRON_PITCH = 1000
/** Side rails take this share of the belt width on each side. */
const RAIL = 0.14

/**
 * The light, friendly belt look, derived from one station colour like the machine cards:
 * tinted rails, a pale belt, faint rollers and flow arrows in the colour itself.
 */
function conveyorColours(colour: string) {
  return {
    rail: mixColours(colour, COLORS.white, 0.62),
    belt: mixColours(colour, COLORS.white, 0.9),
    roller: mixColours(colour, COLORS.white, 0.45),
    arrow: colour,
  }
}

/**
 * A conveyor piece drawn centred on (0, 0): side rails, belt, rollers and flow arrows.
 * Drawn in the piece's own frame (flowing +x, entering from the left) and then rotated.
 * `length` and `width` are the unrotated size, mm.
 */
export function ConveyorBody({
  piece,
  length,
  width,
  rotation,
  colour,
  stroke,
  strokeWidth,
  dashed,
  lifted = false,
  fit,
}: {
  piece: ConveyorPiece
  length: number
  width: number
  rotation: Rotation
  /** Station colour the belt is tinted with. */
  colour: string
  stroke: string
  strokeWidth: number
  dashed: boolean
  /** Raised off the floor (bigger shadow): selected or hovered. */
  lifted?: boolean
  fit: number
}) {
  const w = length * SCALE
  const h = width * SCALE
  const c = conveyorColours(colour)
  return (
    <Group rotation={rotation}>
      {/* Frame (side rails); carries the selection/clash outline and the soft shadow. */}
      <Rect
        x={-w / 2}
        y={-h / 2}
        width={w}
        height={h}
        cornerRadius={Math.min(h * 0.28, 6)}
        fill={c.rail}
        stroke={stroke}
        strokeWidth={strokeWidth}
        strokeScaleEnabled={false}
        hitStrokeWidth={12 / fit}
        dash={dashed ? [6, 4] : undefined}
        shadowColor={COLORS.charcoal900}
        shadowOpacity={lifted ? 0.24 : 0.12}
        shadowBlur={(lifted ? 12 : 5) / fit}
        shadowOffsetY={(lifted ? 4 : 1.5) / fit}
      />
      {piece === 'straight' ? (
        <StraightBelt w={w} h={h} fit={fit} c={c} />
      ) : (
        <CornerBelt s={h} turn={piece === 'corner-left' ? 'left' : 'right'} fit={fit} c={c} />
      )}
    </Group>
  )
}

type BeltColours = ReturnType<typeof conveyorColours>

function StraightBelt({ w, h, fit, c }: { w: number; h: number; fit: number; c: BeltColours }) {
  const rail = h * RAIL
  const top = -h / 2 + rail
  const bottom = h / 2 - rail
  const rollers = Math.max(0, Math.floor(w / (ROLLER_PITCH * SCALE)) - 1)
  const chevrons = Math.max(1, Math.round(w / (CHEVRON_PITCH * SCALE)))
  const ch = (bottom - top) * 0.26 // chevron half-height
  return (
    <Group listening={false}>
      <Rect x={-w / 2 + rail * 0.5} y={top} width={w - rail} height={bottom - top} cornerRadius={Math.min(rail, 3)} fill={c.belt} />
      {Array.from({ length: rollers }, (_, i) => {
        const x = -w / 2 + ((i + 1) * w) / (rollers + 1)
        return (
          <Line
            key={`r${i}`}
            points={[x, top + 1, x, bottom - 1]}
            stroke={c.roller}
            opacity={0.55}
            strokeWidth={1}
            strokeScaleEnabled={false}
            lineCap="round"
          />
        )
      })}
      {Array.from({ length: chevrons }, (_, i) => {
        const x = -w / 2 + ((i + 0.5) * w) / chevrons
        return (
          <Line
            key={`c${i}`}
            points={[x - ch * 0.6, -ch, x + ch * 0.6, 0, x - ch * 0.6, ch]}
            stroke={c.arrow}
            opacity={0.85}
            strokeWidth={2.5 / fit}
            lineCap="round"
            lineJoin="round"
          />
        )
      })}
    </Group>
  )
}

/**
 * Quarter-turn belt in an s × s piece. Goods enter from the left edge and leave through the
 * bottom edge (right turn) or the top edge (left turn); the belt curves around that corner.
 */
function CornerBelt({ s, turn, fit, c }: { s: number; turn: 'left' | 'right'; fit: number; c: BeltColours }) {
  const half = s / 2
  const right = turn === 'right'
  // The curve pivots on the corner shared by the entry and exit edges.
  const px = -half
  const py = right ? half : -half
  const inner = s * RAIL
  const outer = s * (1 - RAIL)
  const mid = (inner + outer) / 2
  // Angles clockwise from +x: the entry edge runs up (270°) or down (90°) from the pivot.
  // The arrow sweeps 85° towards the exit edge, stopping short so the arrowhead fits.
  const from = right ? 270 : 90
  const sweep = right ? 85 : -85
  const steps = 10
  const arrow = Array.from({ length: steps + 1 }, (_, i) => {
    const a = ((from + (sweep * i) / steps) * Math.PI) / 180
    return [px + mid * Math.cos(a), py + mid * Math.sin(a)]
  }).flat()
  return (
    <Group listening={false}>
      <Arc
        x={px}
        y={py}
        innerRadius={inner}
        outerRadius={outer}
        angle={90}
        rotation={right ? 270 : 0}
        fill={c.belt}
      />
      {[22.5, 45, 67.5].map((deg) => {
        const a = ((right ? 270 + deg : deg) * Math.PI) / 180
        return (
          <Line
            key={deg}
            points={[
              px + inner * Math.cos(a),
              py + inner * Math.sin(a),
              px + outer * Math.cos(a),
              py + outer * Math.sin(a),
            ]}
            stroke={c.roller}
            opacity={0.55}
            strokeWidth={1}
            strokeScaleEnabled={false}
            lineCap="round"
          />
        )
      })}
      <Arrow
        points={arrow}
        stroke={c.arrow}
        fill={c.arrow}
        opacity={0.85}
        strokeWidth={2.5 / fit}
        pointerLength={(outer - inner) * 0.3}
        pointerWidth={(outer - inner) * 0.35}
        lineCap="round"
        lineJoin="round"
      />
    </Group>
  )
}

/** The default belt colour, for the free-end markers. */
const END_COLOUR = CATEGORY_COLOURS['material-handling']

/**
 * Markers on conveyor ends that aren't joined to anything, so you can see where a run can
 * continue: a ring for a free input, a filled dot for a free output. With `showFronts` (while
 * a conveyor piece is being placed or dragged), free machine fronts get a diamond marker too.
 */
export function ConveyorEnds({
  machines,
  showFronts,
  fit,
}: {
  machines: MachineInstance[]
  showFronts: boolean
  fit: number
}) {
  const { inputs, outputs, fronts } = freeEnds(machines)
  const shownFronts = showFronts ? fronts : []
  if (inputs.length + outputs.length + shownFronts.length === 0) return null
  const r = 4 / fit
  return (
    <Group listening={false}>
      {shownFronts.map((p, i) => (
        <Rect
          key={`front-${i}`}
          x={p.point.x * SCALE}
          y={p.point.y * SCALE}
          width={2.2 * r}
          height={2.2 * r}
          offsetX={1.1 * r}
          offsetY={1.1 * r}
          rotation={45}
          cornerRadius={1.5 / fit}
          fill={COLORS.white}
          stroke={END_COLOUR}
          strokeWidth={2}
          strokeScaleEnabled={false}
        />
      ))}
      {inputs.map((p, i) => (
        <Circle
          key={`in-${i}`}
          x={p.point.x * SCALE}
          y={p.point.y * SCALE}
          radius={r}
          fill={COLORS.white}
          stroke={END_COLOUR}
          strokeWidth={2}
          strokeScaleEnabled={false}
        />
      ))}
      {outputs.map((p, i) => (
        <Circle
          key={`out-${i}`}
          x={p.point.x * SCALE}
          y={p.point.y * SCALE}
          radius={r}
          fill={END_COLOUR}
          stroke={COLORS.white}
          strokeWidth={2}
          strokeScaleEnabled={false}
        />
      ))}
    </Group>
  )
}
