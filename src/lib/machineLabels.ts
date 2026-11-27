const MACHINE_GROUPS: Record<string, string> = {
  'cnc-mill': 'CNC',
  'cnc-lathe': 'CNC',
  'hydraulic-press': 'PRESS',
  'conveyor-straight': 'BELT',
  'conveyor-corner-left': 'BELT',
  'conveyor-corner-right': 'BELT',
  'packing-table': 'PACK',
  'air-compressor': 'COMP',
}

export function machineLabelGroup(typeId: string) {
  return MACHINE_GROUPS[typeId] ?? 'MACHINE'
}

export function machineShortName(typeId: string, index: number) {
  return `${machineLabelGroup(typeId)} ${String(index).padStart(2, '0')}`
}
