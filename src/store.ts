import { create, type StateCreator } from 'zustand'
import { persist } from 'zustand/middleware'
import { getMachineType } from '@/data/catalog'
import type { EquipmentCategoryId } from '@/data/categories'
import { DEFAULT_CONVEYOR_LENGTH } from '@/data/conveyors'
import { DEFAULT_HEIGHT_LIMIT, ZONE_KINDS } from '@/data/zones'
import { exampleWorkshop } from '@/data/exampleWorkshop'
import { DEFAULT_LAYERS, UTILITY_LAYER, utilityVisible, type LayerId } from '@/data/layers'
import { DEFAULT_SHAPES, type FloorShape } from '@/lib/floorShapes'
import { DEFAULT_PILLAR_GRID, type PillarGrid } from '@/lib/pillarGrid'
import { DEFAULT_PILLAR_SIZE, DEFAULT_WALL_THICKNESS } from '@/data/structures'
import { UTILITY_KINDS } from '@/data/utilities'
import { autosave } from '@/lib/autosave'
import { resizedBeltCentre } from '@/lib/conveyors'
import { snapToWall, straightenWall } from '@/lib/geometry'
import type { Floorplan, LayoutComment, LoadingBay, LoadingDock, MachineInstance, Pillar, Point, Rotation, Utility, UtilityKind, Wall, Zone, ZoneKind } from '@/types'
import { DEFAULT_LOADING_DOCK_WIDTH_MM, loadingDockIssue, loadingDockPerimeter, loadingDockPointAt, nearestLoadingDockPosition } from '@/lib/loadingDocks'
import { loadingBayIssue } from '@/lib/loadingBays'

export type NewFloorplanInput = Omit<Floorplan, 'id'>

/** Something picked from the left panel that is following the cursor (the "ghost"). */
export type Placing =
  | { kind: 'machine'; typeId: string; rotation: Rotation; length?: number }
  | { kind: 'utility'; utilityKind: UtilityKind }
  | { kind: 'pillar' }
  /** Drawing a zone: `start` is set while the mouse is held down, dragging out the rectangle. */
  | { kind: 'zone'; zoneKind: ZoneKind; start: Point | null }
  /** Drawing a wall: `start` is null until the first click. */
  | { kind: 'wall'; start: Point | null }
  | { kind: 'loadingDock' }
  | { kind: 'loadingBay'; loadingDockId: string; outline: Point[] }

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
  /** Missing in projects saved before zones existed. */
  zones?: Zone[]
  /** Missing in projects saved before loading docks existed. */
  loadingDocks?: LoadingDock[]
  /** Missing in projects saved before loading bays existed. */
  loadingBays?: LoadingBay[]
  comments: LayoutComment[]
  setup: SetupAnswers
}

interface CommentDraft {
  message: string
  author: string
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
  comments: LayoutComment[]
  /** Current discussion item and a pending floor-pin comment; UI-only. */
  selectedCommentId: string | null
  commentDraft: CommentDraft | null

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
  zones: Zone[]
  loadingDocks: LoadingDock[]
  loadingBays: LoadingBay[]
  /** The selected item (machine, utility, pillar, wall, zone, loading dock or bay) when exactly one is selected, else null. */
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
  /** Pillars, walls, and loading docks can't be selected or dragged; UI-only, not saved. */
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
  updateMachineDimensions: (id: string, patch: Partial<Pick<MachineInstance, 'width' | 'depth' | 'height'>>) => void
  updateMachineClearance: (id: string, patch: Partial<NonNullable<MachineInstance['clearance']>>) => void
  /** Set a station's own name, work description, people or colour; an empty or undefined value clears it. */
  updateMachineDetails: (id: string, patch: Partial<Pick<MachineInstance, 'name' | 'work' | 'people' | 'colour'>>) => void
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

