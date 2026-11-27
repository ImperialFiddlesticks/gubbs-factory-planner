import { CANVAS, COLORS } from '@/theme'

/** Colours a station can be given on the plan, e.g. one per product line. The first is the default. */
export const MACHINE_COLOURS = [
  { name: 'Blue', hex: CANVAS.machineFill },
  { name: 'Cyan', hex: COLORS.cyan },
  { name: 'Green', hex: COLORS.green },
  { name: 'Orange', hex: COLORS.yellowDark },
  { name: 'Violet', hex: COLORS.violet },
  { name: 'Red', hex: COLORS.red },
  { name: 'Grey', hex: COLORS.charcoal600 },
] as const
