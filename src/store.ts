import { create } from 'zustand'
import { getMachineType } from '@/data/catalog'
import { UTILITY_KINDS } from '@/data/utilities'
import { snapToWall } from '@/lib/geometry'
import type { Floorplan, MachineInstance, Rotation, Utility, UtilityKind } from '@/types'

export type NewFloorplanInput = Omit<Floorplan, 'id'>

/** Something picked from the left panel that is following the cursor (the "ghost"). */
export type Placing =
  | { kind: 'machine'; typeId: string; rotation: Rotation }
  | { kind: 'utility'; utilityKind: UtilityKind }

interface PlannerState {
  /** null until the person creates a floor in the "New factory floor" dialog. */
  floorplan: Floorplan | null
  machines: MachineInstance[]
  utilities: Utility[]
  /** A machine or utility id. */
  selectedId: string | null
  /** Set while placing from the left panel; UI-only, not saved. */
  placing: Placing | null
  /** Show every utility's reach circle; UI-only, not saved. */
  showCoverage: boolean

  /** Start a fresh floor; clears all machines, utilities and selection. */
  newFloorplan: (input: NewFloorplanInput) => void
  /** Resize the current floor (mm). Machines are left where they are. */
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
    }),

  setFloorplan: (width, depth) =>
    set((s) => (s.floorplan ? { floorplan: { ...s.floorplan, width, depth } } : s)),

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
