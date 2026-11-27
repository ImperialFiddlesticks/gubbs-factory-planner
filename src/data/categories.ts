/**
 * Equipment categories used by the setup wizard and the catalog.
 * UI-side grouping only; not part of the backend contract in types.ts.
 */
export type EquipmentCategoryId =
  | 'machining'
  | 'forming'
  | 'welding'
  | 'material-handling'
  | 'assembly-packing'
  | 'storage'
  | 'support'

export interface EquipmentCategory {
  id: EquipmentCategoryId
  name: string
  description: string
}

export const EQUIPMENT_CATEGORIES: EquipmentCategory[] = [
  { id: 'machining', name: 'Machining', description: 'CNC mills, lathes and other cutting machines.' },
  { id: 'forming', name: 'Forming', description: 'Presses and other machines that shape material.' },
  { id: 'welding', name: 'Welding & sheet metal', description: 'Welding tables, grinding and press brakes.' },
  { id: 'material-handling', name: 'Material handling', description: 'Conveyors and equipment that move parts around.' },
  { id: 'assembly-packing', name: 'Assembly & packing', description: 'Assembly jigs, workbenches, quality control and packing.' },
  { id: 'storage', name: 'Storage & logistics', description: 'Tool cabinets, shelves and pallet spots.' },
  { id: 'support', name: 'Support equipment', description: 'Compressors and other equipment that serves the line.' },
]