  addLoadingDock: (boundaryOffsetMm: number) => boolean
  startPlacingLoadingDock: () => void
  moveLoadingDock: (id: string, x: number, y: number) => void
  updateLoadingDock: (id: string, patch: Partial<Pick<LoadingDock, 'name' | 'widthMm' | 'boundaryOffsetMm' | 'flowDirection'>>) => void
  removeLoadingDock: (id: string) => void
  addLoadingBay: (loadingDockId: string, outline: Point[]) => boolean
  startPlacingLoadingBay: (loadingDockId: string) => void
  setLoadingBayPoints: (outline: Point[]) => void
  updateLoadingBay: (id: string, patch: Partial<Pick<LoadingBay, 'name' | 'loadingDockId' | 'outline'>>) => void

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
  /** Open a fresh copy of the example workshop as a new project. */
  openExample: () => void
  /** Show the compare page / go back to the planner. */
  openCompare: () => void
  closeCompare: () => void

  /** Add a zone from a rectangle (two opposite corners, mm) and select it. */
  addZone: (kind: ZoneKind, a: Point, b: Point) => void
  /** Rename, recolour, retype, move or resize a zone (sizes rounded to whole mm). */
  updateZone: (id: string, patch: Partial<Omit<Zone, 'id'>>) => void
  removeZone: (id: string) => void

  select: (id: string | null) => void
  /** Select several items (box select); with `add`, they're added to the current selection. */
  selectMany: (ids: string[], add?: boolean) => void
  /** Shift-click: add the item to the selection, or take it out. */
  toggleSelected: (id: string) => void
  /** Move a machine and turn it in one step (e.g. dropped onto a conveyor end). */
  moveMachineTo: (id: string, x: number, y: number, rotation: Rotation) => void
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
  addComment: (comment: Omit<LayoutComment, 'id' | 'createdAt' | 'status'>) => void
  startCommentPlacement: (draft: CommentDraft) => void
  addLocationComment: (x: number, y: number) => void
  cancelCommentPlacement: () => void
  selectComment: (id: string | null) => void
  setCommentStatus: (id: string, status: LayoutComment['status']) => void
  deleteComment: (id: string) => void

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
  /** Pick up a zone type to draw; picking the same one again puts it back. */
  startPlacingZone: (kind: ZoneKind) => void
  /** Mouse down (a point) or a drag too small to make a zone (null) while drawing a zone. */
  setZoneStart: (start: Point | null) => void
  rotatePlacing: () => void
  cancelPlacing: () => void
}

function rotateBy(current: Rotation, degrees: number): Rotation {
    return (current + degrees + 360) % 360
}

const roundPoint = (p: Point): Point => ({ x: Math.round(p.x), y: Math.round(p.y) })

/** Whole millimetres; exits are kept on the wall. */
function placeUtility(kind: UtilityKind, x: number, y: number, floorplan: Floorplan) {
  const p = kind === 'exit' ? snapToWall(x, y, floorplan) : { x, y }
  return { x: Math.round(p.x), y: Math.round(p.y) }
}

