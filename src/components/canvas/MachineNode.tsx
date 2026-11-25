import { useEffect, useRef } from 'react'
import Konva from 'konva'
import { Group, Rect, Text } from 'react-konva'
import { ConveyorBody } from '@/components/canvas/ConveyorBody'
import { UtilityIcon } from '@/components/canvas/UtilityNode'
import { setCursor, type DragState } from '@/components/canvas/shared'
import { SCALE } from '@/constants'
import { getMachineType, machineTypeFor } from '@/data/catalog'
import { conveyorRuns, snapShift } from '@/lib/conveyors'
import { clearanceBox, footprint } from '@/lib/geometry'
import type { Need } from '@/lib/validation'
import { usePlanner } from '@/store'
import { CANVAS, COLORS } from '@/theme'
import type { MachineInstance, Rotation } from '@/types'

export type Outline = 'none' | 'selected' | 'valid' | 'invalid'

/** A placed machine: draggable, with pop-in / wobble / settle animations. */
export function Machine({
  machine,
  outline,
  needs,
  fit,
  interactive,
  onDrag,
}: {
  machine: MachineInstance
  outline: Outline
  needs: Need[]
  fit: number
  /** False while placing something new, so clicks go through to the floor. */
  interactive: boolean
  /** Reports the live position while dragging, and null when the drag ends. */
  onDrag: (drag: DragState | null) => void
}) {
  const select = usePlanner((s) => s.select)
  const moveMachines = usePlanner((s) => s.moveMachines)
  const selectSinglePiece = usePlanner((s) => s.selectSinglePiece)
  const isConveyor = !!getMachineType(machine.typeId)?.conveyor
  const groupRef = useRef<Konva.Group>(null)

  // Juice: pop in when placed.
  useEffect(() => {
    const node = groupRef.current
    if (!node) return
    node.scale({ x: 0.5, y: 0.5 })
    const tween = new Konva.Tween({
      node,
      scaleX: 1,
      scaleY: 1,
      duration: 0.35,
      easing: Konva.Easings.BackEaseOut,
    })
    tween.play()
    return () => {
      tween.destroy()
      node.scale({ x: 1, y: 1 })
    }
  }, [])

  // Juice: wobble when rotated (skips the first render).
  const lastRotation = useRef(machine.rotation)
  useEffect(() => {
    const node = groupRef.current
    if (!node || lastRotation.current === machine.rotation) return
    lastRotation.current = machine.rotation
    node.rotation(-18)
    node.to({ rotation: 0, duration: 0.5, easing: Konva.Easings.ElasticEaseOut })
  }, [machine.rotation])

  /** The rest of the conveyor run, moving along while this piece is dragged (set on drag start). */
  const movingWith = useRef<MachineInstance[]>([])

  /** Pieces dragged together with this one: its whole run, unless it was double-clicked. */
  function runMates(): MachineInstance[] {
    const { machines, singlePieceId } = usePlanner.getState()
    if (singlePieceId === machine.id) return []
    const run = conveyorRuns(machines).runOf.get(machine.id)
    if (!run || run.pieceIds.length < 2) return []
    return machines.filter((m) => m.id !== machine.id && run.pieceIds.includes(m.id))
  }

  /**
   * Live position in mm. Conveyor pieces (and a run moving together) snap onto a nearby free
   * end or machine front, and the node jumps there.
   */
  const toMm = (node: Konva.Node) => {
    const at = { x: node.x() / SCALE, y: node.y() / SCALE }
    const dx = at.x - machine.x
    const dy = at.y - machine.y
    const moving = [
      { ...machine, ...at },
      ...movingWith.current.map((m) => ({ ...m, x: m.x + dx, y: m.y + dy })),
    ]
    const shift = snapShift(moving, usePlanner.getState().machines)
    if (!shift) return at
    const snapped = { x: Math.round(at.x + shift.x), y: Math.round(at.y + shift.y) }
    node.position({ x: snapped.x * SCALE, y: snapped.y * SCALE })
    return snapped
  }
  const group = () => (movingWith.current.length ? movingWith.current.map((m) => m.id) : undefined)

  return (
    // The group sits at the machine's centre; everything inside is drawn around it.
    <Group
      ref={groupRef}
      id={machine.id}
      name="machine"
      x={machine.x * SCALE}
      y={machine.y * SCALE}
      draggable={interactive}
      listening={interactive}
      onMouseDown={() => select(machine.id)}
      onTouchStart={() => select(machine.id)}
      onDblClick={() => isConveyor && selectSinglePiece(machine.id)}
      onDblTap={() => isConveyor && selectSinglePiece(machine.id)}
      onDragStart={(e) => {
        select(machine.id)
        movingWith.current = runMates()
        onDrag({ id: machine.id, ...toMm(e.target), group: group() })
      }}
      onDragMove={(e) => onDrag({ id: machine.id, ...toMm(e.target), group: group() })}
      onDragEnd={(e) => {
        // Free placement (conveyors snap to free ends), rounded to whole millimetres.
        const { x, y } = toMm(e.target)
        const dx = x - machine.x
        const dy = y - machine.y
        moveMachines([
          { id: machine.id, x, y },
          ...movingWith.current.map((m) => ({ id: m.id, x: m.x + dx, y: m.y + dy })),
        ])
        movingWith.current = []
        onDrag(null)
        // Juice: small settle when dropped.
        e.target.scale({ x: 1.06, y: 1.06 })
        e.target.to({ scaleX: 1, scaleY: 1, duration: 0.2, easing: Konva.Easings.EaseOut })
      }}
      onMouseEnter={(e) => setCursor(e, 'move')}
      onMouseLeave={(e) => setCursor(e, '')}
    >
      <MachineBody
        typeId={machine.typeId}
        length={machine.length}
        rotation={machine.rotation}
        outline={outline}
        needs={needs}
        fit={fit}
      />
    </Group>
  )
}

