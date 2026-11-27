import type { EquipmentCategoryId } from '@/data/categories'
import {
  CONVEYOR_KW_PER_M,
  CONVEYOR_WIDTH,
  DEFAULT_CONVEYOR_LENGTH,
  type ConveyorPiece,
} from '@/data/conveyors'
import type { MachineInstance, MachineType } from '@/types'
import { z } from 'zod'

/** A catalog machine: the backend MachineType plus a UI-side category. */
export interface CatalogMachine extends MachineType {
  category: EquipmentCategoryId
  /** Name in the catalog list, e.g. "Assembly jig (large)"; `name` is the full description. */
  shortName: string
  /** Set for conveyor pieces. A straight's width is its length (along x at rotation 0). */
  conveyor?: ConveyorPiece
  /** Typical number of people working at it (a placed station can set its own). */
  people?: number
  /**
   * False for things that support the work but aren't workstations (cabinets, shelves,
   * pallet spots); they don't count towards the station goal. Conveyors never count.
   */
  station?: false
}

const CatalogMachineSchema = z.object({
  id: z.string(),
  category: z.enum([
    'machining',
    'forming',
    'welding',
    'material-handling',
    'assembly-packing',
    'storage',
    'support',
  ]),
  name: z.string(),
  shortName: z.string(),
  width: z.number().positive(),
  depth: z.number().positive(),
  clearance: z.object({
    front: z.number().nonnegative(),
    back: z.number().nonnegative(),
    left: z.number().nonnegative(),
    right: z.number().nonnegative(),
  }),
  powerKw: z.number().nonnegative(),
  needsWater: z.boolean(),
  needsFireSuppression: z.boolean(),
  height: z.number().positive().optional(),
  conveyor: z.enum(['straight', 'corner-left', 'corner-right']).optional(),
  people: z.number().int().positive().optional(),
  station: z.literal(false).optional(),
}) satisfies z.ZodType<CatalogMachine>

/** Drive power for a length of belt, kW (two decimals). */
export const conveyorKw = (mm: number) => Math.round(CONVEYOR_KW_PER_M * (mm / 1000) * 100) / 100

const cornerPiece = (side: 'left' | 'right'): CatalogMachine => ({
  id: `conveyor-corner-${side}`,
  category: 'material-handling',
  name: `Conveyor corner (${side} turn)`,
  shortName: `Conveyor corner (${side})`,
  conveyor: `corner-${side}`,
  width: CONVEYOR_WIDTH,
  depth: CONVEYOR_WIDTH,
  clearance: { front: 600, back: 600, left: 600, right: 600 },
  powerKw: conveyorKw(CONVEYOR_WIDTH),
  needsWater: false,
  needsFireSuppression: false,
  height: 900,
})

/**
 * Hardcoded machine catalog. Dimensions in mm, power in kW.
 * Figures are typical for each class of machine, not a specific model.
 */
