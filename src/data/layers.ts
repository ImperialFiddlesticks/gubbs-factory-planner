import { COLORS } from '@/theme'
import type { UtilityKind } from '@/types'

/** Toggleable overlays on the floor canvas. Utility icons always stay visible. */
export type LayerId = 'water' | 'electrical' | 'fire' | 'exits'

export interface LayerInfo {
  id: LayerId
  name: string
  /** What switching it on shows, for the layers menu. */
  description: string
  colour: string
}

export const LAYERS: LayerInfo[] = [
  { id: 'water', name: 'Water', description: 'Reach and pipes to machines', colour: COLORS.cyan },
  { id: 'electrical', name: 'Electrical', description: 'Reach, wires and load per power point', colour: COLORS.yellowDark },
  { id: 'fire', name: 'Fire safety', description: 'Sprinklers (hidden when off), coverage and routes to extinguishers', colour: COLORS.violet },
  { id: 'exits', name: 'Exit routes', description: 'Walking route to the nearest exit', colour: COLORS.green },
]

export const DEFAULT_LAYERS: Record<LayerId, boolean> = {
  water: true,
  electrical: true,
  fire: true,
  exits: false,
}

/**
 * Utilities whose icons are hidden with their layer (ceiling-mounted, so they only get in the
 * way on the floor plan). Every other utility icon is always shown.
 */
export const HIDDEN_WITH_LAYER: ReadonlySet<UtilityKind> = new Set(['sprinkler'])

/** True if a utility's icon is drawn with the current layer settings. */
export const utilityVisible = (kind: UtilityKind, layers: Record<LayerId, boolean>) =>
  !HIDDEN_WITH_LAYER.has(kind) || layers[UTILITY_LAYER[kind]]

/** The layer a utility's coverage belongs to. */
export const UTILITY_LAYER: Record<UtilityKind, LayerId> = {
  water: 'water',
  power: 'electrical',
  sprinkler: 'fire',
  extinguisher: 'fire',
  exit: 'exits',
}
