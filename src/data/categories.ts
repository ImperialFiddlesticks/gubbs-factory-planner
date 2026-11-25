/**
 * Equipment categories used by the setup wizard and the catalog.
 * UI-side grouping only; not part of the backend contract in types.ts.
 */
export type EquipmentCategoryId =
  | 'machining'
  | 'forming'
  | 'material-handling'
  | 'assembly-packing'
  | 'support'

export interface EquipmentCategory {
  id: EquipmentCategoryId
  name: string
  description: string
}

export const EQUIPMENT_CATEGORIES: EquipmentCategory[] = [
  { id: 'machining', name: 'Machining', description: 'CNC mills, lathes and other cutting machines.' },
  { id: 'forming', name: 'Forming', description: 'Presses and other machines that shape material.' },
  { id: 'material-handling', name: 'Material handling', description: 'Conveyors and equipment that move parts around.' },
  { id: 'assembly-packing', name: 'Assembly & packing', description: 'Workbenches, assembly and packing stations.' },
  { id: 'support', name: 'Support equipment', description: 'Compressors and other equipment that serves the line.' },
]
