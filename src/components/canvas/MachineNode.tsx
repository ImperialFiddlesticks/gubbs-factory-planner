import { useEffect, useRef, useState } from 'react'
import Konva from 'konva'
import { Circle, Group, Label, Rect, Tag, Text } from 'react-konva'
import { ConveyorBody } from '@/components/canvas/ConveyorBody'
import { UtilityIcon } from '@/components/canvas/UtilityNode'
import { clickItem, dragGroup, pressItem, setCursor, type DragState } from '@/components/canvas/shared'
import { SCALE } from '@/constants'
import { getMachineType, machineTypeFor } from '@/data/catalog'
import { snapShift } from '@/lib/conveyors'
import { clearanceBox, footprint } from '@/lib/geometry'
import { machineLabelGroup, machineShortName } from '@/lib/machineLabels'
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
    const moveItems = usePlanner((s) => s.moveItems)
    const selectSinglePiece = usePlanner((s) => s.selectSinglePiece)
    const machines = usePlanner((s) => s.machines)
    const isConveyor = !!getMachineType(machine.typeId)?.conveyor
    const groupRef = useRef<Konva.Group>(null)
    const [hovered, setHovered] = useState(false)
    const labelIndex = machines
        .filter((m) => machineLabelGroup(m.typeId) === machineLabelGroup(machine.typeId))
        .findIndex((m) => m.id === machine.id) + 1

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

    /**
     * Set on drag start: where this machine started (the props follow the live position while
     * dragging, so they can't be used to measure the move), the ids moving with it (rest of a
     * multi-selection or conveyor run), and those of them that are machines (for conveyor snapping).
     */
    const drag = useRef<{ from: { x: number; y: number }; group: string[]; machines: MachineInstance[] }>({
        from: { x: 0, y: 0 },
        group: [],
        machines: [],
    })

    /**
     * Live position in mm. Conveyor pieces (and a run or selection moving together) snap onto a
     * nearby free end or machine front, and the node jumps there.
     */
    const toMm = (node: Konva.Node) => {
        const at = { x: node.x() / SCALE, y: node.y() / SCALE }
        const { from, machines } = drag.current
        const dx = at.x - from.x
        const dy = at.y - from.y
        const moving = [{ ...machine, ...at }, ...machines.map((m) => ({ ...m, x: m.x + dx, y: m.y + dy }))]
        const shift = snapShift(moving, usePlanner.getState().machines)
        if (!shift) return at
        const snapped = { x: Math.round(at.x + shift.x), y: Math.round(at.y + shift.y) }
        node.position({ x: snapped.x * SCALE, y: snapped.y * SCALE })
        return snapped
    }
    const group = () => (drag.current.group.length ? drag.current.group : undefined)

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
            onMouseDown={(e) => pressItem(machine.id, e)}
            onTouchStart={(e) => pressItem(machine.id, e)}
            onClick={(e) => clickItem(machine.id, e)}
            onTap={(e) => clickItem(machine.id, e)}
            onDblClick={() => isConveyor && selectSinglePiece(machine.id)}
            onDblTap={() => isConveyor && selectSinglePiece(machine.id)}
            onDragStart={(e) => {
                const ids = dragGroup(machine.id)
                const { machines } = usePlanner.getState()
                drag.current = {
                    from: machines.find((m) => m.id === machine.id) ?? machine,
                    group: ids,
                    machines: machines.filter((m) => ids.includes(m.id)),
                }
                onDrag({ id: machine.id, ...toMm(e.target), group: group() })
            }}
            onDragMove={(e) => onDrag({ id: machine.id, ...toMm(e.target), group: group() })}
            onDragEnd={(e) => {
                // Free placement (conveyors snap to free ends), rounded to whole millimetres.
                const { x, y } = toMm(e.target)
                const { from, group: ids } = drag.current
                moveItems([machine.id, ...ids], x - from.x, y - from.y)
                drag.current = { from: { x: 0, y: 0 }, group: [], machines: [] }
                onDrag(null)
                // Juice: small settle when dropped.
                e.target.scale({ x: 1.06, y: 1.06 })
                e.target.to({ scaleX: 1, scaleY: 1, duration: 0.2, easing: Konva.Easings.EaseOut })
            }}
            onMouseEnter={(e) => {
                setHovered(true)
                setCursor(e, 'move')
            }}
            onMouseLeave={(e) => {
                setHovered(false)
                setCursor(e, '')
            }}
        >
            <MachineBody
                typeId={machine.typeId}
                length={machine.length}
                label={machineShortName(machine.typeId, labelIndex)}
                rotation={machine.rotation}
                outline={outline}
                needs={needs}
                fit={fit}
            />
            {hovered && <MachineHoverLabel machine={machine} fit={fit} />}
        </Group>
    )
}

