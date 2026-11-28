import type { EquipmentCategoryId } from '@/data/categories'
import { CANVAS, COLORS } from '@/theme'

/** Colours a station can be given on the plan, e.g. one per product line. */
export const MACHINE_COLOURS = [
  { name: 'Blue', hex: CANVAS.machineFill },
  { name: 'Cyan', hex: COLORS.cyan },
  { name: 'Green', hex: COLORS.green },
  { name: 'Orange', hex: COLORS.yellowDark },
  { name: 'Violet', hex: COLORS.violet },
  { name: 'Red', hex: COLORS.red },
  { name: 'Grey', hex: COLORS.charcoal600 },
] as const

/**
 * Automatic colour per equipment category, used when a station has no colour of its own.
 * Friendly mid tones; red, green and yellow are left for warnings and feedback.
 */
export const CATEGORY_COLOURS: Record<EquipmentCategoryId, string> = {
  machining: '#2f6db5', // blue
  forming: '#c0693f', // terracotta
  welding: '#7b5cd6', // violet
  'material-handling': '#5f8db3', // dusty blue (belts)
  'assembly-packing': '#1f8a84', // teal
  storage: '#9a7a4e', // wood
  support: '#6b6f76', // grey
}

/** The colour a station is drawn in: its own, or its category's. */
export function stationColour(colour: string | undefined, category: EquipmentCategoryId | undefined): string {
  return colour ?? (category ? CATEGORY_COLOURS[category] : CANVAS.machineFill)
}
