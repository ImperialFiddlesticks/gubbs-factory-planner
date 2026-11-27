import type { CatalogMachine } from '@/data/catalog'
import type { Floorplan, MachineInstance } from '@/types'

export interface PlacementCheckResponse {
  canPlace: boolean
  code: string | null
}

interface ApiMachineInstance {
  id: string
  xmm: number
  ymm: number
  rotationDegrees: number
  length?: number
}

interface ApiMachineType {
  name: string
  widthMm: number
  depthMm: number
  clearance: {
    frontMm: number
    backMm: number
    leftMm: number
    rightMm: number
  }
  conveyor?: string
  powerKw: number
  needsWater: boolean
  needsFireSuppression: boolean
}

interface ApiPlacementCheckRequest {
  hallWidthMm: number
  hallDepthMm: number
  hallOutline?: { x: number; y: number }[]
  machine: ApiMachineInstance
  machineType: ApiMachineType
  otherMachines: { machine: ApiMachineInstance; machineType: ApiMachineType }[]
}

const API_BASE_URL = (import.meta.env.VITE_API_URL ?? 'http://localhost:5116').replace(/\/$/, '')

function toApiMachine(machine: MachineInstance): ApiMachineInstance {
  return {
    id: machine.id,
    xmm: machine.x,
    ymm: machine.y,
    rotationDegrees: machine.rotation,
    ...(machine.length !== undefined && { length: machine.length }),
  }
}

function toApiMachineType(type: CatalogMachine, machine: MachineInstance): ApiMachineType {
  const clearance = machine.clearance ?? type.clearance
  return {
    name: type.name,
    widthMm: machine.width ?? type.width,
    depthMm: machine.depth ?? type.depth,
    clearance: {
      frontMm: clearance.front,
      backMm: clearance.back,
      leftMm: clearance.left,
      rightMm: clearance.right,
    },
    ...(type.conveyor && { conveyor: type.conveyor }),
    powerKw: type.powerKw,
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
  const request: ApiPlacementCheckRequest = {
    hallWidthMm: floorplan.width,
    hallDepthMm: floorplan.depth,
    ...(floorplan.outline && { hallOutline: floorplan.outline }),
    machine: toApiMachine(machine),
    machineType: toApiMachineType(machineType, machine),
    otherMachines: otherMachines.map(({ machine: other, machineType: otherType }) => ({
      machine: toApiMachine(other),
      machineType: toApiMachineType(otherType, other),
    })),
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
    typeof result !== 'object' || result === null ||
    !('canPlace' in result) || typeof result.canPlace !== 'boolean' ||
    !('code' in result) || (result.code !== null && typeof result.code !== 'string')
  ) {
    throw new Error('The placement-check API returned an unexpected response.')
  }

  return { canPlace: result.canPlace, code: result.code }
}
