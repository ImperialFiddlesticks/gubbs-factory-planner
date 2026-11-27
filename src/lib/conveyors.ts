import { conveyorKw, machineTypeFor } from '@/data/catalog'
import { bodyRect, distanceToRect } from '@/lib/geometry'
import type { MachineInstance, Point, Rotation } from '@/types'

/** How close (mm) a piece's end must come to a free end to snap onto it. */
export const CONVEYOR_SNAP_DISTANCE = 500
/** How close (mm) a machine's body must come to a free conveyor end to snap onto it. */
export const MACHINE_SNAP_DISTANCE = 800
/** Ends this close (mm) count as joined. */
const JOIN_TOLERANCE = 1

/** One end of a conveyor piece: where it is and which way goods move through it. */
export interface Port {
    point: Point
    dir: Point
}

export interface ConveyorPorts {
    in: Port
    out: Port
}

/** Turn a vector clockwise by the rotation (y grows down, so (1, 0) at 90° becomes (0, 1)). */
function rotate(p: Point, rotation: Rotation): Point {
    const radians = (rotation * Math.PI) / 180
    const cos = Math.cos(radians)
    const sin = Math.sin(radians)

    return {
        x: cos * p.x - sin * p.y,
        y: sin * p.x + cos * p.y,
    }
}

/**
 * Input and output of a conveyor piece, or null for other machines. In the piece's own frame
 * goods enter at the middle of the left edge moving +x, and leave through the right edge
 * (straight), the bottom edge (right turn) or the top edge (left turn).
 */
export function conveyorPorts(m: Pick<MachineInstance, 'typeId' | 'length' | 'x' | 'y' | 'rotation'>): ConveyorPorts | null {
    const type = machineTypeFor(m)
    if (!type?.conveyor) return null
    const half = type.width / 2
    const local: ConveyorPorts =
        type.conveyor === 'straight'
            ? { in: { point: { x: -half, y: 0 }, dir: { x: 1, y: 0 } }, out: { point: { x: half, y: 0 }, dir: { x: 1, y: 0 } } }
            : type.conveyor === 'corner-right'
                ? { in: { point: { x: -half, y: 0 }, dir: { x: 1, y: 0 } }, out: { point: { x: 0, y: half }, dir: { x: 0, y: 1 } } }
                : { in: { point: { x: -half, y: 0 }, dir: { x: 1, y: 0 } }, out: { point: { x: 0, y: -half }, dir: { x: 0, y: -1 } } }
    const place = (port: Port): Port => {
        const p = rotate(port.point, m.rotation)
        return { point: { x: m.x + p.x, y: m.y + p.y }, dir: rotate(port.dir, m.rotation) }
    }
    return { in: place(local.in), out: place(local.out) }
}

/**
 * True if two flow directions (unit vectors) point the same way. Compared with a tolerance:
 * directions come from cos/sin of the rotation, so 90° gives x = 6e-17 rather than exactly 0.
 */
const sameDir = (a: Point, b: Point) => Math.abs(a.x - b.x) < 1e-6 && Math.abs(a.y - b.y) < 1e-6
const gap = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y)

/** True if an output and an input meet end to end with goods flowing the same way. */
export const joined = (out: Port, input: Port) =>
    sameDir(out.dir, input.dir) && gap(out.point, input.point) <= JOIN_TOLERANCE

/**
 * Where a conveyor can join a (non-conveyor) machine: the middle of its front edge (the front
 * faces down at rotation 0). It works both ways: `out` is goods leaving the machine onto a belt,
 * `in` is a belt feeding goods into it.
 */
export function machineFront(m: MachineInstance): { point: Point; out: Port; in: Port } | null {
    const type = machineTypeFor(m)
    if (!type || type.conveyor) return null
    const p = rotate({ x: 0, y: type.depth / 2 }, m.rotation)
    const normal = rotate({ x: 0, y: 1 }, m.rotation)
    const point = { x: m.x + p.x, y: m.y + p.y }
    return { point, out: { point, dir: normal }, in: { point, dir: { x: -normal.x, y: -normal.y } } }
}

