import { create, type StateCreator } from 'zustand'
import { persist } from 'zustand/middleware'
import { getMachineType } from '@/data/catalog'
import type { EquipmentCategoryId } from '@/data/categories'
import { DEFAULT_CONVEYOR_LENGTH } from '@/data/conveyors'
import { DEFAULT_LAYERS, UTILITY_LAYER, utilityVisible, type LayerId } from '@/data/layers'
import { DEFAULT_SHAPES, type FloorShape } from '@/lib/floorShapes'
import { DEFAULT_PILLAR_GRID, type PillarGrid } from '@/lib/pillarGrid'
import { DEFAULT_PILLAR_SIZE, DEFAULT_WALL_THICKNESS } from '@/data/structures'
import { UTILITY_KINDS } from '@/data/utilities'
import { autosave } from '@/lib/autosave'
import { resizedBeltCentre } from '@/lib/conveyors'
import { snapToWall, straightenWall } from '@/lib/geometry'
import type { Floorplan, MachineInstance, Pillar, Point, Rotation, Utility, UtilityKind, Wall } from '@/types'

export type NewFloorplanInput = Omit<Floorplan, 'id'>

/** Something picked from the left panel that is following the cursor (the "ghost"). */
export type Placing =
  | { kind: 'machine'; typeId: string; rotation: Rotation; length?: number }
  | { kind: 'utility'; utilityKind: UtilityKind }
  | { kind: 'pillar' }
  /** Drawing a wall: `start` is null until the first click. */
  | { kind: 'wall'; start: Point | null }

/** Which full-page screen is showing. */
export type Screen = 'welcome' | 'wizard' | 'planner' | 'compare'

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

/**
 * A saved project that isn't open. The open project lives in the top-level fields (floorplan,
 * machines, …, setup). A project's id is its floorplan's id, and its name the floor's name.
 */
export interface Project {
  floorplan: Floorplan
  machines: MachineInstance[]
  utilities: Utility[]
  pillars: Pillar[]
  walls: Wall[]
  setup: SetupAnswers
}

export interface PlannerState {
  /** UI-only, not saved (a saved floor reopens in the planner). */
  screen: Screen
  /** The open project's wizard answers (station goal, equipment categories). */
  setup: SetupAnswers
  /** Answers being filled in in the wizard; become the new project's `setup` when it finishes. */
  wizard: SetupAnswers
  /** Saved projects other than the open one. */
  projects: Project[]

  /** Open the wizard with fresh answers. The current project stays open until the wizard finishes. */
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
  /** The selected item (machine, utility, pillar or wall) when exactly one is selected, else null. */
  selectedId: string | null
  /** Everything selected (one item, or several from box select / Shift-click). */
  selectedIds: string[]
  /**
   * A conveyor piece double-clicked to move on its own; otherwise dragging a piece moves its
   * whole run. Cleared when something else is selected. UI-only, not saved.
   */
  singlePieceId: string | null
  /** Set while placing from the left panel; UI-only, not saved. */
  placing: Placing | null
  /** Length the next straight conveyor belt is placed with, mm; UI-only, autosaved as a preference. */
  conveyorLength: number
  /** Which canvas overlays are switched on; UI-only, autosaved as a preference. */
  layers: Record<LayerId, boolean>
  /** Pillars and walls can't be selected or dragged; UI-only, not saved. */
  lockStructures: boolean

  /**
   * Start a new project from the wizard's answers and open it in the planner. The project that
   * was open is kept in `projects`. `pillars` are the wizard's pillar grid, if any.
   */
  newFloorplan: (input: NewFloorplanInput, pillars?: Omit<Pillar, 'id'>[]) => void
  /**
   * Resize the current floor (mm). A shaped floor's outline is scaled to match.
   * Machines are left where they are; exits are moved onto the new walls.
   */
  setFloorplan: (width: number, depth: number) => void

  /** Add a machine; without `at` it goes to the centre of the floor. */
  addMachine: (typeId: string, at?: { x: number; y: number; rotation?: Rotation; length?: number }) => void
  moveMachine: (id: string, x: number, y: number) => void
  /** Move several machines at once (a conveyor run). */
  moveMachines: (moves: { id: string; x: number; y: number }[]) => void
  rotateMachine: (id: string) => void
  /** Change a straight belt's length, keeping its input end in place. */
  setBeltLength: (id: string, length: number) => void
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