export const CATALOG: CatalogMachine[] = [
  {
    id: 'cnc-mill',
    category: 'machining',
    name: 'CNC mill (vertical machining centre)',
    shortName: 'CNC mill',
    width: 2500,
    depth: 2200,
    clearance: { front: 1000, back: 600, left: 800, right: 800 },
    powerKw: 22,
    needsWater: true, // coolant
    needsFireSuppression: false,
    height: 2800,
  },
  {
    id: 'cnc-lathe',
    category: 'machining',
    name: 'CNC lathe',
    shortName: 'CNC lathe',
    width: 3000,
    depth: 1800,
    clearance: { front: 1000, back: 600, left: 600, right: 600 },
    powerKw: 18,
    needsWater: true,
    needsFireSuppression: false,
    height: 2100,
  },
  {
    id: 'hydraulic-press',
    category: 'forming',
    name: 'Hydraulic press (100 t)',
    shortName: 'Hydraulic press (100 t)',
    width: 1800,
    depth: 1500,
    clearance: { front: 1200, back: 800, left: 800, right: 800 },
    powerKw: 15,
    needsWater: false,
    needsFireSuppression: true,
    height: 3200,
  },
  {
    id: 'conveyor-straight',
    category: 'material-handling',
    name: 'Belt conveyor',
    shortName: 'Belt conveyor',
    conveyor: 'straight',
    // Default length; each placed belt has its own.
    width: DEFAULT_CONVEYOR_LENGTH,
    depth: CONVEYOR_WIDTH,
    clearance: { front: 600, back: 600, left: 300, right: 300 },
    powerKw: conveyorKw(DEFAULT_CONVEYOR_LENGTH),
    needsWater: false,
    needsFireSuppression: false,
    height: 900,
  },
  cornerPiece('left'),
  cornerPiece('right'),
  {
    id: 'packing-table',
    category: 'assembly-packing',
    name: 'Packing table',
    shortName: 'Packing table',
    width: 2000,
    depth: 1000,
    clearance: { front: 900, back: 0, left: 300, right: 300 },
    powerKw: 0,
    needsWater: false,
    needsFireSuppression: false,
    height: 900,
  },
  {
    id: 'air-compressor',
    category: 'support',
    name: 'Air compressor (screw)',
    shortName: 'Air compressor',
    width: 1500,
    depth: 1000,
    clearance: { front: 1000, back: 800, left: 600, right: 600 },
    powerKw: 37,
    needsWater: true, // cooling
    needsFireSuppression: true,
    height: 1700,
  },

  // --- Assembly (the hardest layouts at Saab: jigs with 2–3 people each, benches, tools) ---
  {
    id: 'assembly-jig-large',
    category: 'assembly-packing',
    name: 'Assembly jig, large (fuselage/wing section)',
    shortName: 'Assembly jig (large)',
    width: 6000,
    depth: 3000,
    // Worked from all sides, with platforms and parts trolleys around it.
    clearance: { front: 1500, back: 1200, left: 1200, right: 1200 },
    powerKw: 3, // lighting, drills, vacuum
    needsWater: false,
    needsFireSuppression: false,
    height: 3500,
    people: 3,
  },
  {
    id: 'assembly-jig-small',
    category: 'assembly-packing',
    name: 'Assembly jig, small (sub-assembly)',
    shortName: 'Assembly jig (small)',
    width: 3000,
    depth: 2000,
    clearance: { front: 1200, back: 1000, left: 1000, right: 1000 },
    powerKw: 1.5,
    needsWater: false,
    needsFireSuppression: false,
    height: 2200,
    people: 2,
  },
  {
    id: 'work-bench',
    category: 'assembly-packing',
    name: 'Heavy work bench (with vice)',
    shortName: 'Work bench',
    width: 2400,
    depth: 850,
    clearance: { front: 1000, back: 0, left: 300, right: 300 },
    powerKw: 0,
    needsWater: false,
    needsFireSuppression: false,
    height: 900,
    people: 1,
  },
  {
    id: 'assembly-table',
    category: 'assembly-packing',
    name: 'Assembly table (free all round)',
    shortName: 'Assembly table',
    width: 2400,
    depth: 1200,
    clearance: { front: 900, back: 900, left: 900, right: 900 },
    powerKw: 0,
    needsWater: false,
    needsFireSuppression: false,
    height: 900,
    people: 2,
  },
  {
    id: 'quality-table',
    category: 'assembly-packing',
    name: 'Quality-control table',
    shortName: 'Quality-control table',
    width: 2200,
    depth: 1000,
    clearance: { front: 1000, back: 300, left: 500, right: 500 },
    powerKw: 0.5, // inspection lighting, measuring equipment
    needsWater: false,
    needsFireSuppression: false,
    height: 900,
    people: 1,
  },

  // --- Machining ---
  {
    id: 'pillar-drill',
    category: 'machining',
    name: 'Pillar drill',
    shortName: 'Pillar drill',
    width: 800,
    depth: 600,
    clearance: { front: 1000, back: 300, left: 500, right: 500 },
    powerKw: 1.5,
    needsWater: false,
    needsFireSuppression: false,
    height: 1800,
    people: 1,
  },
  {
    id: 'band-saw',
    category: 'machining',
    name: 'Metal band saw',
    shortName: 'Band saw',
    width: 2000,
    depth: 900,
    // Bar stock is fed in from the sides.
    clearance: { front: 1000, back: 300, left: 1500, right: 1500 },
    powerKw: 2.2,
    needsWater: true, // coolant
    needsFireSuppression: false,
    height: 1400,
    people: 1,
  },

  // --- Welding & sheet metal ---
  {
    id: 'welding-table',
    category: 'welding',
    name: 'Welding table (MIG/TIG, with extraction)',
    shortName: 'Welding table',
    width: 2000,
    depth: 1000,
    clearance: { front: 1200, back: 600, left: 800, right: 800 },
    powerKw: 12,
    needsWater: false,
    needsFireSuppression: true,
    height: 900,
    people: 1,
  },
  {
    id: 'grinding-bench',
    category: 'welding',
    name: 'Grinding bench (with extraction)',
    shortName: 'Grinding bench',
    width: 1800,
    depth: 800,
    clearance: { front: 1000, back: 0, left: 600, right: 600 },
    powerKw: 3,
    needsWater: false,
    needsFireSuppression: true,
    height: 1200,
    people: 1,
  },
  {
    id: 'press-brake',
    category: 'welding',
    name: 'Press brake',
    shortName: 'Press brake',
    width: 3200,
    depth: 1500,
    // Long sheets are handled at the front and swing out to the sides.
    clearance: { front: 1500, back: 800, left: 1000, right: 1000 },
    powerKw: 15,
    needsWater: false,
    needsFireSuppression: false,
    height: 2600,
    people: 1,
  },

  // --- Forming ---
  {
    id: 'hydraulic-press-30t',
    category: 'forming',
    name: 'Hydraulic press (30 t)',
    shortName: 'Hydraulic press (30 t)',
    width: 1200,
    depth: 1000,
    clearance: { front: 1000, back: 500, left: 600, right: 600 },
    powerKw: 5.5,
    needsWater: false,
    needsFireSuppression: false,
    height: 2200,
    people: 1,
  },

  // --- Storage & logistics (not workstations) ---
  {
    id: 'tool-cabinet',
    category: 'storage',
    name: 'Tool cabinet',
    shortName: 'Tool cabinet',
    width: 1000,
    depth: 500,
    clearance: { front: 900, back: 0, left: 0, right: 0 },
    powerKw: 0,
    needsWater: false,
    needsFireSuppression: false,
    height: 2000,
    station: false,
  },
  {
    id: 'tool-trolley',
    category: 'storage',
    name: 'Tool trolley',
    shortName: 'Tool trolley',
    width: 800,
    depth: 500,
    clearance: { front: 600, back: 0, left: 0, right: 0 },
    powerKw: 0,
    needsWater: false,
    needsFireSuppression: false,
    height: 1000,
    station: false,
  },
  {
    id: 'storage-shelf',
    category: 'storage',
    name: 'Storage shelf / pallet rack',
    shortName: 'Storage shelf',
    width: 2700,
    depth: 1100,
    // Reached with a forklift or pallet truck from the front.
    clearance: { front: 1500, back: 0, left: 0, right: 0 },
    powerKw: 0,
    needsWater: false,
    needsFireSuppression: false,
    height: 3000,
    station: false,
  },
  {
    id: 'eur-pallet',
    category: 'storage',
    name: 'EUR-pallet spot (1.2 × 0.8 m)',
    shortName: 'EUR-pallet spot',
    width: 1200,
    depth: 800,
    clearance: { front: 800, back: 0, left: 200, right: 200 },
    powerKw: 0,
    needsWater: false,
    needsFireSuppression: false,
    height: 1000,
    station: false,
  },
  {
    id: 'chemicals-cabinet',
    category: 'storage',
    name: 'Chemicals cabinet (fire-rated)',
    shortName: 'Chemicals cabinet',
    width: 1200,
    depth: 600,
    clearance: { front: 900, back: 0, left: 300, right: 300 },
    powerKw: 0,
    needsWater: false,
    needsFireSuppression: true,
    height: 1950,
    station: false,
  },

  // --- Support ---
  {
    id: 'parts-washer',
    category: 'support',
    name: 'Parts washer',
    shortName: 'Parts washer',
    width: 1200,
    depth: 800,
    clearance: { front: 1000, back: 300, left: 400, right: 400 },
    powerKw: 3,
    needsWater: true,
    needsFireSuppression: false,
    height: 1300,
    people: 1,
  },
]

