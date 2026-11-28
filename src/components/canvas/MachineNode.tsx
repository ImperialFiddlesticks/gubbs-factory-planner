import { useEffect, useRef, useState } from 'react'
import Konva from 'konva'
import { Circle, Group, Label, Line, Rect, Tag, Text } from 'react-konva'
import { ConveyorBody } from '@/components/canvas/ConveyorBody'
import { UtilityIcon } from '@/components/canvas/UtilityNode'
import { clickItem, dragGroup, pressItem, setCursor, uprightTextRoom, type DragState } from '@/components/canvas/shared'
import { SCALE } from '@/constants'
import { getMachineType, machinePeople, machineTypeFor } from '@/data/catalog'
import { dustPuff, wasJustPlaced, wobble } from '@/lib/animations'
import { snapMachineToConveyor, snapShift } from '@/lib/conveyors'
import { playSound } from '@/lib/sound'
import { keepOnFloor } from '@/lib/placement'
import { clearanceRect, footprint } from '@/lib/geometry'
import { machineName, machineShortName } from '@/lib/machineLabels'
import type { Need } from '@/lib/validation'
import { usePlanner } from '@/store'
import { stationColour } from '@/data/machineColours'
import { CANVAS, COLORS, CANVAS_FONT, mixColours } from '@/theme'
import type { MachineInstance, Rotation } from '@/types'

export type Outline = 'none' | 'selected' | 'valid' | 'invalid'

