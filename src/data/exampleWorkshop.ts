import { DEFAULT_SETUP, type Project } from '@/store'
import type { LayoutComment, MachineInstance, Utility, Wall, Zone } from '@/types'

/**
 * A ready-made example: the 22 × 13 m mechanical workshop from Saab's example drawing
 * (V-2026-02), with its zones, main aisle, side rooms, machines, benches, cabinets and pallet
 * spots, plus an assembly jig. Laid out so it opens with no warnings. All sizes in mm; at
 * rotation 0 a machine's front faces down the plan.
 */

export const EXAMPLE_WORKSHOP_NAME = 'Example: mechanical workshop'

/**
 * A fresh copy of the example (new ids each time), ready to open as a project. Named
 * "Example: mechanical workshop", or "… 2", "… 3" if that name is already in `takenNames`.
 */
export function exampleWorkshop(takenNames: string[] = []): Project {
  const id = () => crypto.randomUUID()
  let name = EXAMPLE_WORKSHOP_NAME
  for (let n = 2; takenNames.includes(name); n++) name = `${EXAMPLE_WORKSHOP_NAME} ${n}`

  const m = (typeId: string, name: string, x: number, y: number, extra: Partial<MachineInstance> = {}): MachineInstance => ({
    id: id(),
    typeId,
    name,
    x,
    y,
    rotation: 0,
    ...extra,
  })
  const u = (kind: Utility['kind'], x: number, y: number, extra: Partial<Utility> = {}): Utility => ({ id: id(), kind, x, y, ...extra })
  const wall = (x1: number, y1: number, x2: number, y2: number): Wall => ({
    id: id(),
    start: { x: x1, y: y1 },
    end: { x: x2, y: y2 },
    thickness: 200,
  })
  const zone = (name: string, kind: Zone['kind'], x1: number, y1: number, x2: number, y2: number, colour: string, maxHeight?: number): Zone => ({
    id: id(),
    name,
    kind,
    x: (x1 + x2) / 2,
    y: (y1 + y2) / 2,
    width: x2 - x1,
    depth: y2 - y1,
    colour,
    ...(maxHeight && { maxHeight }),
  })

  // Front facing up, towards the bench and the aisle; its back keeps clear of the bottom wall.
  const jig = m('assembly-jig-small', 'J1 Wing-spar jig', 2700, 11000, {
    rotation: 180,
    work: 'Drill and rivet the wing spar sub-assembly; check hole pattern against the drawing.',
    people: 2,
  })

  const machines: MachineInstance[] = [
    // Zone 1: machining
    m('cnc-mill', 'M1 CNC mill', 2200, 1700, { width: 2600, depth: 1800, work: '3-axis milling of brackets and fittings.' }),
    m('cnc-lathe', 'M2 Lathe', 6000, 1400, { width: 2800, depth: 1200 }),
    m('pillar-drill', 'M3 Pillar drill', 8900, 1200),
    m('band-saw', 'M4 Band saw', 7400, 3600),
    m('work-bench', 'A1 Measuring bench', 3650, 4100, { work: 'Set-up and measuring for the CNC machines.' }),
    m('tool-cabinet', 'V1 Tool cabinet', 600, 4100),
    m('tool-cabinet', 'V2 Tool cabinet', 1650, 4100),

    // Zone 2: welding & sheet metal
    m('welding-table', 'M5 Welding table 1', 11200, 1500),
    m('welding-table', 'M6 Welding table 2', 11200, 3750),
    m('press-brake', 'M8 Press brake', 15600, 1300, {
      // Stands close to the back and side walls, as in the drawing.
      clearance: { front: 1500, back: 300, left: 200, right: 200 },
    }),
    m('grinding-bench', 'M7 Grinding bench', 15600, 4500),
    m('tool-cabinet', 'V3 Welding cabinet', 13500, 4700),

    // Technical room
    m('air-compressor', 'M9 Compressor', 19700, 5600),

    // Tool store
    ...[700, 1900, 3100].map((y, i) =>
      m('storage-shelf', `H${i + 1} Shelf`, 20300, y, { depth: 600, clearance: { front: 600, back: 0, left: 0, right: 0 } }),
    ),

    // Office
    m('work-bench', 'Office desk', 19700, 9400, { people: 1 }),
    m('storage-shelf', 'Lockers (6)', 19900, 12500, {
      rotation: 180,
      width: 2800,
      depth: 400,
      height: 2000,
      clearance: { front: 800, back: 0, left: 0, right: 0 },
    }),

    // Zone 4: assembly & service
    m('work-bench', 'A2 Work bench 1', 1700, 7900),
    m('tool-trolley', 'V4 Tool trolley', 3600, 7750),
    m('assembly-table', 'A3 Assembly table', 6500, 9000, { work: 'Pre-assembly of brackets before they go to the jig.' }),
    m('quality-table', 'A5 Quality control', 11000, 8800, { work: 'Final inspection before parts go to the loading area.' }),
    jig,
    m('work-bench', 'A4 Work bench 3', 7000, 12450, { rotation: 180 }),
    m('hydraulic-press-30t', 'M10 Press 30 t', 9500, 12000, { rotation: 180 }),
    m('parts-washer', 'M11 Parts washer', 11300, 12000, { rotation: 180 }),
    m('chemicals-cabinet', 'Chemicals cabinet', 12950, 12550, { rotation: 180 }),

    // Zone 5: in/out loading
    m('eur-pallet', 'EUR pallet 1', 14800, 8700),
    m('eur-pallet', 'EUR pallet 2', 16400, 8700),
    m('eur-pallet', 'EUR pallet 3', 14800, 10500),
  ]

  const utilities: Utility[] = [
    // Exits: the emergency exit on the left wall and the 3 m folding door at the bottom.
    u('exit', 0, 6200),
    u('exit', 15400, 13000),
    // Fire extinguishers (B in the drawing): by both ends of the aisle and by the loading area.
    u('extinguisher', 400, 5000, { radius: 25000 }),
    u('extinguisher', 17100, 5000, { radius: 25000 }),
    u('extinguisher', 13700, 12800, { radius: 25000 }),
    // Power: machining, welding, assembly, and the main switchboard in the technical room.
    u('power', 4500, 200, { radius: 8000, capacityKw: 63 }),
    u('power', 13000, 200, { radius: 8000, capacityKw: 63 }),
    u('power', 6500, 12900, { radius: 8000, capacityKw: 63 }),
    u('power', 21700, 7800, { radius: 8000, capacityKw: 63 }),
    // Water: coolant for the CNCs and saw, the parts washer, and compressor cooling.
    u('water', 5000, 4900, { radius: 6000 }),
    u('water', 11000, 12900, { radius: 6000 }),
    u('water', 19000, 4400, { radius: 6000 }),
    // Sprinklers over the welding tables, grinder, compressor and chemicals cabinet.
    u('sprinkler', 11200, 2600, { radius: 3000 }),
    u('sprinkler', 15600, 4000, { radius: 3000 }),
    u('sprinkler', 19700, 6600, { radius: 3000 }),
    u('sprinkler', 12950, 11300, { radius: 3000 }),
  ]

  // The three side rooms, with a door opening (1.2 m clear) into each from the workshop. The tool
  // store's door sits between the press brake and the grinding bench, where it can be reached.
  const walls: Wall[] = [
    wall(17500, 100, 17500, 2700),
    wall(17500, 3900, 17500, 5500),
    wall(17500, 6900, 17500, 9700),
    wall(17500, 11100, 17500, 12900),
    wall(17600, 4200, 21900, 4200),
    wall(17600, 8200, 21900, 8200),
  ]

  const zones: Zone[] = [
    zone('Zone 1: Machining', 'area', 100, 100, 9700, 5100, '#004c97'),
    zone('Zone 2: Welding & sheet metal', 'area', 9900, 100, 17300, 5100, '#da291c'),
    zone('Main aisle', 'aisle', 100, 5250, 17300, 7150, '#fa9900'),
    zone('Zone 4: Assembly & service', 'area', 100, 7300, 13300, 12900, '#2f9e57'),
    zone('Zone 5: In/out loading', 'area', 13500, 7300, 17300, 12900, '#7b5cd6'),
    zone('Office (low ceiling)', 'height', 17600, 8300, 21900, 12900, '#5a5751', 2500),
  ]

  const comments: LayoutComment[] = [
    {
      id: id(),
      x: jig.x,
      y: jig.y,
      targetId: jig.id,
      author: 'Victoria',
      createdAt: new Date().toISOString(),
      message: 'Can the overhead crane reach the jig here? Check before we fix it to the floor.',
      status: 'open',
    },
  ]

  return {
    floorplan: { id: id(), name, width: 22000, depth: 13000, gridSize: 500 },
    machines,
    utilities,
    pillars: [],
    walls,
    zones,
    comments,
    setup: {
      ...DEFAULT_SETUP,
      floorName: name,
      stationTarget: 18,
      categories: ['machining', 'welding', 'assembly-packing', 'storage', 'support'],
    },
  }
}
