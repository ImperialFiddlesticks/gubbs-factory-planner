import { exampleWorkshop } from '@/data/exampleWorkshop'
import { DEFAULT_LOADING_DOCK_DEPTH_MM, DEFAULT_LOADING_DOCK_HEIGHT_MM, nearestLoadingDockPosition } from '@/lib/loadingDocks'
import type { Project } from '@/store'
import type { LayoutComment, LoadingBay, LoadingDock, MachineInstance, Zone } from '@/types'

/**
 * The three projects for the demo video "Friday at Ten" (see TODO.md): Workshop 3, the example
 * workshop, on Monday morning; Victoria's finished layout on Friday; and the "Option B" it beats
 * in Compare. Each is a fresh copy (new ids), built from the example by changing only what the
 * story needs. All sizes in mm.
 *
 * The story's trade-off: the workshop is full, so to fit the two new jigs the pre-assembly table
 * goes (the jigs take over that work) and the pallet spots move out to an outdoor loading bay.
 */

export const DEMO_MONDAY = 'Workshop 3 – Monday'
export const DEMO_OPTION_B = 'Workshop 3 – Option B'
export const DEMO_FRIDAY = 'Workshop 3 – Friday'

/** Placed stations on Friday: the example's 18, minus the assembly table, plus two jigs. */
const STATION_TARGET = 19

/** The demo projects, in the order they are added: Monday is opened last, so it is the open one. */
export function demoProjects(): Project[] {
  return [fridayLayout(), optionBLayout(), mondayLayout()]
}

/** The example renamed to Workshop 3, with the demo's station goal and no comments. */
function workshop3(name: string): Project {
  const p = exampleWorkshop()
  return {
    ...p,
    floorplan: { ...p.floorplan, name },
    comments: [],
    setup: { ...p.setup, floorName: 'Workshop 3', stationTarget: STATION_TARGET },
  }
}

/** Monday 07:42: Workshop 3 as it is today. Every check passes; 18 of 19 stations. */
function mondayLayout(): Project {
  return workshop3(DEMO_MONDAY)
}

// --- Friday: Victoria's layout -------------------------------------------------------------

/** The large jig: in the middle of Zone 4, front towards the main aisle (where the tables were). */
const J2 = { x: 9000, y: 8750, rotation: 180 }
/** Where Magnus finds it on Wednesday: 0.25 m too far up, its body in the main aisle. */
const J2_IN_AISLE = { ...J2, y: 8500 }
/**
 * The small jig, top of Zone 5, front facing down towards the QC table. It stands close to the
 * office wall, so it keeps less free space on that side (like the press brake).
 */
const J3 = { x: 15000, y: 8250, rotation: 0, clearance: { front: 1200, back: 1000, left: 1000, right: 700 } }
/** Belt from the small jig's front down to the QC table. */
const BELT_LENGTH = 1500

function fridayLayout(): Project {
  const p = workshop3(DEMO_FRIDAY)
  const id = () => crypto.randomUUID()
  const keep = p.machines.filter((m) => !['A3 Assembly table', 'EUR pallet 1', 'EUR pallet 2', 'EUR pallet 3'].includes(m.name ?? ''))

  const jigFront = J3.y + 1000 // the small jig is 2 m deep; at rotation 0 its front is its bottom edge
  const machines: MachineInstance[] = [
    // The QC table turns to face the belt and gets a station colour of its own.
    ...keep.map((m) =>
      m.name === 'A5 Quality control'
        ? { ...m, x: J3.x, y: jigFront + BELT_LENGTH + 500, rotation: 180, work: 'Final inspection of jig output before it goes out to the loading bay.' }
        : m,
    ),
    {
      id: id(),
      typeId: 'assembly-jig-large',
      name: 'J2 Fuselage-panel jig',
      ...J2_IN_AISLE,
      work: 'Assemble and rivet fuselage side panels; takes over the pre-assembly table work.',
      people: 3,
    },
    {
      id: id(),
      typeId: 'assembly-jig-small',
      name: 'J3 Spar-cap jig',
      ...J3,
      work: 'Drill and fit spar caps; parts go straight on the belt to quality control.',
      people: 2,
    },
    {
      id: id(),
      typeId: 'conveyor-straight',
      x: J3.x,
      y: jigFront + BELT_LENGTH / 2,
      rotation: 90, // flowing down, from the jig to the QC table
      length: BELT_LENGTH,
    },
  ]

  const j2 = machines.find((m) => m.name === 'J2 Fuselage-panel jig')!
  const comments: LayoutComment[] = [
    {
      id: id(),
      x: j2.x,
      y: j2.y,
      targetId: j2.id,
      author: 'Magnus (maintenance)',
      createdAt: '2026-11-25T09:14:00',
      message: 'J2 sticks into the main aisle – our forklifts need the full width. Can it move down a little?',
      status: 'open',
    },
  ]

  return {
    ...p,
    machines,
    // A new power point on the wall by the belt: the old ones are behind the office wall.
    utilities: [...p.utilities, { id: id(), kind: 'power', x: 16500, y: p.floorplan.depth, radius: 8000, capacityKw: 63 }],
    zones: [...(p.zones ?? []), craneRunway(id)],
    comments,
    ...outdoorPalletBay(p, id),
  }
}