  /** Open a saved project; the one that was open is kept in `projects`. */
  openProject: (id: string) => void
  /** Copy the open project as "<name> (copy)" and open the copy. */
  duplicateProject: () => void
  /** Rename a project (its floor). */
  renameProject: (id: string, name: string) => void
  /** Delete a project. Deleting the open one opens another, or the welcome page if none is left. */
  deleteProject: (id: string) => void
  /**
   * Add a project read from a file and open it. It gets a new id (so importing twice gives two
   * projects), and "(imported)" is added to its name if a project already has that name.
   */
  importProject: (project: Project) => void
  /** Show the compare page / go back to the planner. */
  openCompare: () => void
  closeCompare: () => void

  select: (id: string | null) => void
  /** Select several items (box select); with `add`, they're added to the current selection. */
  selectMany: (ids: string[], add?: boolean) => void
  /** Shift-click: add the item to the selection, or take it out. */
  toggleSelected: (id: string) => void
  /** Move items of any kind by (dx, dy) mm in one step; exits stay on the wall. */
  moveItems: (ids: string[], dx: number, dy: number) => void
  /** Delete items of any kind in one step. */
  removeItems: (ids: string[]) => void
  /** Select a conveyor piece and let it be dragged on its own, out of its run. */
  selectSinglePiece: (id: string) => void
  toggleLayer: (id: LayerId) => void
  /** Also applies to the belt being placed, if any. */
  setConveyorLength: (length: number) => void
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

/** The open project as a saved project (null when no floor is open). */
export function currentProject(s: PlannerState): Project | null {
  if (!s.floorplan) return null
  return { floorplan: s.floorplan, machines: s.machines, utilities: s.utilities, pillars: s.pillars, walls: s.walls, setup: s.setup }
}

/** The project list with the open project added, before something else is opened. */
function keepOpenProject(s: PlannerState): Project[] {
  const current = currentProject(s)
  return current ? [current, ...s.projects] : s.projects
}

/** State fields for opening a project in the planner, with a clean selection. */
function opened(p: Project): Partial<PlannerState> {
  return {
    floorplan: p.floorplan,
    machines: p.machines,
    utilities: p.utilities,
    pillars: p.pillars,
    walls: p.walls,
    setup: p.setup,
    ...selection([]),
    singlePieceId: null,
    placing: null,
    screen: 'planner',
  }
}

/** Selection fields for a list of selected ids: selectedId is set only for a single item. */
export function selection(ids: string[]): Pick<PlannerState, 'selectedId' | 'selectedIds'> {
  return { selectedIds: ids, selectedId: ids.length === 1 ? ids[0] : null }
}

/** The whole planner state and its actions. */
const plannerState: StateCreator<PlannerState> = (set, get) => ({
  screen: 'welcome',
  setup: DEFAULT_SETUP,
  wizard: DEFAULT_SETUP,
  projects: [],

  startSetup: () => set({ screen: 'wizard', wizard: DEFAULT_SETUP, placing: null }),
  updateSetup: (patch) => set((s) => ({ wizard: { ...s.wizard, ...patch } })),
  cancelSetup: () => set((s) => (s.floorplan ? { screen: 'planner' } : s)),

  floorplan: null,
  machines: [],
  utilities: [],
  pillars: [],
  walls: [],
  selectedId: null,
  selectedIds: [],
  singlePieceId: null,
  placing: null,
  layers: DEFAULT_LAYERS,
  conveyorLength: DEFAULT_CONVEYOR_LENGTH,
  lockStructures: false,

  newFloorplan: (input, pillars = []) =>
    set((s) => ({
      projects: keepOpenProject(s),
      floorplan: { id: crypto.randomUUID(), ...input },
      machines: [],
      utilities: [],
      pillars: pillars.map((p) => ({ id: crypto.randomUUID(), ...p })),
      walls: [],
      setup: s.wizard,
      ...selection([]),
      singlePieceId: null,
      placing: null,
      screen: 'planner',
    })),

  importProject: (project) =>
    set((s) => {
      const names = new Set(keepOpenProject(s).map((p) => p.floorplan.name))
      const name = names.has(project.floorplan.name) ? `${project.floorplan.name} (imported)` : project.floorplan.name
      return {
        ...opened({ ...project, floorplan: { ...project.floorplan, id: crypto.randomUUID(), name } }),
        projects: keepOpenProject(s),
      }
    }),

  openCompare: () => set((s) => (s.floorplan ? { screen: 'compare', placing: null } : s)),
  closeCompare: () => set({ screen: 'planner' }),

  openProject: (id) =>
    set((s) => {
      const target = s.projects.find((p) => p.floorplan.id === id)
      if (!target) return s
      return { ...opened(target), projects: keepOpenProject(s).filter((p) => p !== target) }
    }),

  duplicateProject: () =>
    set((s) => {
      if (!s.floorplan) return s
      return {
        projects: keepOpenProject(s),
        floorplan: { ...s.floorplan, id: crypto.randomUUID(), name: `${s.floorplan.name} (copy)` },
        ...selection([]),
        singlePieceId: null,
        placing: null,
      }
    }),

  renameProject: (id, name) =>
    set((s) => {
      if (s.floorplan?.id === id) return { floorplan: { ...s.floorplan, name } }
      return {
        projects: s.projects.map((p) => (p.floorplan.id === id ? { ...p, floorplan: { ...p.floorplan, name } } : p)),
      }
    }),

  deleteProject: (id) =>
    set((s) => {
      if (s.floorplan?.id !== id) return { projects: s.projects.filter((p) => p.floorplan.id !== id) }
      // Deleting the open project: open the next one, or go back to the start.
      const [next, ...rest] = s.projects
      if (next) return { ...opened(next), projects: rest }
      return {
        floorplan: null,
        machines: [],
        utilities: [],
        pillars: [],
        walls: [],
        setup: DEFAULT_SETUP,
        ...selection([]),
        singlePieceId: null,
        placing: null,
        screen: 'welcome',
      }
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
      // Straight belts keep their own length (the catalog width is the default).
      ...(type.conveyor === 'straight' && { length: at?.length ?? type.width }),
    }
    set((s) => ({ machines: [...s.machines, machine], ...selection([machine.id]) }))
  },

  moveMachine: (id, x, y) =>
    set((s) => ({ machines: s.machines.map((m) => (m.id === id ? { ...m, x, y } : m)) })),

  moveMachines: (moves) =>
    set((s) => {
      const to = new Map(moves.map((m) => [m.id, m]))
      return {
        machines: s.machines.map((m) => {
          const p = to.get(m.id)
          return p ? { ...m, x: Math.round(p.x), y: Math.round(p.y) } : m
        }),
      }
    }),

  rotateMachine: (id) =>
    set((s) => ({
      machines: s.machines.map((m) =>
        m.id === id ? { ...m, rotation: nextRotation[m.rotation] } : m,
      ),
    })),

  setBeltLength: (id, length) =>
    set((s) => ({
      machines: s.machines.map((m) => {
        if (m.id !== id || m.length === undefined) return m
        return { ...m, ...resizedBeltCentre(m, m.rotation, m.length, length), length }
      }),
    })),

  removeMachine: (id) =>
    set((s) => ({
      machines: s.machines.filter((m) => m.id !== id),
      ...selection(s.selectedIds.filter((x) => x !== id)),
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
    set((s) => ({ utilities: [...s.utilities, utility], ...selection([utility.id]) }))
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
      ...selection(s.selectedIds.filter((x) => x !== id)),
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
    set((s) => ({ pillars: [...s.pillars, pillar], ...selection([pillar.id]) }))
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
      ...selection(s.selectedIds.filter((x) => x !== id)),
    })),

  addWall: (start, end) => {
    if (!get().floorplan) return
    const wall: Wall = {
      id: crypto.randomUUID(),
      start: roundPoint(start),
      end: roundPoint(straightenWall(start, end)),
      thickness: DEFAULT_WALL_THICKNESS,
    }
    set((s) => ({ walls: [...s.walls, wall], ...selection([wall.id]) }))
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
      ...selection(s.selectedIds.filter((x) => x !== id)),
    })),

