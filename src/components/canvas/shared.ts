import type { KonvaEventObject } from 'konva/lib/Node'

/** Live position (mm) of the machine or utility being dragged. */
export interface DragState {
  id: string
  x: number
  y: number
}

/** ID used for the ghost when it is checked against the layout rules. */
export const GHOST_ID = '__ghost__'

export function setCursor(e: KonvaEventObject<MouseEvent>, cursor: string) {
  const container = e.target.getStage()?.container()
  if (container) container.style.cursor = cursor
}
