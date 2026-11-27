import type { MachineInstance } from '@/types'

const MACHINE_GROUPS: Record<string, string> = {
  'cnc-mill': 'CNC',
  'cnc-lathe': 'CNC',
  'hydraulic-press': 'PRESS',
  'conveyor-straight': 'BELT',
  'conveyor-corner-left': 'BELT',
  'conveyor-corner-right': 'BELT',
  'packing-table': 'PACK',
  'air-compressor': 'COMP',
  'assembly-jig-large': 'JIG',
  'assembly-jig-small': 'JIG',
  'work-bench': 'BENCH',
  'assembly-table': 'TABLE',
  'quality-table': 'QC',
  'pillar-drill': 'DRILL',
  'band-saw': 'SAW',
  'welding-table': 'WELD',
  'grinding-bench': 'GRIND',
  'press-brake': 'BRAKE',
  'hydraulic-press-30t': 'PRESS',
  'tool-cabinet': 'TOOL',
  'tool-trolley': 'TOOL',
  'storage-shelf': 'SHELF',
  'eur-pallet': 'PALLET',
  'chemicals-cabinet': 'CHEM',
  'parts-washer': 'WASH',
}

export function machineLabelGroup(typeId: string) {
  return MACHINE_GROUPS[typeId] ?? 'MACHINE'
}

export function machineShortName(typeId: string, index: number) {
  return `${machineLabelGroup(typeId)} ${String(index).padStart(2, '0')}`
}

/** A machine's automatic name: its group and its number among machines of that group ("CNC 02"). */
export function machineAutoName(machine: Pick<MachineInstance, 'id' | 'typeId'>, machines: Pick<MachineInstance, 'id' | 'typeId'>[]) {
  const group = machineLabelGroup(machine.typeId)
  const index = machines.filter((m) => machineLabelGroup(m.typeId) === group).findIndex((m) => m.id === machine.id) + 1
  return machineShortName(machine.typeId, index)
}

/** The name a machine goes by on the plan and in warnings: its own name, or its automatic one. */
export function machineName(machine: Pick<MachineInstance, 'id' | 'typeId' | 'name'>, machines: Pick<MachineInstance, 'id' | 'typeId'>[]) {
  return machine.name ?? machineAutoName(machine, machines)
}
