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
  { id: 'fire', name: 'Fire safety', description: 'Sprinkler coverage and routes to extinguishers', colour: COLORS.violet },
  { id: 'exits', name: 'Exit routes', description: 'Walking route to the nearest exit', colour: COLORS.green },
]

export const DEFAULT_LAYERS: Record<LayerId, boolean> = {
  water: true,
  electrical: true,
  fire: true,
  exits: false,
}

/** The layer a utility's coverage belongs to. */
export const UTILITY_LAYER: Record<UtilityKind, LayerId> = {
  water: 'water',
  power: 'electrical',
  sprinkler: 'fire',
  extinguisher: 'fire',
  exit: 'exits',
}
