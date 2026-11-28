// Saab palette for the Konva canvas. Konva draws to <canvas> and cannot read
// CSS variables, so these mirror the --saab-* values in index.css. Keep in sync.
export const COLORS = {
  charcoal: '#34322e',
  blue: '#004c97',
  blueDark: '#15427b',
  yellow: '#ffb838',
  yellowDark: '#fa9900',
  red: '#da291c',
  white: '#ffffff',
  grey50: '#f3f3f2',
  grey100: '#ececea',
  grey200: '#e4e4e2',
  grey300: '#d9d9d6',
  grey400: '#bcbbb9',
  grey500: '#8f918f',
  grey700: '#5f625f',
  charcoal900: '#262523',
  charcoal600: '#53504c',
  charcoal500: '#5a5751',
  // Friendly warm neutrals (design rework); mirror the --warm-* values in index.css.
  warm50: '#fbf9f5',
  warm100: '#f5f1ea',
  warm200: '#efeae1',
  warm300: '#e6e0d4',
  warm400: '#d6cebf',
  warm700: '#6b665d',
  amberText: '#9a5800',
  // Comments: a friendly chat-app blue for open threads, a soft mint for resolved ones.
  // Mirror --chat-blue / --chat-green in index.css.
  chatBlue: '#4f86e8',
  chatBlueDark: '#2f62c0',
  chatGreen: '#43a979',
  // Not part of Saab's web palette; needed for feedback and utility types.
  green: '#2f9e57', // valid placement, exits
  cyan: '#1a9fd9', // water
  violet: '#7b5cd6', // sprinklers
} as const

// Semantic roles used by the floorplan canvas.
/** Mixes two #rrggbb colours: t = 0 gives `a`, t = 1 gives `b`. */
export function mixColours(a: string, b: string, t: number): string {
  const parse = (hex: string) => [1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16))
  const ca = parse(a)
  const cb = parse(b)
  return `#${ca.map((v, i) => Math.round(v + (cb[i] - v) * t).toString(16).padStart(2, '0')).join('')}`
}

/** Font for canvas text; Konva cannot read CSS, so this mirrors --font-sans. */
export const CANVAS_FONT = "'Nunito', Arial, Helvetica, sans-serif"

export const CANVAS = {
  background: COLORS.warm200, // calm sand backdrop around the floor
  floor: '#fffdf8', // warm white floor
  floorShadow: COLORS.charcoal,
  floorStroke: '#7a7368', // thick, soft building outline
  grid: '#f0ebe1', // minor lines (grid size)
  gridMajor: '#e2dacb', // every metre
  machineFill: COLORS.blue,
  machineStroke: COLORS.blueDark,
  machineLabel: COLORS.white,
  selected: COLORS.yellow,
  frontMarker: COLORS.white,
  warning: COLORS.yellowDark,
  error: COLORS.red,
  valid: COLORS.green,
  pillarFill: COLORS.charcoal500,
  pillarHatch: COLORS.charcoal900,
  pillarStroke: COLORS.charcoal900,
  // Inside walls: a warm grey a shade lighter than the building outline, edged in its colour.
  wallFill: '#a39d92',
  wallStroke: '#7a7368',
  invalid: COLORS.red,
} as const
