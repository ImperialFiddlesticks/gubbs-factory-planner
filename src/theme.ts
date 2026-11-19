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
  // Not part of Saab's web palette; needed for feedback and utility types.
  green: '#2f9e57', // valid placement, exits
  cyan: '#1a9fd9', // water
  violet: '#7b5cd6', // sprinklers
} as const

// Semantic roles used by the floorplan canvas.
export const CANVAS = {
  background: COLORS.grey300,
  floor: COLORS.white,
  floorStroke: COLORS.charcoal,
  grid: COLORS.grey300,
  machineFill: COLORS.blue,
  machineStroke: COLORS.blueDark,
  machineLabel: COLORS.white,
  selected: COLORS.yellow,
  frontMarker: COLORS.white,
  warning: COLORS.yellowDark,
  error: COLORS.red,
  valid: COLORS.green,
  invalid: COLORS.red,
} as const
