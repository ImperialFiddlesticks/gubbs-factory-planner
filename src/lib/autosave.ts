import { z } from 'zod'
import type { PersistOptions } from 'zustand/middleware'
import { getMachineType } from '@/data/catalog'
import { DEFAULT_LAYERS } from '@/data/layers'
import type { PlannerState } from '@/store'
import {
  FloorplanSchema,
  MachineInstanceSchema,
  PillarSchema,
  UtilitySchema,
  WallSchema,
} from '@/types'

/**
 * Autosave: the current layout is kept in the browser (localStorage) and restored after a
 * refresh or a closed tab. Saved on every change. Only the layout, the wizard answers and a
 * few preferences are kept; selection, placing and screen are not.
 */

/** localStorage key. Bump `version` below if the saved shape changes incompatibly. */
const SAVE_KEY = 'gubbs-factory-planner'

type Saved = Pick<
  PlannerState,
  'floorplan' | 'machines' | 'utilities' | 'pillars' | 'walls' | 'setup' | 'layers' | 'conveyorLength'
>

/**
 * What is checked when loading. Layout data must match the backend contract; anything that
 * doesn't is ignored and the planner starts empty, rather than crashing on old or broken data.
 */
const SavedSchema = z.object({
  floorplan: FloorplanSchema.nullable(),
  machines: z.array(MachineInstanceSchema),
  utilities: z.array(UtilitySchema),
  pillars: z.array(PillarSchema),
  walls: z.array(WallSchema),
  // Wizard answers and preferences are merged over the defaults, so a missing field is fine.
  setup: z.record(z.string(), z.unknown()).optional(),
  layers: z.record(z.string(), z.boolean()).optional(),
  conveyorLength: z.number().positive().optional(),
})

export const autosave: PersistOptions<PlannerState, Saved> = {
  name: SAVE_KEY,
  version: 1,
  partialize: (s) => ({
    floorplan: s.floorplan,
    machines: s.machines,
    utilities: s.utilities,
    pillars: s.pillars,
    walls: s.walls,
    setup: s.setup,
    layers: s.layers,
    conveyorLength: s.conveyorLength,
  }),
  merge: (persisted, current) => {
    const parsed = SavedSchema.safeParse(persisted)
    if (!parsed.success) return current
    const saved = parsed.data
    return {
      ...current,
      floorplan: saved.floorplan,
      // Machines whose type has left the catalog are dropped.
      machines: saved.machines.filter((m) => getMachineType(m.typeId)),
      utilities: saved.utilities,
      pillars: saved.pillars,
      walls: saved.walls,
      setup: { ...current.setup, ...saved.setup },
      layers: { ...DEFAULT_LAYERS, ...saved.layers },
      conveyorLength: saved.conveyorLength ?? current.conveyorLength,
      // A saved floor reopens straight in the planner.
      screen: saved.floorplan ? 'planner' : current.screen,
    }
  },
}
