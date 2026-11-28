import { COLORS } from '@/theme'
import type { UtilityKind } from '@/types'

export interface UtilityKindInfo {
  kind: UtilityKind
  name: string
  /**
   * Default reach, mm. For extinguishers it is the walking distance; exits have none and
   * use EXIT_MAX_DISTANCE instead.
   */
  defaultRadius?: number
  /** Default supply, kW (power only). */
  defaultCapacityKw?: number
  colour: string
  /** Lucide icon outline (24 x 24 viewBox, stroked), for drawing on the canvas. */
  iconPath: string
}

export const UTILITY_KINDS: Record<UtilityKind, UtilityKindInfo> = {
  power: {
    kind: 'power',
    name: 'Power point',
    defaultCapacityKw: 63,
    colour: COLORS.yellowDark,
    // lucide "zap"
    iconPath:
      'M15.914 4a1.5 1.5 0 00-2.474-1.561l-9 9A1.5 1.5 0 005.5 14h4.002a.5.5 0 01.471.666L8.086 20a1.5 1.5 0 002.475 1.56l9-9A1.5 1.5 0 0018.5 10h-3.997a.5.5 0 01-.472-.667z',
  },
  water: {
    kind: 'water',
    name: 'Water point',
    colour: COLORS.cyan,
    // lucide "droplet"
    iconPath:
      'M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z',
  },
  sprinkler: {
    kind: 'sprinkler',
    name: 'Sprinkler',
    defaultRadius: 3000,
    colour: COLORS.violet,
    // lucide "shower-head"
    iconPath:
      'm4 4 2.5 2.5 M13.5 6.5a4.95 4.95 0 0 0-7 7 M15 5 5 15 M14 17v.01 M10 16v.01 M13 13v.01 M16 10v.01 M11 20v.01 M17 14v.01 M20 11v.01',
  },
  extinguisher: {
    kind: 'extinguisher',
    name: 'Fire extinguisher',
    // Walking distance, not a straight-line reach.
    defaultRadius: 25000,
    colour: COLORS.red,
    // lucide "fire-extinguisher"
    iconPath:
      'M15 6.5V3a1 1 0 0 0-1-1h-2a1 1 0 0 0-1 1v3.5 M9 18h8 M18 3h-3 M11 3a6 6 0 0 0-6 6v11 M5 13h4 M17 10a4 4 0 0 0-8 0v10a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2Z',
  },
  exit: {
    kind: 'exit',
    name: 'Exit',
    colour: COLORS.green,
    // lucide "door-open" (simplified)
    iconPath: 'M10 21H2 M10 3H7a2 2 0 00-2 2v16 M14 12h.01 M22 21h-3',
  },
}

export const UTILITY_LIST = Object.values(UTILITY_KINDS)

/** Every machine should be within this distance of an exit, mm. */
export const EXIT_MAX_DISTANCE = 30000
/** Drawn width of an exit door in the wall, mm (visual only). */
export const EXIT_WIDTH = 1200

/** Reach of a utility, falling back to its kind's default. */
export function utilityRadius(u: { kind: UtilityKind; radius?: number }): number {
  return u.radius ?? UTILITY_KINDS[u.kind].defaultRadius ?? 0
}
