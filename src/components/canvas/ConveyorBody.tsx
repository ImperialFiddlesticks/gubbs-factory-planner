import { Arc, Arrow, Circle, Group, Line, Rect } from 'react-konva'
import { SCALE } from '@/constants'
import type { ConveyorPiece } from '@/data/conveyors'
import { COLORS } from '@/theme'
import { freeEnds } from '@/lib/conveyors'
import type { MachineInstance, Rotation } from '@/types'

/** Spacing of the roller lines across a belt, mm. */
const ROLLER_PITCH = 250
/** Roughly one flow chevron per this much belt, mm. */
const CHEVRON_PITCH = 1000
/** Side rails take this share of the belt width on each side. */
const RAIL = 0.1

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
  stroke,
  strokeWidth,
  dashed,
  fit,
}: {
  piece: ConveyorPiece
  length: number
  width: number
  rotation: Rotation
  stroke: string
  strokeWidth: number
  dashed: boolean
  fit: number
}) {
  const w = length * SCALE
  const h = width * SCALE
  return (
    <Group rotation={rotation}>
      {/* Frame (side rails); carries the selection/clash outline. */}
      <Rect
        x={-w / 2}
        y={-h / 2}
        width={w}
        height={h}
        fill={COLORS.grey500}
        stroke={stroke}
        strokeWidth={strokeWidth}
        strokeScaleEnabled={false}
        hitStrokeWidth={12 / fit}
        dash={dashed ? [6, 4] : undefined}
      />
      {piece === 'straight' ? (
        <StraightBelt w={w} h={h} fit={fit} />
      ) : (
        <CornerBelt s={h} turn={piece === 'corner-left' ? 'left' : 'right'} fit={fit} />
      )}
    </Group>
  )
}

function StraightBelt({ w, h, fit }: { w: number; h: number; fit: number }) {
  const rail = h * RAIL
  const top = -h / 2 + rail
  const bottom = h / 2 - rail
  const rollers = Math.max(0, Math.floor(w / (ROLLER_PITCH * SCALE)) - 1)
  const chevrons = Math.max(1, Math.round(w / (CHEVRON_PITCH * SCALE)))
  const c = (bottom - top) * 0.28 // chevron half-height
  return (
    <Group listening={false}>
      <Rect x={-w / 2} y={top} width={w} height={bottom - top} fill={COLORS.charcoal600} />
      {Array.from({ length: rollers }, (_, i) => {
        const x = -w / 2 + ((i + 1) * w) / (rollers + 1)
        return (
          <Line
            key={`r${i}`}
            points={[x, top, x, bottom]}
            stroke={COLORS.white}
            opacity={0.18}
            strokeWidth={1}
            strokeScaleEnabled={false}
          />
        )
      })}
      {Array.from({ length: chevrons }, (_, i) => {
        const x = -w / 2 + ((i + 0.5) * w) / chevrons
        return (
          <Line
            key={`c${i}`}
            points={[x - c * 0.6, -c, x + c * 0.6, 0, x - c * 0.6, c]}
            stroke={COLORS.yellow}
            strokeWidth={2 / fit}
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
function CornerBelt({ s, turn, fit }: { s: number; turn: 'left' | 'right'; fit: number }) {
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
        fill={COLORS.charcoal600}
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
            stroke={COLORS.white}
            opacity={0.18}
            strokeWidth={1}
            strokeScaleEnabled={false}
          />
        )
      })}
      <Arrow
        points={arrow}
        stroke={COLORS.yellow}
        fill={COLORS.yellow}
        strokeWidth={2 / fit}
        pointerLength={(outer - inner) * 0.3}
        pointerWidth={(outer - inner) * 0.35}
        lineCap="round"
        lineJoin="round"
      />
    </Group>
  )
}

/**
 * Markers on conveyor ends that aren't joined to anything, so you can see where a run can
 * continue: a ring for a free input, a filled dot for a free output. With `showFronts` (while
 * a conveyor piece is being placed or dragged), free machine fronts get a square marker too.
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
          fill={COLORS.yellow}
          stroke={COLORS.charcoal}
          strokeWidth={1.5}
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
          stroke={COLORS.charcoal}
          strokeWidth={1.5}
          strokeScaleEnabled={false}
        />
      ))}
      {outputs.map((p, i) => (
        <Circle
          key={`out-${i}`}
          x={p.point.x * SCALE}
          y={p.point.y * SCALE}
          radius={r}
          fill={COLORS.yellow}
          stroke={COLORS.charcoal}
          strokeWidth={1.5}
          strokeScaleEnabled={false}
        />
      ))}
    </Group>
  )
}
