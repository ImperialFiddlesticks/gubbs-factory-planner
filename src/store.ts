import { create } from 'zustand'
import { getMachineType } from '@/data/catalog'
import type { EquipmentCategoryId } from '@/data/categories'
import { DEFAULT_SHAPES, type FloorShape } from '@/lib/floorShapes'
import { UTILITY_KINDS } from '@/data/utilities'
import { snapToWall } from '@/lib/geometry'
import type { Floorplan, MachineInstance, Rotation, Utility, UtilityKind } from '@/types'

export type NewFloorplanInput = Omit<Floorplan, 'id'>

/** Something picked from the left panel that is following the cursor (the "ghost"). */
export type Placing =
  | { kind: 'machine'; typeId: string; rotation: Rotation }
  | { kind: 'utility'; utilityKind: UtilityKind }

/** Which full-page screen is showing. */
export type Screen = 'welcome' | 'wizard' | 'planner'

/** Answers collected by the setup wizard. UI-side only, not part of the backend contract. */
export interface SetupAnswers {
  /** Plan a new floor, or edit an existing layout (not available yet). */
  mode: 'new' | 'existing'
  /** Equipment categories the person wants to plan with. */
  categories: EquipmentCategoryId[]
  /** How many stations need to fit. */
  stationTarget: number
  floorName: string
  /** Sizes may be NaN while a field is being typed; see shapeError. */
  floorShape: FloorShape
}

export const DEFAULT_SETUP: SetupAnswers = {
  mode: 'new',
  categories: [],
  stationTarget: 6,
  floorName: 'New factory',
  floorShape: DEFAULT_SHAPES.rectangle,
}

interface PlannerState {
  /** UI-only, not saved. */
  screen: Screen
  /** Wizard answers; kept after the wizard so the planner can use them. */
  setup: SetupAnswers

  /** Open the wizard with fresh answers. The current floor stays until the wizard finishes. */
  startSetup: () => void
  updateSetup: (patch: Partial<SetupAnswers>) => void
  /** Leave the wizard without changes; only possible when a floor already exists. */
  cancelSetup: () => void

  /** null until the person finishes the setup wizard. */
  floorplan: Floorplan | null
  machines: MachineInstance[]
  utilities: Utility[]
  /** A machine or utility id. */
  selectedId: string | null
  /** Set while placing from the left panel; UI-only, not saved. */
  placing: Placing | null
  /** Show every utility's reach circle; UI-only, not saved. */
  showCoverage: boolean

  /** Start a fresh floor and open the planner; clears all machines, utilities and selection. */
  newFloorplan: (input: NewFloorplanInput) => void
  /**
   * Resize the current floor (mm). A shaped floor's outline is scaled to match.
   * Machines are left where they are; exits are moved onto the new walls.
   */
  setFloorplan: (width: number, depth: number) => void

  /** Add a machine; without `at` it goes to the centre of the floor. */
  addMachine: (typeId: string, at?: { x: number; y: number; rotation?: Rotation }) => void
  moveMachine: (id: string, x: number, y: number) => void
  rotateMachine: (id: string) => void
  removeMachine: (id: string) => void

  /** Add a utility with its kind's default radius/capacity. Exits snap to the nearest wall. */
  addUtility: (kind: UtilityKind, x: number, y: number) => void
  moveUtility: (id: string, x: number, y: number) => void
  updateUtility: (id: string, patch: Partial<Pick<Utility, 'radius' | 'capacityKw'>>) => void
  removeUtility: (id: string) => void

  select: (id: string | null) => void
  toggleCoverage: () => void

  /** Pick up a machine type; picking the same one again puts it back. */
  startPlacingMachine: (typeId: string) => void
  /** Pick up a utility kind; picking the same one again puts it back. */
  startPlacingUtility: (kind: UtilityKind) => void
  rotatePlacing: () => void
  cancelPlacing: () => void
}

const nextRotation: Record<Rotation, Rotation> = { 0: 90, 90: 180, 180: 270, 270: 0 }

/** Whole millimetres; exits are kept on the wall. */
function placeUtility(kind: UtilityKind, x: number, y: number, floorplan: Floorplan) {
  const p = kind === 'exit' ? snapToWall(x, y, floorplan) : { x, y }
  return { x: Math.round(p.x), y: Math.round(p.y) }
}

