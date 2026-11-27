import type { KonvaEventObject } from 'konva/lib/Node'
import { conveyorRuns } from '@/lib/conveyors'
import { usePlanner } from '@/store'

/** Live position (mm) of the machine or utility being dragged. */
export interface DragState {
  id: string
  x: number
  y: number
  /** Other machines moving with it by the same amount (the rest of a conveyor run). */
  group?: string[]
  /** A machine turned while dragging (snapped onto a conveyor end), degrees. */
  rotation?: number
}

/** ID used for the ghost when it is checked against the layout rules. */
export const GHOST_ID = '__ghost__'

export function setCursor(e: KonvaEventObject<MouseEvent>, cursor: string) {
  const container = e.target.getStage()?.container()
  if (container) container.style.cursor = cursor
}

/**
 * Pointer down on an item: Shift adds it to the selection or takes it out; pressing an item
 * that is already part of a multi-selection keeps the selection, so it can be dragged as a group.
 */
export function pressItem(id: string, e: KonvaEventObject<MouseEvent | TouchEvent>) {
  const s = usePlanner.getState()
  if ('shiftKey' in e.evt && e.evt.shiftKey) return s.toggleSelected(id)
  if (s.selectedIds.length > 1 && s.selectedIds.includes(id)) return
  s.select(id)
}

/** A click (no drag) on an item of a multi-selection selects just that item. */
export function clickItem(id: string, e: KonvaEventObject<MouseEvent | TouchEvent>) {
  if ('shiftKey' in e.evt && e.evt.shiftKey) return
  const s = usePlanner.getState()
  if (s.selectedIds.length > 1 && s.selectedIds.includes(id)) s.select(id)
}

/**
 * What moves along when an item is dragged (its own id excluded): the rest of a multi-selection,
 * or for a conveyor piece the rest of its run (unless double-clicked to move on its own).
 * Selected conveyor pieces always bring their whole run.
 */
export function dragGroup(id: string): string[] {
  const s = usePlanner.getState()
  const { runOf } = conveyorRuns(s.machines)
  const ids = new Set<string>()
  if (s.selectedIds.length > 1 && s.selectedIds.includes(id)) {
    for (const x of s.selectedIds) {
      ids.add(x)
      runOf.get(x)?.pieceIds.forEach((p) => ids.add(p))
    }
  } else if (s.singlePieceId !== id) {
    runOf.get(id)?.pieceIds.forEach((p) => ids.add(p))
  }
  ids.delete(id)
  return [...ids]
}
