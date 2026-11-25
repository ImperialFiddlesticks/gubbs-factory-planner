import { create } from 'zustand'
import { getMachineType } from '@/data/catalog'
import type { EquipmentCategoryId } from '@/data/categories'
import { DEFAULT_SHAPES, type FloorShape } from '@/lib/floorShapes'
import { DEFAULT_PILLAR_GRID, type PillarGrid } from '@/lib/pillarGrid'
import { DEFAULT_PILLAR_SIZE, DEFAULT_WALL_THICKNESS } from '@/data/structures'
import { UTILITY_KINDS } from '@/data/utilities'
import { snapToWall, straightenWall } from '@/lib/geometry'
import type { Floorplan, MachineInstance, Pillar, Point, Rotation, Utility, UtilityKind, Wall } from '@/types'

export type NewFloorplanInput = Omit<Floorplan, 'id'>

/** Something picked from the left panel that is following the cursor (the "ghost"). */
export type Placing =
  | { kind: 'machine'; typeId: string; rotation: Rotation }
  | { kind: 'utility'; utilityKind: UtilityKind }
  | { kind: 'pillar' }
  /** Drawing a wall: `start` is null until the first click. */
  | { kind: 'wall'; start: Point | null }

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
  /** Optional regular grid of pillars created with the floor. */
  pillarGrid: PillarGrid
}

export const DEFAULT_SETUP: SetupAnswers = {
  mode: 'new',
  categories: [],
  stationTarget: 6,
  floorName: 'New factory',
  floorShape: DEFAULT_SHAPES.rectangle,
  pillarGrid: DEFAULT_PILLAR_GRID,
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
  pillars: Pillar[]
  walls: Wall[]
  /** A machine, utility or pillar id. */
  selectedId: string | null
  /** Set while placing from the left panel; UI-only, not saved. */
  placing: Placing | null
  /** Show every utility's reach circle; UI-only, not saved. */
  showCoverage: boolean
  /** Pillars and walls can't be selected or dragged; UI-only, not saved. */
  lockStructures: boolean

  /**
   * Start a fresh floor and open the planner; clears all machines, utilities and selection.
   * Pillars are replaced by `pillars` (e.g. the wizard's pillar grid), or cleared.
   */
  newFloorplan: (input: NewFloorplanInput, pillars?: Omit<Pillar, 'id'>[]) => void
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

  /** Add a pillar centred on (x, y); default size is DEFAULT_PILLAR_SIZE square. */
  addPillar: (x: number, y: number, size?: { width: number; depth: number }) => void
  movePillar: (id: string, x: number, y: number) => void
  resizePillar: (id: string, width: number, depth: number) => void
  removePillar: (id: string) => void

  /** Add a wall from start to end; the end is straightened to horizontal/vertical. */
  addWall: (start: Point, end: Point) => void
  /** Move or reshape a wall; the result is kept horizontal/vertical. */
  updateWall: (id: string, patch: Partial<Pick<Wall, 'start' | 'end' | 'thickness'>>) => void
  removeWall: (id: string) => void

  select: (id: string | null) => void
  toggleCoverage: () => void
  /** Locking also deselects a selected structure. */
  toggleLockStructures: () => void

  /** Pick up a machine type; picking the same one again puts it back. */
  startPlacingMachine: (typeId: string) => void
  /** Pick up a utility kind; picking the same one again puts it back. */
  startPlacingUtility: (kind: UtilityKind) => void
  /** Pick up a pillar (default size); picking it again puts it back. */
  startPlacingPillar: () => void
  /** Start drawing a wall; picking it again stops. */
  startPlacingWall: () => void
  /** First click of a wall: fix its start point. */
  setWallStart: (start: Point) => void
  rotatePlacing: () => void
  cancelPlacing: () => void
}

const nextRotation: Record<Rotation, Rotation> = { 0: 90, 90: 180, 180: 270, 270: 0 }

const roundPoint = (p: Point): Point => ({ x: Math.round(p.x), y: Math.round(p.y) })

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
  pillars: [],
  walls: [],
  selectedId: null,
  placing: null,
  showCoverage: true,
  lockStructures: false,

  newFloorplan: (input, pillars = []) =>
    set({
      floorplan: { id: crypto.randomUUID(), ...input },
      machines: [],
      utilities: [],
      pillars: pillars.map((p) => ({ id: crypto.randomUUID(), ...p })),
      walls: [],
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

  addPillar: (x, y, size) => {
    if (!get().floorplan) return
    const pillar: Pillar = {
      id: crypto.randomUUID(),
      x: Math.round(x),
      y: Math.round(y),
      width: size?.width ?? DEFAULT_PILLAR_SIZE,
      depth: size?.depth ?? DEFAULT_PILLAR_SIZE,
    }
    set((s) => ({ pillars: [...s.pillars, pillar], selectedId: pillar.id }))
  },

  movePillar: (id, x, y) =>
    set((s) => ({
      pillars: s.pillars.map((p) => (p.id === id ? { ...p, x: Math.round(x), y: Math.round(y) } : p)),
    })),

  resizePillar: (id, width, depth) =>
    set((s) => ({ pillars: s.pillars.map((p) => (p.id === id ? { ...p, width, depth } : p)) })),

  removePillar: (id) =>
    set((s) => ({
      pillars: s.pillars.filter((p) => p.id !== id),
      selectedId: s.selectedId === id ? null : s.selectedId,
    })),

  addWall: (start, end) => {
    if (!get().floorplan) return
    const wall: Wall = {
      id: crypto.randomUUID(),
      start: roundPoint(start),
      end: roundPoint(straightenWall(start, end)),
      thickness: DEFAULT_WALL_THICKNESS,
    }
    set((s) => ({ walls: [...s.walls, wall], selectedId: wall.id }))
  },

  updateWall: (id, patch) =>
    set((s) => ({
      walls: s.walls.map((w) => {
        if (w.id !== id) return w
        const start = roundPoint(patch.start ?? w.start)
        const end = roundPoint(straightenWall(start, patch.end ?? w.end))
        return { ...w, ...patch, start, end }
      }),
    })),

  removeWall: (id) =>
    set((s) => ({
      walls: s.walls.filter((w) => w.id !== id),
      selectedId: s.selectedId === id ? null : s.selectedId,
    })),

  select: (id) => set({ selectedId: id }),

  toggleCoverage: () => set((s) => ({ showCoverage: !s.showCoverage })),

  toggleLockStructures: () =>
    set((s) => {
      const lock = !s.lockStructures
      const structureSelected = [...s.pillars, ...s.walls].some((x) => x.id === s.selectedId)
      return { lockStructures: lock, ...(lock && structureSelected && { selectedId: null }) }
    }),

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

  startPlacingPillar: () =>
    set((s) =>
      s.placing?.kind === 'pillar' ? { placing: null } : { placing: { kind: 'pillar' }, selectedId: null },
    ),

  startPlacingWall: () =>
    set((s) =>
      s.placing?.kind === 'wall'
        ? { placing: null }
        : { placing: { kind: 'wall', start: null }, selectedId: null },
    ),

  setWallStart: (start) =>
    set((s) => (s.placing?.kind === 'wall' ? { placing: { kind: 'wall', start: roundPoint(start) } } : s)),

  rotatePlacing: () =>
    set((s) =>
      s.placing?.kind === 'machine'
        ? { placing: { ...s.placing, rotation: nextRotation[s.placing.rotation] } }
        : s,
    ),

  cancelPlacing: () => set({ placing: null }),
}))