function MachineMark({ typeId, w, h }: { typeId: string; w: number; h: number }) {
    const r = Math.max(2, Math.min(w, h) * 0.1)
    const controlWidth = Math.max(4, Math.min(w * 0.16, 10))
    const controlHeight = Math.max(5, Math.min(h * 0.36, 16))

    if (typeId === 'cnc-mill' || typeId === 'cnc-lathe') {
        return (
            <Group listening={false}>
                <Circle x={w * 0.24} y={-h * 0.12} radius={r} stroke="white" strokeWidth={1} opacity={0.75} />
                <Rect x={-w * 0.38} y={-h * 0.29} width={controlWidth} height={controlHeight} fill="white" opacity={0.7} />
            </Group>
        )
    }

    if (typeId === 'hydraulic-press') {
        return (
            <Group listening={false} opacity={0.75}>
                <Rect x={-w * 0.24} y={-h * 0.23} width={w * 0.48} height={h * 0.08} fill="white" />
                <Rect x={-w * 0.12} y={-h * 0.15} width={w * 0.24} height={h * 0.2} stroke="white" strokeWidth={1} />
            </Group>
        )
    }

    if (typeId === 'air-compressor') {
        return (
            <Group listening={false}>
                <Circle x={-w * 0.18} y={-h * 0.12} radius={r} stroke="white" strokeWidth={1} opacity={0.75} />
                <Circle x={w * 0.16} y={-h * 0.12} radius={r} stroke="white" strokeWidth={1} opacity={0.75} />
            </Group>
        )
    }

    if (typeId === 'packing-table') {
        return <Rect x={-w * 0.3} y={-h * 0.18} width={w * 0.6} height={h * 0.36} stroke="white" strokeWidth={1} opacity={0.7} listening={false} />
    }

    return null
}

function MachineHoverLabel({ machine, fit }: { machine: MachineInstance; fit: number }) {
    const type = machineTypeFor(machine)
    if (!type) return null
    const height = footprint(type, machine.rotation).depth * SCALE
    return (
        <Group y={-height / 2} scaleX={1 / fit} scaleY={1 / fit} listening={false}>
            <Label y={-8}>
                <Tag fill={CANVAS.machineStroke} cornerRadius={3} pointerDirection="down" pointerWidth={8} pointerHeight={5} />
                <Text text={type.name} fontSize={12} padding={4} fill="white" />
            </Label>
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
    label,
    rotation,
    outline,
    needs,
    fit,
    dashed = false,
}: {
    typeId: string
    label?: string
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

    const w = type.width * SCALE
    const h = type.depth * SCALE
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
            <Group rotation={rotation}>
                <Rect
                    x={-w / 2}
                    y={-h / 2}
                    width={w}
                    height={h}
                    fill={CANVAS.machineFill}
                    stroke={style.stroke}
                    strokeWidth={style.width}
                    strokeScaleEnabled={false}
                    hitStrokeWidth={12 / fit}
                    dash={dashed ? [6, 4] : undefined}
                    shadowColor="black"
                    shadowOpacity={outline === 'selected' ? 0.3 : 0}
                    shadowBlur={6}
                />
                <MachineMark typeId={typeId} w={w} h={h} />
                <FrontMarker w={w} h={h} />
                <Text
                    x={-w / 2}
                    y={-h / 2}
                    width={w}
                    height={h}
                    padding={4}
                    text={label ?? machineShortName(typeId, 1)}
                    fontSize={10}
                    fontFamily="Arial, Helvetica, sans-serif"
                    fill={CANVAS.machineLabel}
                    align="center"
                    verticalAlign="middle"
                    wrap="word"
                    ellipsis
                    listening={false}
                />
            </Group>
            <NeedsBadges needs={needs} top={-h / 2} fit={fit} />
        </>
    )
}

/** Thin bar along the machine's front edge (front faces down at rotation 0). */
function FrontMarker({ w, h }: { w: number; h: number }) {
    const t = 2.5 // thickness, px
    const inset = 2

    return (
        <Rect
            x={-w / 2 + inset}
            y={h / 2 - t - inset}
            width={w - 2 * inset}
            height={t}
            fill={CANVAS.frontMarker}
            opacity={0.8}
            listening={false}
        />
    )

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
