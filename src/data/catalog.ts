import type { EquipmentCategoryId } from '@/data/categories'
import type { MachineType } from '@/types'

/** A catalog machine: the backend MachineType plus a UI-side category. */
export interface CatalogMachine extends MachineType {
  category: EquipmentCategoryId
}

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
    id: 'belt-conveyor',
    category: 'material-handling',
    name: 'Belt conveyor (6 m section)',
    width: 6000,
    depth: 800,
    clearance: { front: 600, back: 600, left: 300, right: 300 },
    powerKw: 1.5,
    needsWater: false,
    needsFireSuppression: false,
  },
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