  select: (id) =>
    set((s) => ({ ...selection(id ? [id] : []), ...(id !== s.singlePieceId && { singlePieceId: null }) })),

  selectMany: (ids, add = false) =>
    set((s) => ({ ...selection(add ? [...new Set([...s.selectedIds, ...ids])] : ids), singlePieceId: null })),

  toggleSelected: (id) =>
    set((s) => ({
      ...selection(s.selectedIds.includes(id) ? s.selectedIds.filter((x) => x !== id) : [...s.selectedIds, id]),
      singlePieceId: null,
    })),

  moveItems: (ids, dx, dy) =>
    set((s) => {
      const moving = new Set(ids)
      const by = <T extends { id: string; x: number; y: number }>(item: T) =>
        moving.has(item.id) ? { ...item, x: Math.round(item.x + dx), y: Math.round(item.y + dy) } : item
      const shift = (p: Point) => ({ x: Math.round(p.x + dx), y: Math.round(p.y + dy) })
      return {
        machines: s.machines.map(by),
        pillars: s.pillars.map(by),
        utilities: s.utilities.map((u) =>
          moving.has(u.id) && s.floorplan ? { ...u, ...placeUtility(u.kind, u.x + dx, u.y + dy, s.floorplan) } : u,
        ),
        walls: s.walls.map((w) => (moving.has(w.id) ? { ...w, start: shift(w.start), end: shift(w.end) } : w)),
      }
    }),