/** Every join on the floor: conveyor to conveyor, and conveyor to machine front. */
function joins(machines: MachineInstance[]) {
    const pieces = machines.flatMap((m) => {
        const ports = conveyorPorts(m)
        return ports ? [{ id: m.id, ports }] : []
    })
    const fronts = machines.flatMap((m) => {
        const front = machineFront(m)
        return front ? [{ id: m.id, front }] : []
    })
    /** Conveyor piece ids whose input / output is joined to something. */
    const inTaken = new Set<string>()
    const outTaken = new Set<string>()
    /** Machine ids whose front has a conveyor on it. */
    const frontTaken = new Set<string>()
    /** "conveyorId|machineId" for each conveyor joined to a machine front. */
    const machineLinks = new Set<string>()
    for (const p of pieces) {
        for (const o of pieces) {
            if (o.id !== p.id && joined(p.ports.out, o.ports.in)) {
                outTaken.add(p.id)
                inTaken.add(o.id)
            }
        }
        for (const m of fronts) {
            const takes = joined(m.front.out, p.ports.in) // belt takes goods out of the machine
            const feeds = joined(p.ports.out, m.front.in) // belt feeds goods into the machine
            if (takes) inTaken.add(p.id)
            if (feeds) outTaken.add(p.id)
            if (takes || feeds) {
                frontTaken.add(m.id)
                machineLinks.add(`${p.id}|${m.id}`)
            }
        }
    }
    return { pieces, fronts, inTaken, outTaken, frontTaken, machineLinks }
}

/**
 * Free ends: conveyor inputs nothing feeds, outputs that feed nothing, and machine fronts
 * with no conveyor on them.
 */
export function freeEnds(machines: MachineInstance[]) {
    const j = joins(machines)
    return {
        inputs: j.pieces.filter((p) => !j.inTaken.has(p.id)).map((p) => p.ports.in),
        outputs: j.pieces.filter((p) => !j.outTaken.has(p.id)).map((p) => p.ports.out),
        fronts: j.fronts.filter((m) => !j.frontTaken.has(m.id)).map((m) => m.front),
    }
}

/** True if conveyor piece `a` and machine `b` (either order) are joined at the machine's front. */
export function conveyorMachineLinks(machines: MachineInstance[]) {
    const links = joins(machines).machineLinks
    return (a: string, b: string) => links.has(`${a}|${b}`) || links.has(`${b}|${a}`)
}

/**
 * Where a conveyor piece should go so one of its ends joins a nearby free end: another piece's
 * free output or input, or a free machine front (taking goods out of it, or feeding them in),
 * with goods flowing the same way. Returns
 * the snapped centre, or null when nothing is within CONVEYOR_SNAP_DISTANCE (or it isn't a conveyor).
 * `others` are the other pieces on the floor (the moving one is skipped by id).
 */
export function snapConveyor(piece: MachineInstance, others: MachineInstance[]): Point | null {
    const shift = snapShift([piece], others)
    return shift && { x: Math.round(piece.x + shift.x), y: Math.round(piece.y + shift.y) }
}

/**
 * How far to move a set of conveyor pieces (one piece, or a whole run being dragged together)
 * so one of its free ends joins a nearby free end on the floor. Null when nothing is in range.
 * `all` is everything on the floor; the moving pieces are skipped by id.
 */
export function snapShift(moving: MachineInstance[], all: MachineInstance[]): Point | null {
    const ids = new Set(moving.map((m) => m.id))
    const own = freeEnds(moving)
    if (own.inputs.length + own.outputs.length === 0) return null
    const { inputs, outputs, fronts } = freeEnds(all.filter((o) => !ids.has(o.id)))
    let best: { shift: Point; d: number } | null = null
    const consider = (from: Port, to: Port) => {
        if (!sameDir(from.dir, to.dir)) return
        const d = gap(from.point, to.point)
        if (d <= CONVEYOR_SNAP_DISTANCE && (!best || d < best.d)) {
            best = { shift: { x: to.point.x - from.point.x, y: to.point.y - from.point.y }, d }
        }
    }
    for (const mineIn of own.inputs) {
        for (const out of outputs) consider(mineIn, out)
        for (const front of fronts) consider(mineIn, front.out)
    }
    for (const mineOut of own.outputs) {
        for (const input of inputs) consider(mineOut, input)
        for (const front of fronts) consider(mineOut, front.in)
    }
    return best ? (best as { shift: Point }).shift : null
}

/** The rotation (whole degrees) that turns a machine's front to face along `normal`. */
function rotationFacing(normal: Point): Rotation {
    // At rotation r the front faces (-sin r, cos r); see machineFront.
    const degrees = Math.round((Math.atan2(-normal.x, normal.y) * 180) / Math.PI)
    return (degrees + 360) % 360
}