/** How many machines are being dragged right now (clash shakes on others wait for the drop). */
let activeDrags = 0

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
    const moveMachineTo = usePlanner((s) => s.moveMachineTo)
    const selectSinglePiece = usePlanner((s) => s.selectSinglePiece)
    const machines = usePlanner((s) => s.machines)
    const isConveyor = !!getMachineType(machine.typeId)?.conveyor
    const groupRef = useRef<Konva.Group>(null)
    const [hovered, setHovered] = useState(false)
    const name = machineName(machine, machines)
    /** The latest outline, read when a drag ends. */
    const outlineRef = useRef(outline)
    useEffect(() => {
        outlineRef.current = outline
    })

    /** Dust specks around the machine's footprint, where it stands now. */
    const puff = () => {
        const node = groupRef.current
        const parent = node?.getParent()
        const type = machineTypeFor(machine)
        if (!node || !parent || !type) return
        const size = footprint(type, machine.rotation)
        dustPuff(parent, node.x(), node.y(), size.width * SCALE, size.depth * SCALE, fit)
    }
    /** Shake and buzz: this spot clashes. */
    const clash = () => {
        if (groupRef.current) wobble(groupRef.current)
        playSound('clash')
    }

    // Juice: pop in when placed; a machine the user has just placed also kicks up dust,
    // and shakes if it landed somewhere it clashes.
    useEffect(() => {
        const node = groupRef.current
        if (!node) return
        const fresh = wasJustPlaced()
        node.scale({ x: 0.5, y: 0.5 })
        const tween = new Konva.Tween({
            node,
            scaleX: 1,
            scaleY: 1,
            duration: 0.35,
            easing: Konva.Easings.BackEaseOut,
            onFinish: () => {
                if (fresh && outlineRef.current === 'invalid') clash()
            },
        })
        tween.play()
        if (fresh) puff()
        return () => {
            tween.destroy()
            node.scale({ x: 1, y: 1 })
        }
        // Mount only: the landing effects belong to the moment it was placed.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    // Juice: wobble and swish when rotated (skips the first render).
    const lastRotation = useRef(machine.rotation)
    useEffect(() => {
        const node = groupRef.current
        if (!node || lastRotation.current === machine.rotation) return
        lastRotation.current = machine.rotation
        node.rotation(-18)
        node.to({ rotation: 0, duration: 0.5, easing: Konva.Easings.ElasticEaseOut })
        playSound('rotate')
    }, [machine.rotation])

    // Juice: shake when this machine starts clashing while it stands still, e.g. something
    // was dropped onto it or a height limit was drawn over it.
    const lastOutline = useRef(outline)
    useEffect(() => {
        const was = lastOutline.current
        lastOutline.current = outline
        // Not while a machine is being dragged across it: the drop gives the feedback then.
        // Nor while placing something new: the preview passing over it isn't a clash yet.
        if (was !== 'invalid' && outline === 'invalid' && activeDrags === 0 && !usePlanner.getState().placing) clash()
    }, [outline])

    /**
     * Set on drag start: where this machine started (the props follow the live position while
     * dragging, so they can't be used to measure the move), the ids moving with it (rest of a
     * multi-selection or conveyor run), and those of them that are machines (for conveyor snapping).
     */
    const drag = useRef<{
        from: { x: number; y: number }
        group: string[]
        machines: MachineInstance[]
        /** The last position that kept everything on the floor. */
        lastGood: { x: number; y: number }
        /** Its rotation when the drag started, and now (turned when snapped onto a belt end). */
        startRotation: number
        rotation: number
    }>({
        from: { x: 0, y: 0 },
        group: [],
        machines: [],
        lastGood: { x: 0, y: 0 },
        startRotation: 0,
        rotation: 0,
    })

    /**
     * Live position in mm. Conveyor pieces (and a run or selection moving together) snap onto a
     * nearby free end or machine front, and the node jumps there.
     */
    const toMm = (node: Konva.Node) => {
        const at = { x: node.x() / SCALE, y: node.y() / SCALE }
        const { from, machines, startRotation } = drag.current
        const all = usePlanner.getState().machines
        const dx = at.x - from.x
        const dy = at.y - from.y
        const moving = [{ ...machine, ...at, rotation: startRotation }, ...machines.map((m) => ({ ...m, x: m.x + dx, y: m.y + dy }))]
        const shift = snapShift(moving, all)
        let pos = shift ? { x: Math.round(at.x + shift.x), y: Math.round(at.y + shift.y) } : at
        let rotation = startRotation
        let didSnap = Boolean(shift)

        // A machine dragged on its own jumps onto a nearby free belt end, turned to face it.
        if (!isConveyor && drag.current.group.length === 0) {
            const onBelt = snapMachineToConveyor({ ...machine, ...at, rotation: startRotation }, all)
            if (onBelt) {
                pos = { x: onBelt.x, y: onBelt.y }
                rotation = onBelt.rotation
                didSnap = true
            }
        }

        // Machines can't go through the outer walls: slide along them, or (on a shaped floor)
        // stay at the last spot that fit.
        const { floorplan } = usePlanner.getState()
        if (floorplan) {
            const start = [{ ...machine, x: from.x, y: from.y, rotation }, ...machines]
            const kept = keepOnFloor(start, { x: pos.x - from.x, y: pos.y - from.y }, floorplan)
            pos = kept ? { x: Math.round(from.x + kept.x), y: Math.round(from.y + kept.y) } : drag.current.lastGood
        }
        drag.current.lastGood = pos
        drag.current.rotation = rotation

        // Juice: a click the moment it snaps onto a conveyor end or belt end.
        if (didSnap && !snapped.current) playSound('snap')
        snapped.current = didSnap

        if (pos.x !== at.x || pos.y !== at.y) node.position({ x: pos.x * SCALE, y: pos.y * SCALE })
        return pos
    }
    /** Whether the last drag position was snapped (the click plays only as it snaps on). */
    const snapped = useRef(false)
    const group = () => (drag.current.group.length ? drag.current.group : undefined)
    /** The new rotation if the drag has turned the machine, else undefined. */
    const turned = () => (drag.current.rotation !== drag.current.startRotation ? drag.current.rotation : undefined)

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
                const from = machines.find((m) => m.id === machine.id) ?? machine
                drag.current = {
                    from,
                    group: ids,
                    machines: machines.filter((m) => ids.includes(m.id)),
                    lastGood: { x: from.x, y: from.y },
                    startRotation: from.rotation,
                    rotation: from.rotation,
                }
                activeDrags++
                snapped.current = false
                // Juice: picked up — it grows a little, as if lifted off the floor.
                playSound('pick')
                e.target.to({ scaleX: 1.05, scaleY: 1.05, duration: 0.12, easing: Konva.Easings.EaseOut })
                onDrag({ id: machine.id, ...toMm(e.target), group: group(), rotation: turned() })
            }}
            onDragMove={(e) => onDrag({ id: machine.id, ...toMm(e.target), group: group(), rotation: turned() })}
            onDragEnd={(e) => {
                // Free placement (conveyors snap to free ends), rounded to whole millimetres.
                const { x, y } = toMm(e.target)
                const { from, group: ids } = drag.current
                const rotation = turned()
                if (rotation !== undefined) moveMachineTo(machine.id, x, y, rotation)
                else moveItems([machine.id, ...ids], x - from.x, y - from.y)
                drag.current = { from: { x: 0, y: 0 }, group: [], machines: [], lastGood: { x: 0, y: 0 }, startRotation: 0, rotation: 0 }
                onDrag(null)
                activeDrags = Math.max(0, activeDrags - 1)
                // Juice: settle back down with a little bounce and dust; shake if it clashes there.
                e.target.to({ scaleX: 1, scaleY: 1, duration: 0.25, easing: Konva.Easings.BackEaseOut })
                puff()
                if (outlineRef.current === 'invalid') clash()
                else playSound('drop')
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
                width={machine.width}
                depth={machine.depth}
                colour={machine.colour}
                label={name}
                rotation={machine.rotation}
                outline={outline}
                needs={needs}
                fit={fit}
                lifted={hovered || outline === 'selected'}
            />
            {hovered && (
                <MachineHoverLabel
                    machine={machine}
                    name={name}
                    fit={fit}
                />
            )}
        </Group>
    )
}