/** Replace the built-in fallback catalog with the validated backend catalog. */
export function replaceCatalogFromServer(payload: unknown): void {
  const catalog = z.array(CatalogMachineSchema).parse(payload)
  CATALOG.splice(0, CATALOG.length, ...catalog)
}

/** True if a machine type counts as a station towards the goal (not conveyors or storage). */
export function isStation(typeId: string): boolean {
  const type = getMachineType(typeId)
  return type !== undefined && !type.conveyor && type.station !== false
}

/** How many people work at a placed station: its own number if set, else its type's typical one. */
export function machinePeople(m: Pick<MachineInstance, 'typeId' | 'people'>): number | undefined {
  return m.people ?? getMachineType(m.typeId)?.people
}

/** How tall a placed machine is, mm: its own height if set, else its type's typical height. */
export function machineHeight(m: Pick<MachineInstance, 'typeId' | 'height'>): number | undefined {
  return m.height ?? getMachineType(m.typeId)?.height
}

export function getMachineType(id: string): CatalogMachine | undefined {
  return CATALOG.find((t) => t.id === id)
}

/**
 * The type as it applies to one placed machine: a straight belt takes its own length
 * (as width) and the drive power for that length. Use this whenever sizing a placed machine.
 */
export function machineTypeFor(
  m: Pick<MachineInstance, 'typeId'> & Partial<Pick<MachineInstance, 'length' | 'width' | 'depth' | 'clearance'>>,
): CatalogMachine | undefined {
  const type = getMachineType(m.typeId)
  if (!type) return
  const resolved =
    type.conveyor === 'straight' && m.length !== undefined
      ? { ...type, width: m.length, powerKw: conveyorKw(m.length) }
      : type
  return {
    ...resolved,
    ...(m.width !== undefined && { width: m.width }),
    ...(m.depth !== undefined && { depth: m.depth }),
    ...(m.clearance && { clearance: m.clearance }),
  }
}
