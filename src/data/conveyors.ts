/** Conveyor pieces: straight belts (any length in range) and 90° corners. Lengths in mm. */
export type ConveyorPiece = 'straight' | 'corner-left' | 'corner-right'

/** Belt width, and the size of a corner piece, mm. */
export const CONVEYOR_WIDTH = 800
export const MIN_CONVEYOR_LENGTH = 1000
export const MAX_CONVEYOR_LENGTH = 30000
export const DEFAULT_CONVEYOR_LENGTH = 3000
/** Drive power per metre of belt, kW. */
export const CONVEYOR_KW_PER_M = 0.25

export const isValidConveyorLength = (mm: number) =>
  mm >= MIN_CONVEYOR_LENGTH && mm <= MAX_CONVEYOR_LENGTH
