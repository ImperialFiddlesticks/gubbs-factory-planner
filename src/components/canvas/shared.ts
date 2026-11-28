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

/**
 * How much room an upright text block has inside a card turned by `rotation` degrees: the
 * width of the widest level band of height `blockHeight`, centred on the card, that stays
 * inside it, and the card's height straight through its centre. `w` and `h` are the card's
 * own (unturned) size. Lets labels stay level and readable whichever way an item faces.
 */
export function uprightTextRoom(w: number, h: number, rotation: number, blockHeight: number) {
  const a = (rotation * Math.PI) / 180
  const cos = Math.cos(a)
  const sin = Math.sin(a)
  const corners = [
    [-w / 2, -h / 2],
    [w / 2, -h / 2],
    [w / 2, h / 2],
    [-w / 2, h / 2],
  ].map(([x, y]) => [x * cos - y * sin, x * sin + y * cos])
  /** Where the level line at height y crosses the turned card: [left, right], or null. */
  const span = (y: number): [number, number] | null => {
    const xs: number[] = []
    for (let i = 0; i < 4; i++) {
      const [x1, y1] = corners[i]
      const [x2, y2] = corners[(i + 1) % 4]
      if ((y1 - y) * (y2 - y) > 0 || y1 === y2) continue
      xs.push(x1 + ((y - y1) / (y2 - y1)) * (x2 - x1))
    }
    return xs.length >= 2 ? [Math.min(...xs), Math.max(...xs)] : null
  }
  const half = Math.min(blockHeight / 2, h / 2, w / 2)
  const top = span(-half)
  const bottom = span(half)
  // The card is symmetric about its centre, so the band's left and right edges mirror.
  const width = top && bottom ? Math.max(0, Math.min(top[1], bottom[1]) - Math.max(top[0], bottom[0])) : 0
  // Straight up through the centre: the same question for a level card turned the other way.
  const height = Math.min(Math.abs(cos) > 1e-6 ? h / Math.abs(cos) : Infinity, Math.abs(sin) > 1e-6 ? w / Math.abs(sin) : Infinity)
  return { width, height }
}
