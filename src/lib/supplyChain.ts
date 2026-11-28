/**
 * Supply Chain Simulator (simplified demo). Fictional data and simple deterministic
 * maths; nothing here changes machines or the saved layout.
 */
import type { EquipmentCategoryId } from '@/data/categories'

export interface Material {
  id: string
  name: string
  supplier: string
  inventoryDays: number
  alternativeSupplier: string
  /** Machines in these categories need this material. */
  categories: EquipmentCategoryId[]
}

/** Share of demand the approved alternative supplier covers. */
export const ALTERNATIVE_CAPACITY = 0.6
export const MAX_DELAY_DAYS = 60

export const MATERIALS: Material[] = [
  { id: 'aluminium', name: 'Aluminium', supplier: 'Nordic Alu AB', inventoryDays: 10, alternativeSupplier: 'Baltic Metals Oy', categories: ['machining', 'forming'] },
  { id: 'steel', name: 'Steel', supplier: 'SteelCo Sverige', inventoryDays: 14, alternativeSupplier: 'Ruhr Stahl GmbH', categories: ['welding'] },
  { id: 'electronics', name: 'Electronics', supplier: 'CircuitWorks Ltd', inventoryDays: 7, alternativeSupplier: 'Nordic Electronics AS', categories: ['assembly-packing'] },
]

export function getMaterial(id: string) {
  return MATERIALS.find((m) => m.id === id) ?? MATERIALS[0]!
}

/** Delay minus remaining inventory, never below zero. */
export function shortageDays(delayDays: number, inventoryDays: number) {
  return Math.max(0, delayDays - inventoryDays)
}

export type StationStatus = 'normal' | 'blocked' | 'alternative'

export function stationStatus(category: EquipmentCategoryId | undefined, material: Material, delayDays: number, useAlternative: boolean): StationStatus {
  if (!category || !material.categories.includes(category)) return 'normal'
  if (shortageDays(delayDays, material.inventoryDays) === 0) return 'normal'
  return useAlternative ? 'alternative' : 'blocked'
}

const OUTPUT: Record<StationStatus, number> = { normal: 1, blocked: 0, alternative: ALTERNATIVE_CAPACITY }

/** Equally weighted stations: capacity is the average station output. */
export function simulate(categories: (EquipmentCategoryId | undefined)[], material: Material, delayDays: number, useAlternative: boolean) {
  const statuses = categories.map((c) => stationStatus(c, material, delayDays, useAlternative))
  const capacityPct = statuses.length ? Math.round((statuses.reduce((s, st) => s + OUTPUT[st], 0) / statuses.length) * 100) : 100
  return {
    statuses,
    capacityPct,
    blockedMachines: statuses.filter((s) => s === 'blocked').length,
    shortageDays: shortageDays(delayDays, material.inventoryDays),
  }
}