function MachineMark({ typeId, w, h, ink }: { typeId: string; w: number; h: number; ink: string }) {
    const r = Math.max(2, Math.min(w, h) * 0.1)
    const controlWidth = Math.max(4, Math.min(w * 0.16, 10))
    const controlHeight = Math.max(5, Math.min(h * 0.36, 16))

    if (typeId === 'cnc-mill' || typeId === 'cnc-lathe') {
        return (
            <Group listening={false}>
                <Circle x={w * 0.24} y={-h * 0.12} radius={r} stroke={ink} strokeWidth={1} opacity={0.45} />
                <Rect x={-w * 0.38} y={-h * 0.29} width={controlWidth} height={controlHeight} fill={ink} opacity={0.4} />
            </Group>
        )
    }

    if (typeId === 'hydraulic-press') {
        return (
            <Group listening={false} opacity={0.45}>
                <Rect x={-w * 0.24} y={-h * 0.23} width={w * 0.48} height={h * 0.08} fill={ink} />
                <Rect x={-w * 0.12} y={-h * 0.15} width={w * 0.24} height={h * 0.2} stroke={ink} strokeWidth={1} />
            </Group>
        )
    }

    if (typeId === 'air-compressor') {
        return (
            <Group listening={false}>
                <Circle x={-w * 0.18} y={-h * 0.12} radius={r} stroke={ink} strokeWidth={1} opacity={0.45} />
                <Circle x={w * 0.16} y={-h * 0.12} radius={r} stroke={ink} strokeWidth={1} opacity={0.45} />
            </Group>
        )
    }

    if (typeId === 'packing-table') {
        return <Rect x={-w * 0.3} y={-h * 0.18} width={w * 0.6} height={h * 0.36} stroke={ink} strokeWidth={1} opacity={0.4} listening={false} />
    }

    return <EquipmentMark typeId={typeId} w={w} h={h} ink={ink} />
}

/**
 * Faint line marks in the card ink for the assembly, welding and storage equipment, so types can be told
 * apart at a glance. Drawn in the item's own frame (centred, front at the bottom), behind the label.
 */