const OUTLINE_STYLE: Record<Outline, { stroke: string; width: number }> = {
  none: { stroke: CANVAS.machineStroke, width: 1 },
  selected: { stroke: CANVAS.selected, width: 3 },
  valid: { stroke: CANVAS.valid, width: 3 },
  invalid: { stroke: CANVAS.invalid, width: 3 },
}

/** The machine's rectangle, front marker, label and needs badges, drawn centred on (0, 0). */
export function MachineBody({
  typeId,
  length,
  rotation,
  outline,
  needs,
  fit,
  dashed = false,
}: {
  typeId: string
  /** Straight conveyor length, mm. */
  length?: number
  rotation: Rotation
  outline: Outline
  needs: Need[]
  fit: number
  dashed?: boolean
}) {
  const type = machineTypeFor({ typeId, length })
  if (!type) return null

  const size = footprint(type, rotation)
  const w = size.width * SCALE
  const h = size.depth * SCALE
  const style = OUTLINE_STYLE[outline]

  if (type.conveyor) {
    return (
      <>
        <ConveyorBody
          piece={type.conveyor}
          length={type.width}
          width={type.depth}
          rotation={rotation}
          stroke={outline === 'none' ? COLORS.grey700 : style.stroke}
          strokeWidth={style.width}
          dashed={dashed}
          fit={fit}
        />
        <NeedsBadges needs={needs} top={-h / 2} fit={fit} />
      </>
    )
  }

  return (
    <>
      <Rect
        x={-w / 2}
        y={-h / 2}
        width={w}
        height={h}
        fill={CANVAS.machineFill}
        stroke={style.stroke}
        strokeWidth={style.width}
        strokeScaleEnabled={false}
        dash={dashed ? [6, 4] : undefined}
        shadowColor="black"
        shadowOpacity={outline === 'selected' ? 0.3 : 0}
        shadowBlur={6}
      />
      <FrontMarker rotation={rotation} w={w} h={h} />
      <Text
        x={-w / 2}
        y={-h / 2}
        width={w}
        height={h}
        padding={4}
        text={type.name}
        fontSize={10}
        fontFamily="Arial, Helvetica, sans-serif"
        fill={CANVAS.machineLabel}
        align="center"
        verticalAlign="middle"
        wrap="word"
        ellipsis
        listening={false}
      />
      <NeedsBadges needs={needs} top={-h / 2} fit={fit} />
    </>
  )
}

/** Thin bar along the machine's front edge (front faces down at rotation 0). */
function FrontMarker({ rotation, w, h }: { rotation: Rotation; w: number; h: number }) {
  const t = 2.5 // thickness, px
  const inset = 2
  const bars = {
    0: { x: -w / 2 + inset, y: h / 2 - t - inset, width: w - 2 * inset, height: t },
    90: { x: -w / 2 + inset, y: -h / 2 + inset, width: t, height: h - 2 * inset },
    180: { x: -w / 2 + inset, y: -h / 2 + inset, width: w - 2 * inset, height: t },
    270: { x: w / 2 - t - inset, y: -h / 2 + inset, width: t, height: h - 2 * inset },
  }
  return <Rect {...bars[rotation]} fill={CANVAS.frontMarker} opacity={0.8} listening={false} />
}

/** Small icons floating above a machine for each utility it is missing. */
function NeedsBadges({ needs, top, fit }: { needs: Need[]; top: number; fit: number }) {
  if (needs.length === 0) return null
  const r = 8 // badge radius, screen px
  const gap = 3
  const step = (2 * r + gap) / fit
  const startX = (-(needs.length - 1) * step) / 2
  return (
    <Group y={top - (r + 4) / fit} listening={false}>
      {needs.map((need, i) => (
        <Group key={need} x={startX + i * step}>
          <UtilityIcon kind={need} radius={r} fit={fit} ring={CANVAS.invalid} ringWidth={2} />
        </Group>
      ))}
    </Group>
  )
}

/** Faint area showing the free space a machine needs; green if fine, red if not. */
export function ClearanceZone({ machine, valid }: { machine: MachineInstance; valid: boolean }) {
  const type = machineTypeFor(machine)
  if (!type) return null
  const box = clearanceBox(type, machine)
  const colour = valid ? CANVAS.valid : CANVAS.invalid
  return (
    <Rect
      x={box.x * SCALE}
      y={box.y * SCALE}
      width={box.width * SCALE}
      height={box.depth * SCALE}
      fill={colour}
      opacity={0.18}
      stroke={colour}
      strokeWidth={1}
      strokeScaleEnabled={false}
      dash={[4, 4]}
      listening={false}
    />
  )
}
