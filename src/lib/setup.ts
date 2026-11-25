/** Validation rules for the setup wizard's answers. */

export const MIN_STATIONS = 1
export const MAX_STATIONS = 50

export function isValidStationTarget(n: number) {
  return Number.isInteger(n) && n >= MIN_STATIONS && n <= MAX_STATIONS
}
