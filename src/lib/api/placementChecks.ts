import type { CatalogMachine } from '@/data/catalog'
import type { Floorplan, MachineInstance } from '@/types'

export interface PlacementCheckResponse {
  canPlace: boolean
  code: string | null
}

export interface MachineInstanceDto {
  xmm: number
  ymm: number
  rotationDegrees: number
  length?: number | null
}

export interface MachineClearance {
  frontMm: number
  backMm: number
  leftMm: number
  rightMm: number
}

export interface MachineTypeDto {
  widthMm: number
  depthMm: number
  powerKw: number
  conveyor?: string | null
  clearance: MachineClearance
  needsWater: boolean
  needsFireSuppression: boolean
}

export interface PlacementPoint {
  x: number
  y: number
}

export interface PlacementCheckMachine {
  machine: MachineInstanceDto
  machineType: MachineTypeDto
}

export interface PlacementCheckRequest {
  hallWidthMm: number
  hallDepthMm: number
  hallOutline?: PlacementPoint[] | null
  otherMachines: PlacementCheckMachine[]
  machine: MachineInstanceDto
  machineType: MachineTypeDto
}

const API_BASE_URL = (
  import.meta.env.VITE_API_URL ?? 'http://localhost:5116'
).replace(/\/$/, '')

function toMachineInstanceDto(machine: MachineInstance): MachineInstanceDto {
  return {
    xmm: machine.x,
    ymm: machine.y,
    rotationDegrees: machine.rotation,
    ...(machine.length !== undefined && { length: machine.length }),
  }
}

function toMachineTypeDto(
  type: CatalogMachine,
  machine: MachineInstance,
): MachineTypeDto {
  const clearance = machine.clearance ?? type.clearance

  return {
    widthMm: machine.width ?? type.width,
    depthMm: machine.depth ?? type.depth,
    powerKw: type.powerKw,
    ...(type.conveyor && { conveyor: type.conveyor }),
    clearance: {
      frontMm: clearance.front,
      backMm: clearance.back,
      leftMm: clearance.left,
      rightMm: clearance.right,
    },
    needsWater: type.needsWater,
    needsFireSuppression: type.needsFireSuppression,
  }
}

export async function checkPlacement(
  floorplan: Floorplan,
  machine: MachineInstance,
  machineType: CatalogMachine,
  otherMachines: { machine: MachineInstance; machineType: CatalogMachine }[],
): Promise<PlacementCheckResponse> {
  const request: PlacementCheckRequest = {
    hallWidthMm: floorplan.width,
    hallDepthMm: floorplan.depth,
    ...(floorplan.outline && { hallOutline: floorplan.outline }),
    machine: toMachineInstanceDto(machine),
    machineType: toMachineTypeDto(machineType, machine),
    otherMachines: otherMachines.map(
      ({ machine: other, machineType: otherType }) => ({
        machine: toMachineInstanceDto(other),
        machineType: toMachineTypeDto(otherType, other),
      }),
    ),
  }

  const response = await fetch(`${API_BASE_URL}/api/placement-checks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  })

  if (!response.ok) {
    const details = await response.text()
    throw new Error(details || `Placement check failed (${response.status})`)
  }

  const result: unknown = await response.json()

  if (
    typeof result !== 'object' ||
    result === null ||
    !('canPlace' in result) ||
    typeof result.canPlace !== 'boolean' ||
    !('code' in result) ||
    (result.code !== null && typeof result.code !== 'string')
  ) {
    throw new Error('The placement-check API returned an unexpected response.')
  }

  return { canPlace: result.canPlace, code: result.code }
}