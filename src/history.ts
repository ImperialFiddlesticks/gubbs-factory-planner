import { create } from 'zustand'
import { selection, usePlanner, type PlannerState } from '@/store'

/**
 * Undo / redo for the layout. Every change to the layout (floor, machines, utilities, pillars,
 * walls, zones) is recorded as one step: actions update the store once per change, and drags only
 * update it when dropped, so a whole drag is one step. Selection, layers and other UI state
 * aren't recorded. History is per project (it starts fresh when another project is opened) and
 * lasts for the session only (not autosaved).
 */

type Layout = Pick<PlannerState, 'floorplan' | 'machines' | 'utilities' | 'pillars' | 'walls' | 'zones' | 'loadingDocks' | 'loadingBays'>

/** Steps kept; older ones are dropped. */
const LIMIT = 100

const layoutOf = (s: Layout): Layout => ({
  floorplan: s.floorplan,
  machines: s.machines,
  utilities: s.utilities,
  pillars: s.pillars,
  walls: s.walls,
  zones: s.zones,
  loadingDocks: s.loadingDocks,
  loadingBays: s.loadingBays,
})

/** The store never mutates, so a changed list or floor is a new object. */
const changed = (a: Layout, b: Layout) =>
  a.floorplan !== b.floorplan ||
  a.machines !== b.machines ||
  a.utilities !== b.utilities ||
  a.pillars !== b.pillars ||
  a.walls !== b.walls ||
  a.zones !== b.zones ||
  a.loadingDocks !== b.loadingDocks ||
  a.loadingBays !== b.loadingBays

interface HistoryState {
  /** Earlier layouts, oldest first. */
  past: Layout[]
  /** Undone layouts, next redo first. */
  future: Layout[]
}

export const useHistory = create<HistoryState>()(() => ({ past: [], future: [] }))

/** Set while undo/redo writes to the store, so that write isn't recorded as a new step. */
let restoring = false

usePlanner.subscribe((state, prev) => {
  // Opening, creating or deleting a project starts a fresh history: undo stays within a project.
  if (state.floorplan?.id !== prev.floorplan?.id) {
    useHistory.setState({ past: [], future: [] })
    return
  }
  if (restoring || !changed(state, prev)) return
  useHistory.setState((h) => ({ past: [...h.past, layoutOf(prev)].slice(-LIMIT), future: [] }))
})

function restore(layout: Layout) {
  restoring = true
  usePlanner.setState((s) => {
    const ids = new Set([...layout.machines, ...layout.utilities, ...layout.pillars, ...layout.walls, ...layout.zones, ...layout.loadingDocks, ...layout.loadingBays].map((x) => x.id))
    return {
      ...layout,
      // Keep the selection where the items still exist; stop placing so the ghost doesn't linger.
      ...selection(s.selectedIds.filter((id) => ids.has(id))),
      singlePieceId: s.singlePieceId && ids.has(s.singlePieceId) ? s.singlePieceId : null,
      placing: null,
    }
  })
  restoring = false
}

export function undo() {
  const { past, future } = useHistory.getState()
  const previous = past.at(-1)
  if (!previous) return
  useHistory.setState({ past: past.slice(0, -1), future: [layoutOf(usePlanner.getState()), ...future] })
  restore(previous)
}

export function redo() {
  const { past, future } = useHistory.getState()
  const next = future[0]
  if (!next) return
  useHistory.setState({ past: [...past, layoutOf(usePlanner.getState())], future: future.slice(1) })
  restore(next)
}