  removeItems: (ids) =>
    set((s) => {
      const gone = new Set(ids)
      return {
        machines: s.machines.filter((m) => !gone.has(m.id)),
        utilities: s.utilities.filter((u) => !gone.has(u.id)),
        pillars: s.pillars.filter((p) => !gone.has(p.id)),
        walls: s.walls.filter((w) => !gone.has(w.id)),
        ...selection(s.selectedIds.filter((x) => !gone.has(x))),
      }
    }),

  selectSinglePiece: (id) => set({ ...selection([id]), singlePieceId: id }),

  setConveyorLength: (length) =>
    set((s) => ({
      conveyorLength: length,
      ...(s.placing?.kind === 'machine' &&
        s.placing.length !== undefined && { placing: { ...s.placing, length } }),
    })),

  toggleLayer: (id) =>
    set((s) => {
      const layers = { ...s.layers, [id]: !s.layers[id] }
      // Utilities whose icons the layer hides can't stay selected.
      const hidden = new Set(s.utilities.filter((u) => !utilityVisible(u.kind, layers)).map((u) => u.id))
      return { layers, ...selection(s.selectedIds.filter((x) => !hidden.has(x))) }
    }),

  toggleLockStructures: () =>
    set((s) => {
      const lock = !s.lockStructures
      const structures = new Set([...s.pillars, ...s.walls].map((x) => x.id))
      return { lockStructures: lock, ...(lock && selection(s.selectedIds.filter((x) => !structures.has(x)))) }
    }),

  startPlacingMachine: (typeId) =>
    set((s) =>
      s.placing?.kind === 'machine' && s.placing.typeId === typeId
        ? { placing: null }
        : {
            placing: {
              kind: 'machine',
              typeId,
              rotation: 0,
              ...(getMachineType(typeId)?.conveyor === 'straight' && { length: s.conveyorLength }),
            },
            ...selection([]),
          },
    ),

  startPlacingUtility: (utilityKind) =>
    set((s) =>
      s.placing?.kind === 'utility' && s.placing.utilityKind === utilityKind
        ? { placing: null }
        : {
            placing: { kind: 'utility', utilityKind },
            ...selection([]),
            // Placing something its layer hides turns that layer on, so it doesn't vanish.
            ...(!utilityVisible(utilityKind, s.layers) && {
              layers: { ...s.layers, [UTILITY_LAYER[utilityKind]]: true },
            }),
          },
    ),

  startPlacingPillar: () =>
    set((s) =>
      s.placing?.kind === 'pillar' ? { placing: null } : { placing: { kind: 'pillar' }, ...selection([]) },
    ),

  startPlacingWall: () =>
    set((s) =>
      s.placing?.kind === 'wall'
        ? { placing: null }
        : { placing: { kind: 'wall', start: null }, ...selection([]) },
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
})

/** The planner store, autosaved to the browser (see lib/autosave). */
export const usePlanner = create<PlannerState>()(persist(plannerState, autosave))