/** Twist 2: the overhead crane runway over Zone 5 leaves only 3.0 m of height there. */
function craneRunway(id: () => string): Zone {
  return {
    id: id(),
    name: 'Crane runway (3.0 m)',
    kind: 'height',
    x: (13500 + 17300) / 2,
    y: (7300 + 12900) / 2,
    width: 17300 - 13500,
    depth: 12900 - 7300,
    colour: '#7b5cd6',
    maxHeight: 3000,
  }
}

/** The pallet spots move outside: a loading dock at the folding door and a bay in the yard. */
function outdoorPalletBay(p: Project, id: () => string): { loadingDocks: LoadingDock[]; loadingBays: LoadingBay[] } {
  const door = nearestLoadingDockPosition(15400, p.floorplan.depth, p.floorplan)
  if (!door) return { loadingDocks: [], loadingBays: [] }
  const dock: LoadingDock = {
    id: id(),
    name: 'Folding door',
    widthMm: 3000,
    heightMm: DEFAULT_LOADING_DOCK_HEIGHT_MM,
    depthMm: DEFAULT_LOADING_DOCK_DEPTH_MM,
    boundaryOffsetMm: door.offsetMm,
    flowDirection: 'two-way',
  }
  const top = p.floorplan.depth
  const bay: LoadingBay = {
    id: id(),
    name: 'Outdoor pallet bay',
    loadingDockId: dock.id,
    outline: [
      { x: 13400, y: top },
      { x: 17400, y: top },
      { x: 17400, y: top + 4000 },
      { x: 13400, y: top + 4000 },
    ],
  }
  return { loadingDocks: [dock], loadingBays: [bay] }
}

// --- Option B: the one that loses in Compare ------------------------------------------------

/**
 * "Keep the pallets inside": the same jigs as Friday, but the pallet spots stay in the workshop,
 * lined up along the bottom wall, and the QC table is squeezed in by the office door. It looks
 * tidy, but it blocks the office's way out and crowds the loading zone.
 */
function optionBLayout(): Project {
  const p = workshop3(DEMO_OPTION_B)
  const id = () => crypto.randomUUID()
  const moved: Record<string, Partial<MachineInstance>> = {
    'EUR pallet 1': { x: 14200, y: 12400, rotation: 180 },
    'EUR pallet 2': { x: 15700, y: 12400, rotation: 180 },
    'EUR pallet 3': { x: 16800, y: 11300, rotation: 90 },
    'A5 Quality control': { x: 16550, y: 9300, rotation: 90 },
  }
  const machines: MachineInstance[] = [
    ...p.machines
      .filter((m) => m.name !== 'A3 Assembly table')
      .map((m) => (m.name && moved[m.name] ? { ...m, ...moved[m.name] } : m)),
    { id: id(), typeId: 'assembly-jig-large', name: 'J2 Fuselage-panel jig', ...J2, people: 3 },
    { id: id(), typeId: 'assembly-jig-small', name: 'J3 Spar-cap jig', x: 14250, y: 9250, rotation: 90, people: 2 },
  ]
  return { ...p, machines, zones: [...(p.zones ?? []), craneRunway(id)] }
}