/**
 * Where a (non-conveyor) machine should go to finish a conveyor run: when its body comes near a
 * free belt end, it jumps there and turns so its front faces the belt — taking goods off a
 * belt's output, or feeding goods onto a belt's input. Returns its new centre and rotation, or
 * null when no free end is near. `all` is everything on the floor (the machine is skipped).
 */
export function snapMachineToConveyor(
    machine: MachineInstance,
    all: MachineInstance[],
): { x: number; y: number; rotation: Rotation } | null {
    const type = machineTypeFor(machine)
    if (!type || type.conveyor) return null
    const { inputs, outputs } = freeEnds(all.filter((o) => o.id !== machine.id))
    const body = bodyRect(type, machine)

    let best: { x: number; y: number; rotation: Rotation; d: number } | null = null
    /** Put the middle of the machine's front on `port`, facing along `normal`. */
    const consider = (port: Port, normal: Point) => {
        const d = distanceToRect(port.point.x, port.point.y, body)
        if (d > MACHINE_SNAP_DISTANCE || (best && d >= best.d)) return
        const rotation = rotationFacing(normal)
        const front = rotate({ x: 0, y: type.depth / 2 }, rotation)
        best = { x: Math.round(port.point.x - front.x), y: Math.round(port.point.y - front.y), rotation, d }
    }
    // A belt delivering goods: the machine faces back up the belt.
    for (const out of outputs) consider(out, { x: -out.dir.x, y: -out.dir.y })
    // A belt taking goods away: the machine faces along it.
    for (const input of inputs) consider(input, input.dir)

    if (!best) return null
    const { x, y, rotation } = best as { x: number; y: number; rotation: Rotation }
    return { x, y, rotation }
}

/**
 * Which way goods travel on a straight belt, as a unit vector. At rotation 0 a belt flows
 * left to right (+x); rotation is clockwise, so 90 flows down the floor (+y).
 */
export function flowDirection(rotation: Rotation): Point {
    return rotate({ x: 1, y: 0}, rotation)
}

/**
 * New centre for a straight belt whose length changes from `from` to `to` (mm),
 * keeping its input end where it is so it grows or shrinks in the flow direction.
 */
export function resizedBeltCentre(centre: Point, rotation: Rotation, from: number, to: number): Point {
    const dir = flowDirection(rotation)
    const shift = (to - from) / 2
    return { x: Math.round(centre.x + dir.x * shift), y: Math.round(centre.y + dir.y * shift) }
}

/** Conveyor pieces joined end to end: one line of belts with a single drive. */
export interface ConveyorRun {
    /** Stable id for keys and messages: the run's first piece id (in floor order). */
    id: string
    pieceIds: string[]
    /** Total belt length, mm (a corner counts its own size). */
    length: number
    /** Drive power for the whole run, kW. */
    powerKw: number
}

/** Every conveyor run on the floor (a lone piece is a run of one), and each piece's run by id. */
export function conveyorRuns(machines: MachineInstance[]) {
    const pieces = machines.flatMap((m) => {
        const ports = conveyorPorts(m)
        const type = machineTypeFor(m)
        return ports && type ? [{ id: m.id, ports, length: type.width }] : []
    })
    // Union-find over joined ends.
    const parent = new Map(pieces.map((p) => [p.id, p.id]))
    const root = (id: string): string => {
        const up = parent.get(id) ?? id
        if (up === id) return id
        const top = root(up)
        parent.set(id, top)
        return top
    }
    for (const a of pieces) {
        for (const b of pieces) {
            if (a !== b && joined(a.ports.out, b.ports.in)) parent.set(root(a.id), root(b.id))
        }
    }
    const byRoot = new Map<string, typeof pieces>()
    for (const p of pieces) byRoot.set(root(p.id), [...(byRoot.get(root(p.id)) ?? []), p])

    const runs: ConveyorRun[] = [...byRoot.values()].map((members) => {
        const length = members.reduce((sum, p) => sum + p.length, 0)
        return { id: members[0].id, pieceIds: members.map((p) => p.id), length, powerKw: conveyorKw(length) }
    })
    const runOf = new Map<string, ConveyorRun>()
    for (const run of runs) for (const id of run.pieceIds) runOf.set(id, run)
    return { runs, runOf }
}