/** The open project as a saved project (null when no floor is open). */
export function currentProject(s: PlannerState): Project | null {
  if (!s.floorplan) return null
  return {
    floorplan: s.floorplan,
    machines: s.machines,
    utilities: s.utilities,
    pillars: s.pillars,
    walls: s.walls,
    zones: s.zones,
    loadingDocks: s.loadingDocks,
    loadingBays: s.loadingBays,
    comments: s.comments,
    setup: s.setup,
  }
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
    zones: p.zones ?? [],
    loadingDocks: p.loadingDocks ?? [],
    loadingBays: p.loadingBays ?? [],
    comments: p.comments ?? [],
    selectedCommentId: null,
    commentDraft: null,
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
  zones: [],
  loadingDocks: [],
  loadingBays: [],
  comments: [],
  selectedCommentId: null,
  commentDraft: null,
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
      zones: [],
      loadingDocks: [],
      loadingBays: [],
      comments: [],
      selectedCommentId: null,
      commentDraft: null,
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

  openExample: () => {
    const s = get()
    const names = [...(s.floorplan ? [s.floorplan.name] : []), ...s.projects.map((p) => p.floorplan.name)]
    s.importProject(exampleWorkshop(names))
  },

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
        zones: [],
        loadingDocks: [],
        loadingBays: [],
        comments: [],
        selectedCommentId: null,
        commentDraft: null,
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
      const loadingBays = s.loadingBays.map((bay) => ({
        ...bay,
        outline: bay.outline.map((point) => ({
          x: Math.round((point.x * width) / oldW),
          y: Math.round((point.y * depth) / oldD),
        })),
      }))
      const oldPerimeter = loadingDockPerimeter(s.floorplan)
      const newPerimeter = loadingDockPerimeter(floorplan)
      return {
        floorplan,
        loadingDocks: oldPerimeter > 0
          ? s.loadingDocks.map((dock) => ({ ...dock, boundaryOffsetMm: dock.boundaryOffsetMm * newPerimeter / oldPerimeter }))
          : s.loadingDocks,
        loadingBays,
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
        m.id === id ? { ...m, rotation: rotateBy(m.rotation, 15) } : m,
      ),
    })),

  updateMachineDimensions: (id, patch) =>
    set((s) => ({
      machines: s.machines.map((m) => (m.id === id ? { ...m, ...patch } : m)),
    })),

  updateMachineDetails: (id, patch) =>
    set((s) => ({
      machines: s.machines.map((m) => {
        if (m.id !== id) return m
        const next = { ...m, ...patch }
        // Blank text clears the field, so the automatic name or no description shows again.
        for (const key of ['name', 'work', 'colour'] as const) {
          const value = next[key]
          if (value === undefined || value.trim() === '') delete next[key]
          else next[key] = value.trim()
        }
        if (next.people === undefined) delete next.people
        return next
      }),
    })),

  updateMachineClearance: (id, patch) =>
    set((s) => ({
      machines: s.machines.map((m) => {
        if (m.id !== id) return m
        const type = getMachineType(m.typeId)
        if (!type) return m
        return { ...m, clearance: { ...type.clearance, ...m.clearance, ...patch } }
      }),
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

  addLoadingDock: (boundaryOffsetMm) => {
    const s = get()
    if (!s.floorplan) return false
    const dock: LoadingDock = {
      id: crypto.randomUUID(),
      name: `Loading dock ${s.loadingDocks.length + 1}`,
      widthMm: DEFAULT_LOADING_DOCK_WIDTH_MM,
      boundaryOffsetMm,
      flowDirection: 'two-way',
    }
    if (loadingDockIssue(dock, s.floorplan, s.loadingDocks)) return false
    set({ loadingDocks: [...s.loadingDocks, dock], ...selection([dock.id]) })
    return true
  },

  moveLoadingDock: (id, x, y) =>
    set((s) => {
      if (!s.floorplan) return s
      const dock = s.loadingDocks.find((item) => item.id === id)
      const position = nearestLoadingDockPosition(x, y, s.floorplan)
      if (!dock || !position) return s
      const moved = { ...dock, boundaryOffsetMm: position.offsetMm }
      if (loadingDockIssue(moved, s.floorplan, s.loadingDocks)) return s
      return { loadingDocks: s.loadingDocks.map((item) => item.id === id ? moved : item) }
    }),

  updateLoadingDock: (id, patch) =>
    set((s) => {
      if (!s.floorplan) return s
      const dock = s.loadingDocks.find((item) => item.id === id)
      if (!dock) return s
      const updated = { ...dock, ...patch, name: patch.name?.trim() ?? dock.name }
      if (loadingDockIssue(updated, s.floorplan, s.loadingDocks)) return s
      return { loadingDocks: s.loadingDocks.map((item) => item.id === id ? updated : item) }
    }),

  removeLoadingDock: (id) =>
    set((s) => {
      const removedBays = new Set(s.loadingBays.filter((bay) => bay.loadingDockId === id).map((bay) => bay.id))
      return {
        loadingDocks: s.loadingDocks.filter((dock) => dock.id !== id),
        loadingBays: s.loadingBays.filter((bay) => bay.loadingDockId !== id),
        ...selection(s.selectedIds.filter((selected) => selected !== id && !removedBays.has(selected))),
      }
    }),

  addLoadingBay: (loadingDockId, outline) => {
    const s = get()
    if (!s.floorplan) return false
    const bay: LoadingBay = {
      id: crypto.randomUUID(),
      name: `Loading bay ${s.loadingBays.length + 1}`,
      loadingDockId,
      outline: outline.map(roundPoint),
    }
    if (loadingBayIssue(bay, s.floorplan, s.loadingDocks, s.loadingBays)) return false
    set((state) => ({ loadingBays: [...state.loadingBays, bay], ...selection([bay.id]) }))
    return true
  },

  updateLoadingBay: (id, patch) =>
    set((s) => {
      if (!s.floorplan) return s
      const bay = s.loadingBays.find((item) => item.id === id)
      if (!bay) return s
      const updated = {
        ...bay,
        ...patch,
        ...(patch.name !== undefined && { name: patch.name.trim() }),
        ...(patch.outline && { outline: patch.outline.map(roundPoint) }),
      }
      if (loadingBayIssue(updated, s.floorplan, s.loadingDocks, s.loadingBays)) return s
      return { loadingBays: s.loadingBays.map((item) => item.id === id ? updated : item) }
    }),

  addZone: (kind, a, b) =>
    set((s) => {
      const info = ZONE_KINDS[kind]
      const zone: Zone = {
        id: crypto.randomUUID(),
        // Numbered per kind: "Area 1", "Aisle 2", …
        name: `${info.name} ${s.zones.filter((z) => z.kind === kind).length + 1}`,
        kind,
        x: Math.round((a.x + b.x) / 2),
        y: Math.round((a.y + b.y) / 2),
        width: Math.round(Math.abs(b.x - a.x)),
        depth: Math.round(Math.abs(b.y - a.y)),
        colour: info.colour,
        ...(kind === 'height' && { maxHeight: DEFAULT_HEIGHT_LIMIT }),
      }
      return { zones: [...s.zones, zone], ...selection([zone.id]) }
    }),

  updateZone: (id, patch) =>
    set((s) => ({
      zones: s.zones.map((z) => {
        if (z.id !== id) return z
        const next = { ...z, ...patch }
        for (const key of ['x', 'y', 'width', 'depth'] as const) next[key] = Math.round(next[key])
        if (next.kind !== 'height') delete next.maxHeight
        else next.maxHeight ??= DEFAULT_HEIGHT_LIMIT
        return next
      }),
    })),

  removeZone: (id) =>
    set((s) => ({
      zones: s.zones.filter((z) => z.id !== id),
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

  moveMachineTo: (id, x, y, rotation) =>
    set((s) => ({
      machines: s.machines.map((m) => (m.id === id ? { ...m, x: Math.round(x), y: Math.round(y), rotation } : m)),
    })),

  moveItems: (ids, dx, dy) =>
    set((s) => {
      const moving = new Set(ids)
      const by = <T extends { id: string; x: number; y: number }>(item: T) =>
        moving.has(item.id) ? { ...item, x: Math.round(item.x + dx), y: Math.round(item.y + dy) } : item
      const shift = (p: Point) => ({ x: Math.round(p.x + dx), y: Math.round(p.y + dy) })
      const floorplan = s.floorplan
      const loadingDocks = floorplan
        ? s.loadingDocks.map((dock) => {
            if (!moving.has(dock.id)) return dock
            const point = loadingDockPointAt(floorplan, dock.boundaryOffsetMm)
            const next = point && nearestLoadingDockPosition(point.x + dx, point.y + dy, floorplan)
            return next ? { ...dock, boundaryOffsetMm: next.offsetMm } : dock
          })
        : s.loadingDocks
      const loadingBays = s.loadingBays.map((bay) => moving.has(bay.id)
        ? { ...bay, outline: bay.outline.map(shift) }
        : bay)
      if (floorplan && loadingDocks.some((dock) => moving.has(dock.id) && loadingDockIssue(dock, floorplan, loadingDocks))) return s
      if (floorplan && loadingBays.some((bay) => moving.has(bay.id) && loadingBayIssue(bay, floorplan, loadingDocks, loadingBays))) return s
      return {
        machines: s.machines.map(by),
        pillars: s.pillars.map(by),
        utilities: s.utilities.map((u) =>
          moving.has(u.id) && s.floorplan ? { ...u, ...placeUtility(u.kind, u.x + dx, u.y + dy, s.floorplan) } : u,
        ),
        loadingDocks,
        loadingBays,
        walls: s.walls.map((w) => (moving.has(w.id) ? { ...w, start: shift(w.start), end: shift(w.end) } : w)),
        zones: s.zones.map(by),
      }
    }),

  removeItems: (ids) =>
    set((s) => {
      const gone = new Set(ids)
      const removedBays = new Set(s.loadingBays.filter((bay) => gone.has(bay.id) || gone.has(bay.loadingDockId)).map((bay) => bay.id))
      return {
        machines: s.machines.filter((m) => !gone.has(m.id)),
        utilities: s.utilities.filter((u) => !gone.has(u.id)),
        pillars: s.pillars.filter((p) => !gone.has(p.id)),
        walls: s.walls.filter((w) => !gone.has(w.id)),
        zones: s.zones.filter((z) => !gone.has(z.id)),
        loadingDocks: s.loadingDocks.filter((dock) => !gone.has(dock.id)),
        loadingBays: s.loadingBays.filter((bay) => !removedBays.has(bay.id)),
        ...selection(s.selectedIds.filter((x) => !gone.has(x) && !removedBays.has(x))),
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
      const structures = new Set([...s.pillars, ...s.walls, ...s.loadingDocks, ...s.loadingBays].map((x) => x.id))
      return { lockStructures: lock, ...(lock && selection(s.selectedIds.filter((x) => !structures.has(x)))) }
    }),

  addComment: (comment) =>
    set((s) => {
      if (!s.floorplan || !comment.message.trim()) return s
      const created: LayoutComment = {
        ...comment,
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
        status: 'open',
      }
      return { comments: [...s.comments, created], selectedCommentId: created.id }
    }),

  startCommentPlacement: (draft) =>
    set({ commentDraft: { message: draft.message.trim(), author: draft.author.trim() || 'You' } }),

  addLocationComment: (x, y) =>
    set((s) => {
      if (!s.floorplan || !s.commentDraft?.message) return s
      const created: LayoutComment = {
        id: crypto.randomUUID(),
        x: Math.round(x),
        y: Math.round(y),
        author: s.commentDraft.author,
        createdAt: new Date().toISOString(),
        message: s.commentDraft.message,
        status: 'open',
      }
      return {
        comments: [...s.comments, created],
        selectedCommentId: created.id,
        commentDraft: null,
      }
    }),

  cancelCommentPlacement: () => set({ commentDraft: null }),
  selectComment: (id) => set({ selectedCommentId: id }),
  setCommentStatus: (id, status) =>
    set((s) => ({
      comments: s.comments.map((comment) => (comment.id === id ? { ...comment, status } : comment)),
    })),
  deleteComment: (id) =>
    set((s) => ({
      comments: s.comments.filter((comment) => comment.id !== id),
      ...(s.selectedCommentId === id && { selectedCommentId: null }),
    })),

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

  startPlacingLoadingDock: () =>
    set((s) =>
      s.placing?.kind === 'loadingDock'
        ? { placing: null }
        : { placing: { kind: 'loadingDock' }, ...selection([]) },
    ),

  startPlacingLoadingBay: (loadingDockId) =>
    set((s) =>
      s.placing?.kind === 'loadingBay' && s.placing.loadingDockId === loadingDockId
        ? { placing: null }
        : { placing: { kind: 'loadingBay', loadingDockId, outline: [] }, ...selection([]) },
    ),

  setLoadingBayPoints: (outline) =>
    set((s) => s.placing?.kind === 'loadingBay' ? { placing: { ...s.placing, outline: outline.map(roundPoint) } } : s),

  startPlacingZone: (zoneKind) =>
    set((s) =>
      s.placing?.kind === 'zone' && s.placing.zoneKind === zoneKind
        ? { placing: null }
        : {
            placing: { kind: 'zone', zoneKind, start: null },
            ...selection([]),
            // Drawing something the Zones layer hides turns the layer on, so it doesn't vanish.
            layers: { ...s.layers, zones: true },
          },
    ),

  setZoneStart: (start) =>
    set((s) =>
      s.placing?.kind === 'zone' ? { placing: { ...s.placing, start: start && roundPoint(start) } } : s,
    ),

  setWallStart: (start) =>
    set((s) => (s.placing?.kind === 'wall' ? { placing: { kind: 'wall', start: roundPoint(start) } } : s)),

  rotatePlacing: () =>
    set((s) =>
      s.placing?.kind === 'machine'
        ? { placing: { ...s.placing, rotation: rotateBy(s.placing.rotation, 15) } }
        : s,
    ),

  cancelPlacing: () => set({ placing: null }),
})

/** The planner store, autosaved to the browser (see lib/autosave). */
export const usePlanner = create<PlannerState>()(persist(plannerState, autosave))