function EquipmentMark({ typeId, w, h, ink }: { typeId: string; w: number; h: number; ink: string }) {
    const line = { stroke: ink, strokeWidth: 1, strokeScaleEnabled: false, opacity: 0.4, listening: false } as const
    switch (typeId) {
        // Jig: an inner frame with cross members, where the part is held.
        case 'assembly-jig-large':
        case 'assembly-jig-small':
            return (
                <Group listening={false}>
                    <Rect x={-w * 0.4} y={-h * 0.36} width={w * 0.8} height={h * 0.72} {...line} />
                    {[-0.2, 0, 0.2].map((t) => (
                        <Line key={t} points={[w * t, -h * 0.36, w * t, h * 0.36]} {...line} />
                    ))}
                </Group>
            )
        // Bench: a vice at the front-left corner.
        case 'work-bench':
            return <Rect x={-w * 0.44} y={h * 0.05} width={w * 0.12} height={h * 0.3} fill={ink} opacity={0.35} listening={false} />
        // Table: a dashed inner edge (worked from all round).
        case 'assembly-table':
        case 'quality-table':
            return <Rect x={-w * 0.42} y={-h * 0.36} width={w * 0.84} height={h * 0.72} dash={[4, 3]} {...line} />
        // Drill: the spindle, seen from above.
        case 'pillar-drill':
            return <Circle radius={Math.min(w, h) * 0.22} {...line} />
        // Saw: the blade along the length.
        case 'band-saw':
            return <Line points={[-w * 0.42, 0, w * 0.42, 0]} {...line} strokeWidth={2} />
        // Welding table: the grid of fixture holes.
        case 'welding-table':
            return (
                <Group listening={false}>
                    {[-0.3, 0, 0.3].flatMap((x) =>
                        [-0.2, 0.2].map((y) => <Circle key={`${x}${y}`} x={w * x} y={h * y} radius={Math.max(1.5, h * 0.06)} fill={ink} opacity={0.35} />),
                    )}
                </Group>
            )
        // Grinding bench: two wheels.
        case 'grinding-bench':
            return (
                <Group listening={false}>
                    <Circle x={-w * 0.2} radius={h * 0.22} {...line} />
                    <Circle x={w * 0.2} radius={h * 0.22} {...line} />
                </Group>
            )
        // Press brake: the long upper beam and the die at the front.
        case 'press-brake':
            return (
                <Group listening={false}>
                    <Rect x={-w * 0.44} y={-h * 0.25} width={w * 0.88} height={h * 0.12} fill={ink} opacity={0.3} />
                    <Line points={[-w * 0.44, h * 0.15, w * 0.44, h * 0.15]} {...line} strokeWidth={2} />
                </Group>
            )
        // Small press: the ram over the bed (like the big press).
        case 'hydraulic-press-30t':
            return <Rect x={-w * 0.15} y={-h * 0.2} width={w * 0.3} height={h * 0.3} {...line} />
        // Cabinet / trolley: drawer lines.
        case 'tool-cabinet':
        case 'tool-trolley':
            return (
                <Group listening={false}>
                    {[-0.15, 0.05, 0.25].map((y) => (
                        <Line key={y} points={[-w * 0.4, h * y, w * 0.4, h * y]} {...line} />
                    ))}
                </Group>
            )
        // Shelf: the bays between uprights.
        case 'storage-shelf':
            return (
                <Group listening={false}>
                    {[-1 / 6, 1 / 6].map((x) => (
                        <Line key={x} points={[w * x, -h * 0.45, w * x, h * 0.45]} {...line} />
                    ))}
                </Group>
            )
        // Pallet spot: the classic crossed box.
        case 'eur-pallet':
            return (
                <Group listening={false}>
                    <Line points={[-w * 0.45, -h * 0.45, w * 0.45, h * 0.45]} {...line} />
                    <Line points={[-w * 0.45, h * 0.45, w * 0.45, -h * 0.45]} {...line} />
                </Group>
            )
        // Chemicals: a hazard triangle.
        case 'chemicals-cabinet': {
            const r = Math.min(w, h) * 0.3
            return <Line points={[0, -r, r * 0.9, r * 0.6, -r * 0.9, r * 0.6]} closed {...line} />
        }
        // Washer: the basin.
        case 'parts-washer':
            return <Rect x={-w * 0.3} y={-h * 0.3} width={w * 0.6} height={h * 0.45} cornerRadius={3} {...line} />
        default:
            return null
    }
}

