import type { EquipmentCategoryId } from '@/data/categories'
import {
  CONVEYOR_KW_PER_M,
  CONVEYOR_WIDTH,
  DEFAULT_CONVEYOR_LENGTH,
  type ConveyorPiece,
} from '@/data/conveyors'
import type { MachineInstance, MachineType } from '@/types'

/** A catalog machine: the backend MachineType plus a UI-side category. */
export interface CatalogMachine extends MachineType {
  category: EquipmentCategoryId
  /** Set for conveyor pieces. A straight's width is its length (along x at rotation 0). */
  conveyor?: ConveyorPiece
}

/** Drive power for a length of belt, kW (two decimals). */
export const conveyorKw = (mm: number) => Math.round(CONVEYOR_KW_PER_M * (mm / 1000) * 100) / 100

const cornerPiece = (side: 'left' | 'right'): CatalogMachine => ({
  id: `conveyor-corner-${side}`,
  category: 'material-handling',
  name: `Conveyor corner (${side} turn)`,
  conveyor: `corner-${side}`,
  width: CONVEYOR_WIDTH,
  depth: CONVEYOR_WIDTH,
  clearance: { front: 600, back: 600, left: 600, right: 600 },
  powerKw: conveyorKw(CONVEYOR_WIDTH),
  needsWater: false,
  needsFireSuppression: false,
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
    width: 2500,
    depth: 2200,
    clearance: { front: 1000, back: 600, left: 800, right: 800 },
    powerKw: 22,
    needsWater: true, // coolant
    needsFireSuppression: false,
  },
  {
    id: 'cnc-lathe',
    category: 'machining',
    name: 'CNC lathe',
    width: 3000,
    depth: 1800,
    clearance: { front: 1000, back: 600, left: 600, right: 600 },
    powerKw: 18,
    needsWater: true,
    needsFireSuppression: false,
  },
  {
    id: 'hydraulic-press',
    category: 'forming',
    name: 'Hydraulic press (100 t)',
    width: 1800,
    depth: 1500,
    clearance: { front: 1200, back: 800, left: 800, right: 800 },
    powerKw: 15,
    needsWater: false,
    needsFireSuppression: true,
  },
  {
    id: 'conveyor-straight',
    category: 'material-handling',
    name: 'Belt conveyor',
    conveyor: 'straight',
    // Default length; each placed belt has its own.
    width: DEFAULT_CONVEYOR_LENGTH,
    depth: CONVEYOR_WIDTH,
    clearance: { front: 600, back: 600, left: 300, right: 300 },
    powerKw: conveyorKw(DEFAULT_CONVEYOR_LENGTH),
    needsWater: false,
    needsFireSuppression: false,
  },
  cornerPiece('left'),
  cornerPiece('right'),
  {
    id: 'packing-table',
    category: 'assembly-packing',
    name: 'Packing table',
    width: 2000,
    depth: 1000,
    clearance: { front: 900, back: 0, left: 300, right: 300 },
    powerKw: 0,
    needsWater: false,
    needsFireSuppression: false,
  },
  {
    id: 'air-compressor',
    category: 'support',
    name: 'Air compressor (screw)',
    width: 1500,
    depth: 1000,
    clearance: { front: 1000, back: 800, left: 600, right: 600 },
    powerKw: 37,
    needsWater: true, // cooling
    needsFireSuppression: true,
  },
]

export function getMachineType(id: string): CatalogMachine | undefined {
  return CATALOG.find((t) => t.id === id)
}

/**
 * The type as it applies to one placed machine: a straight belt takes its own length
 * (as width) and the drive power for that length. Use this whenever sizing a placed machine.
 */
export function machineTypeFor(m: Pick<MachineInstance, 'typeId' | 'length'>): CatalogMachine | undefined {
  const type = getMachineType(m.typeId)
  if (type?.conveyor !== 'straight' || m.length === undefined) return type
  return { ...type, width: m.length, powerKw: conveyorKw(m.length) }
}
