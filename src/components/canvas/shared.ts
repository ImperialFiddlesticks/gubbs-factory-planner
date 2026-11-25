import type { KonvaEventObject } from 'konva/lib/Node'

/** Live position (mm) of the machine or utility being dragged. */
export interface DragState {
  id: string
  x: number
  y: number
  /** Other machines moving with it by the same amount (the rest of a conveyor run). */
  group?: string[]
}

/** ID used for the ghost when it is checked against the layout rules. */
export const GHOST_ID = '__ghost__'

export function setCursor(e: KonvaEventObject<MouseEvent>, cursor: string) {
  const container = e.target.getStage()?.container()
  if (container) container.style.cursor = cursor
}