export const usePlanner = create<PlannerState>()((set, get) => ({
  screen: 'welcome',
  setup: DEFAULT_SETUP,

  startSetup: () => set({ screen: 'wizard', setup: DEFAULT_SETUP, placing: null }),
  updateSetup: (patch) => set((s) => ({ setup: { ...s.setup, ...patch } })),
  cancelSetup: () => set((s) => (s.floorplan ? { screen: 'planner' } : s)),

  floorplan: null,
  machines: [],
  utilities: [],
  selectedId: null,
  placing: null,
  showCoverage: true,

  newFloorplan: (input) =>
    set({
      floorplan: { id: crypto.randomUUID(), ...input },
      machines: [],
      utilities: [],
      selectedId: null,
      placing: null,
      screen: 'planner',
    }),

  setFloorplan: (width, depth) =>
    set((s) => {
      if (!s.floorplan) return s
      const { outline, width: oldW, depth: oldD } = s.floorplan
      // A shaped floor is stretched to the new size: each corner keeps its relative position.
      const scaled = outline?.map((p) => ({
        x: Math.round((p.x * width) / oldW),
        y: Math.round((p.y * depth) / oldD),
      }))
      const floorplan = { ...s.floorplan, width, depth, ...(scaled && { outline: scaled }) }
      return {
        floorplan,
        // The walls moved, so keep exits on them.
        utilities: s.utilities.map((u) =>
          u.kind === 'exit' ? { ...u, ...placeUtility(u.kind, u.x, u.y, floorplan) } : u,
        ),
      }
    }),

  addMachine: (typeId, at) => {
    const { floorplan } = get()
    const type = getMachineType(typeId)
    if (!floorplan || !type) return
    // No grid snapping; positions are whole millimetres.
    const machine: MachineInstance = {
      id: crypto.randomUUID(),
      typeId,
      x: Math.round(at?.x ?? floorplan.width / 2),
      y: Math.round(at?.y ?? floorplan.depth / 2),
      rotation: at?.rotation ?? 0,
    }
    set((s) => ({ machines: [...s.machines, machine], selectedId: machine.id }))
  },

  moveMachine: (id, x, y) =>
    set((s) => ({ machines: s.machines.map((m) => (m.id === id ? { ...m, x, y } : m)) })),

  rotateMachine: (id) =>
    set((s) => ({
      machines: s.machines.map((m) =>
        m.id === id ? { ...m, rotation: nextRotation[m.rotation] } : m,
      ),
    })),

  removeMachine: (id) =>
    set((s) => ({
      machines: s.machines.filter((m) => m.id !== id),
      selectedId: s.selectedId === id ? null : s.selectedId,
    })),

  addUtility: (kind, x, y) => {
    const { floorplan } = get()
    if (!floorplan) return
    const info = UTILITY_KINDS[kind]
    const utility: Utility = {
      id: crypto.randomUUID(),
      kind,
      ...placeUtility(kind, x, y, floorplan),
      ...(info.defaultRadius !== undefined && { radius: info.defaultRadius }),
      ...(info.defaultCapacityKw !== undefined && { capacityKw: info.defaultCapacityKw }),
    }
    set((s) => ({ utilities: [...s.utilities, utility], selectedId: utility.id }))
  },

  moveUtility: (id, x, y) => {
    const { floorplan } = get()
    if (!floorplan) return
    set((s) => ({
      utilities: s.utilities.map((u) =>
        u.id === id ? { ...u, ...placeUtility(u.kind, x, y, floorplan) } : u,
      ),
    }))
  },

  updateUtility: (id, patch) =>
    set((s) => ({ utilities: s.utilities.map((u) => (u.id === id ? { ...u, ...patch } : u)) })),

  removeUtility: (id) =>
    set((s) => ({
      utilities: s.utilities.filter((u) => u.id !== id),
      selectedId: s.selectedId === id ? null : s.selectedId,
    })),

  select: (id) => set({ selectedId: id }),

  toggleCoverage: () => set((s) => ({ showCoverage: !s.showCoverage })),

  startPlacingMachine: (typeId) =>
    set((s) =>
      s.placing?.kind === 'machine' && s.placing.typeId === typeId
        ? { placing: null }
        : { placing: { kind: 'machine', typeId, rotation: 0 }, selectedId: null },
    ),

  startPlacingUtility: (utilityKind) =>
    set((s) =>
      s.placing?.kind === 'utility' && s.placing.utilityKind === utilityKind
        ? { placing: null }
        : { placing: { kind: 'utility', utilityKind }, selectedId: null },
    ),

  rotatePlacing: () =>
    set((s) =>
      s.placing?.kind === 'machine'
        ? { placing: { ...s.placing, rotation: nextRotation[s.placing.rotation] } }
        : s,
    ),

  cancelPlacing: () => set({ placing: null }),
}))