/** Tooltip above a hovered machine: its name and type, and the work done there if set. */
function MachineHoverLabel({ machine, name, fit }: { machine: MachineInstance; name: string; fit: number }) {
    const type = machineTypeFor(machine)
    if (!type) return null
    const height = footprint(type, machine.rotation).depth * SCALE
    // Its own number, or the typical number for its type (e.g. 3 at a large jig).
    const people = machinePeople(machine)
    const lines = [
        name === type.name ? name : `${name} · ${type.name}`,
        machine.work,
        people !== undefined && `${people} ${people === 1 ? 'person' : 'people'}`,
    ].filter(Boolean)
    return (
        <Group y={-height / 2} scaleX={1 / fit} scaleY={1 / fit} listening={false}>
            <Label y={-8}>
                {/* A white card like the panels and comment bubbles, with a soft shadow. */}
                <Tag
                    fill={COLORS.white}
                    stroke={COLORS.warm300}
                    strokeWidth={1}
                    cornerRadius={10}
                    pointerDirection="down"
                    pointerWidth={10}
                    pointerHeight={6}
                    shadowColor={COLORS.charcoal900}
                    shadowOpacity={0.14}
                    shadowBlur={12}
                    shadowOffsetY={4}
                />
                <Text fontFamily={CANVAS_FONT} text={lines.join('\n')} fontSize={12} fontStyle="600" lineHeight={1.4} padding={8} fill={COLORS.charcoal} width={lines.length > 1 ? 240 : undefined} wrap="word" />
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

/** How strongly the card fill is lightened towards white (0 = full colour, 1 = white). */
const CARD_TINT = 0.84

/**
 * The colours of a machine card: a light tint of the station colour, with its full colour for
 * the border and a darker shade for text and marks. A clash turns the whole card red.
 */
function cardColours(base: string, outline: Outline) {
    const colour = outline === 'invalid' ? CANVAS.invalid : base
    return {
        fill: mixColours(colour, COLORS.white, CARD_TINT),
        border: outline === 'none' ? colour : OUTLINE_STYLE[outline].stroke,
        borderWidth: outline === 'none' ? 1.5 : OUTLINE_STYLE[outline].width,
        ink: mixColours(colour, COLORS.charcoal900, 0.35),
        accent: colour,
    }
}

/** A size in metres for the card ("2.4"), without trailing zeros. */
function metres(mm: number) {
    return String(Number((mm / 1000).toFixed(1)))
}

/** The machine's rectangle, front marker, label and needs badges, drawn centred on (0, 0). */
export function MachineBody({
    typeId,
    length,
    width,
    depth,
    colour,
    label,
    rotation,
    outline,
    needs,
    fit,
    dashed = false,
    lifted = outline === 'selected',
}: {
    typeId: string
    label?: string
    /** Straight conveyor length, mm. */
    length?: number
    /** Per-item size overrides, mm (see MachineInstance). */
    width?: number
    depth?: number
    /** Fill colour; the default machine blue when unset. */
    colour?: string
    rotation: Rotation
    outline: Outline
    needs: Need[]
    fit: number
    dashed?: boolean
    /** Raised off the floor (bigger shadow): selected or hovered. */
    lifted?: boolean
}) {
    const type = machineTypeFor({ typeId, length, width, depth })
    if (!type) return null

    const w = type.width * SCALE
    const h = type.depth * SCALE

    // Belts use the card colours too: tinted by the station colour, red-tinted on a clash.
    const card = cardColours(stationColour(colour, type.category), outline)

    if (type.conveyor) {
        return (
            <>
                <ConveyorBody
                    piece={type.conveyor}
                    length={type.width}
                    width={type.depth}
                    rotation={rotation}
                    colour={card.accent}
                    stroke={card.border}
                    strokeWidth={card.borderWidth}
                    dashed={dashed}
                    lifted={lifted}
                    fit={fit}
                />
                <NeedsBadges needs={needs} top={-h / 2} fit={fit} />
            </>
        )
    }

    // Rounded like a game tile, but never so round that a narrow bench turns into a pill.
    const radius = Math.min(6, w * 0.18, h * 0.18)
    // Shadows scale with the zoom in Konva, so they are given in screen px divided by it.
    const name = label ?? machineShortName(typeId, 1)
    const nameSize = 9
    const dimsSize = 7
    // The label stays level whichever way the machine faces, so it is sized to the room a
    // level line has inside the turned card. The dimensions line only when two lines fit.
    const twoLines = uprightTextRoom(w, h, rotation, nameSize + dimsSize + 6)
    const showDims = twoLines.height >= 30 && twoLines.width >= 34
    const room = showDims ? twoLines : uprightTextRoom(w, h, rotation, nameSize + 2)
    const textW = Math.max(0, room.width - 4)

    return (
        <>
            <Group rotation={rotation}>
                <Rect
                    x={-w / 2}
                    y={-h / 2}
                    width={w}
                    height={h}
                    cornerRadius={radius}
                    fill={card.fill}
                    stroke={card.border}
                    strokeWidth={card.borderWidth}
                    strokeScaleEnabled={false}
                    hitStrokeWidth={12 / fit}
                    dash={dashed ? [6, 4] : undefined}
                    shadowColor={COLORS.charcoal900}
                    shadowOpacity={lifted ? 0.28 : 0.16}
                    shadowBlur={(lifted ? 14 : 6) / fit}
                    shadowOffsetY={(lifted ? 5 : 2) / fit}
                />
                <MachineMark typeId={typeId} w={w} h={h} ink={card.ink} />
                <FrontMarker w={w} h={h} radius={radius} colour={card.accent} />
            </Group>
            {/* Level label on top of the turned card, so it reads the right way up. */}
            <Group listening={false}>
                <Text
                    fontFamily={CANVAS_FONT}
                    x={-textW / 2}
                    y={showDims ? -nameSize * 0.85 : -Math.min(room.height, h + w) / 2}
                    width={textW}
                    height={showDims ? undefined : Math.min(room.height, h + w)}
                    padding={0}
                    text={name}
                    fontSize={nameSize}
                    fontStyle="bold"
                    fill={card.ink}
                    align="center"
                    verticalAlign="middle"
                    wrap={showDims ? 'none' : 'word'}
                    ellipsis
                    listening={false}
                />
                {showDims && (
                    <Text
                        fontFamily={CANVAS_FONT}
                        x={-textW / 2}
                        y={nameSize * 0.35}
                        width={textW}
                        text={`${metres(type.width)} × ${metres(type.depth)} m`}
                        fontSize={dimsSize}
                        fill={card.ink}
                        opacity={0.75}
                        align="center"
                        wrap="none"
                        ellipsis
                        listening={false}
                    />
                )}
            </Group>
            <NeedsBadges needs={needs} top={-h / 2} fit={fit} />
        </>
    )
}

/**
 * The machine's front (it faces down at rotation 0): a coloured strip along the front edge
 * with a small arrow pointing out of it, so the work/flow direction reads at a glance.
 */
function FrontMarker({ w, h, radius, colour }: { w: number; h: number; radius: number; colour: string }) {
    const t = Math.min(3, h * 0.08) // strip thickness, px
    const inset = Math.max(radius, 2)
    const a = Math.min(5, w * 0.08, h * 0.12) // arrow half-width, px
    const stripY = h / 2 - t - 1.5

    return (
        <Group listening={false}>
            <Rect x={-w / 2 + inset} y={stripY} width={w - 2 * inset} height={t} cornerRadius={t / 2} fill={colour} opacity={0.85} />
            {/* A small tab poking out of the front edge, clear of the label inside. */}
            <Line points={[-a, h / 2, a, h / 2, 0, h / 2 + a * 0.9]} closed fill={colour} lineJoin="round" />
        </Group>
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
    // Turned with the machine, around the zone's own centre.
    const zone = clearanceRect(type, machine)
    const colour = valid ? CANVAS.valid : CANVAS.invalid
    return (
        <Rect
            x={zone.cx * SCALE}
            y={zone.cy * SCALE}
            width={zone.width * SCALE}
            height={zone.depth * SCALE}
            offsetX={(zone.width * SCALE) / 2}
            offsetY={(zone.depth * SCALE) / 2}
            rotation={zone.rotation}
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
