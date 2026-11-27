import { COLORS } from '@/theme'
import { machineTypeFor } from '@/data/catalog'
import { bodyRect, boxToRect, rectsOverlap } from '@/lib/geometry'
import type { MachineInstance, Zone, ZoneKind } from '@/types'

export interface ZoneKindInfo {
  kind: ZoneKind
  /** Also the start of a new zone's name ("Aisle 1"). */
  name: string
  /** For the catalog and the type picker. */
  description: string
  /** A new zone's colour. */
  colour: string
}

export const ZONE_KINDS: Record<ZoneKind, ZoneKindInfo> = {
  area: { kind: 'area', name: 'Area', description: 'Label part of the floor', colour: COLORS.blue },
  aisle: { kind: 'aisle', name: 'Aisle', description: 'Keep clear: no machines', colour: COLORS.yellowDark },
  height: { kind: 'height', name: 'Height limit', description: 'Low ceiling, duct or mezzanine', colour: COLORS.violet },
}

export const ZONE_KIND_LIST = Object.values(ZONE_KINDS)

/** A new height-limit zone's maximum height, mm. */
export const DEFAULT_HEIGHT_LIMIT = 3000
/** Zones smaller than this on either side aren't created (a click rather than a drag), mm. */
export const MIN_ZONE_SIZE = 500

/** A zone's area in m², one decimal. */
export const zoneArea = (z: { width: number; depth: number }) => Math.round((z.width * z.depth) / 1e5) / 10

/** Machines standing (at least partly) in a zone. */
export function machinesInZone(zone: Zone, machines: MachineInstance[]): MachineInstance[] {
  const area = boxToRect({ x: zone.x - zone.width / 2, y: zone.y - zone.depth / 2, width: zone.width, depth: zone.depth })
  return machines.filter((m) => {
    const type = machineTypeFor(m)
    return type !== undefined && rectsOverlap(bodyRect(type, m), area)
  })
}
