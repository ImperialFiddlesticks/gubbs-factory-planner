/**
 * Shared data contract with the backend.
 *
 * Conventions:
 * - All lengths and coordinates are in millimetres (mm).
 * - The floorplan origin (0, 0) is its top-left corner; x grows right, y grows down.
 * - IDs are strings.
 */
import { z } from 'zod'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A point on the floorplan, mm. */
export interface Point {
  x: number
  y: number
}

export interface Floorplan {
  id: string
  name: string
  /** Size along x, mm. For a shaped floor, the width of its bounding box. */
  width: number
  /** Size along y, mm. For a shaped floor, the depth of its bounding box. */
  depth: number
  /** Factory height, mm. Optional for layouts saved before height was introduced. */
  height?: number
  /** Snap grid spacing, mm. */
  gridSize: number
  /**
   * Corners of a non-rectangular floor, in order (clockwise), mm. Every point lies
   * within 0..width × 0..depth. Omitted for a plain rectangle of width × depth.
   */
  outline?: Point[]
}

/** Free space a machine needs around it, mm, relative to the machine's own front. */
export interface Clearance {
  front: number
  back: number
  left: number
  right: number
}

/** A kind of machine in the catalog. */
export interface MachineType {
  id: string
  name: string
  /** Footprint along x when rotation is 0, mm. */
  width: number
  /** Footprint along y when rotation is 0, mm. */
  depth: number
  clearance: Clearance
  powerKw: number
  needsWater: boolean
  needsFireSuppression: boolean
  /** Typical height, mm (checked against height-limit zones). */
  height?: number
}

/** Rotation in degrees, clockwise. */
export type Rotation = number

/** A machine placed on the floorplan. */
export interface MachineInstance {
  id: string
  /** References MachineType.id. */
  typeId: string
  /** Optional per-instance footprint overrides, mm. */
  width?: number
  depth?: number
  /** Optional equipment height, mm; retained for reference but not used by 2D checks. */
  height?: number
  /** Optional per-instance working-space overrides, mm. */
  clearance?: Clearance
  /** Centre of the machine on the floorplan, mm. */
  x: number
  /** Centre of the machine on the floorplan, mm. */
  y: number
  rotation: Rotation
  /** Length of a straight conveyor belt, mm (its size along x at rotation 0). */
  length?: number
  /** Own name shown on the plan, e.g. "M1" or "Jig 3 – wing spar"; an automatic "CNC 01" when unset. */
  name?: string
  /** The work done at this station, free text. */
  work?: string
  /** How many people work here. */
  people?: number
  /** Fill colour on the plan (hex, e.g. "#1a9fd9"), e.g. to mark a product line; the default blue when unset. */
  colour?: string
}

export type UtilityKind = 'power' | 'water' | 'sprinkler' | 'extinguisher' | 'exit'

/** A utility point on the floorplan. */
export interface Utility {
  id: string
  kind: UtilityKind
  /** Position on the floorplan, mm. */
  x: number
  /** Position on the floorplan, mm. */
  y: number
  /** Reach of the utility, mm (e.g. sprinkler coverage); for extinguishers, the walking distance. */
  radius?: number
  /** Power available at this point, kW (power utilities only). */
  capacityKw?: number
}

/**
 * What a zone means: a plain labelled area, a keep-clear aisle (no machine may stand in it),
 * or a height limit (machines under it may be no taller than maxHeight).
 */
export type ZoneKind = 'area' | 'aisle' | 'height'

/** A marked floor area, e.g. "Zon 2: Svets & plåt", a transport aisle, or a low ceiling. */
export interface Zone {
  id: string
  name: string
  kind: ZoneKind
  /** Centre of the zone on the floorplan, mm. */
  x: number
  /** Centre of the zone on the floorplan, mm. */
  y: number
  /** Size along x, mm. */
  width: number
  /** Size along y, mm. */
  depth: number
  /** Fill/border colour on the plan, hex (e.g. "#1a9fd9"). */
  colour: string
  /** Height limits only: the tallest machine allowed under it, mm. */
  maxHeight?: number
}

/** A structural column: a fixed part of the building that machines must avoid. */
export interface Pillar {
  id: string
  /** Centre of the pillar on the floorplan, mm. */
  x: number
  /** Centre of the pillar on the floorplan, mm. */
  y: number
  /** Size along x, mm. */
  width: number
  /** Size along y, mm. */
  depth: number
}

/**
 * An internal wall: a straight, horizontal or vertical segment inside the hall.
 * Machines must avoid it, and it blocks utility reach and walking routes.
 */
export interface Wall {
  id: string
  /** One end of the wall's centre line, mm. */
  start: Point
  /** Other end of the wall's centre line, mm. Shares x or y with `start`. */
  end: Point
  /** mm. */
  thickness: number
}

export type LoadingDockFlowDirection = 'inbound' | 'outbound' | 'two-way'

/** An opening measured along the outer floor boundary from its first vertex, in millimetres. */
export interface LoadingDock {
  id: string
  name: string
  widthMm: number
  boundaryOffsetMm: number
  flowDirection: LoadingDockFlowDirection
}

/** Outdoor staging area connected to a loading dock; outline coordinates share the floorplan world space. */
export interface LoadingBay {
  id: string
  name: string
  loadingDockId: string
  outline: Point[]
}

export type TruckEnergyType = 'electric' | 'combustion' | 'other'
export type ForkliftCategory = 'pallet-truck' | 'stacker' | 'reach-truck' | 'counterbalance-forklift'
export type TruckServiceKind = 'charging' | 'battery-watering'
export type TruckRouteDirection = 'one-way' | 'two-way'
export type SafetyBarrierPurpose = 'pedestrian-separation' | 'machine-protection' | 'other'

export interface TruckType {
  id: string
  name: string
  widthMm: number | null
  lengthMm: number | null
  turningRadiusMm: number | null
  minimumAisleWidthMm: number | null
  loadCapacityKg: number | null
  energyType: TruckEnergyType
  batteryType?: string
  compatibleChargerTypes: string[]
  category?: ForkliftCategory
  manufacturer?: string
  model?: string
  configuration?: string
  sourceUrl?: string
}

/** A forklift model placed on the floor; distinct from its reusable catalogue type. */
export interface ForkliftInstance {
  id: string
  typeId: string
  x: number
  y: number
  rotation: Rotation
}

export interface TruckParkingSpot {
  id: string
  name: string
  outline: Point[]
  compatibleTruckTypeIds: string[]
}

export interface TruckServiceStation {
  id: string
  name: string
  x: number
  y: number
  kind: TruckServiceKind
  chargerType?: string
  serviceCapacity: number
  compatibleTruckTypeIds: string[]
  compatibleBatteryTypes: string[]
  connectedPowerUtilityId?: string
  connectedWaterUtilityId?: string
  chargerPowerKw?: number
  powerDemandKw?: number
  requiresPower?: boolean
}

export interface TruckRoute {
  id: string
  name: string
  points: Point[]
  usableWidthMm: number
  allowedTruckTypeIds: string[]
  direction: TruckRouteDirection
}

export interface PedestrianRoute {
  id: string
  name: string
  points: Point[]
  usableWidthMm: number
  parallel?: {
    truckRouteId: string
    side: 'left' | 'right'
    offsetMm: number
  }
}

export interface PedestrianCrossing {
  id: string
  name: string
  x: number
  y: number
  truckRouteId: string
  pedestrianRouteId: string
  pedestrianRouteIds?: string[]
}

export interface SafetyBarrierOpening {
  crossingId: string
  distanceMm: number
  widthMm: number
}

export interface SafetyBarrier {
  id: string
  name: string
  points: Point[]
  thicknessMm: number
  purpose: SafetyBarrierPurpose
  protectedTargetId?: string
  keepClearOutline?: Point[]
  generatedForPedestrianRouteId?: string
  openings?: SafetyBarrierOpening[]
}

/** A local discussion note anchored to a layout item or a floor location. */
export interface LayoutComment {
  id: string
  x: number
  y: number
  targetId?: string
  author: string
  createdAt: string
  message: string
  status: 'open' | 'resolved'
}

// ---------------------------------------------------------------------------
// Zod schemas (runtime validation). `satisfies` makes the compiler fail if a
// schema drifts from its interface above.
// ---------------------------------------------------------------------------

export const PointSchema = z.object({
  x: z.number(),
  y: z.number(),
}) satisfies z.ZodType<Point>

export const FloorplanSchema = z.object({
  id: z.string(),
  name: z.string(),
  width: z.number().positive(),
  depth: z.number().positive(),
  height: z.number().positive().optional(),
  gridSize: z.number().positive(),
  outline: z.array(PointSchema).min(3).optional(),
}) satisfies z.ZodType<Floorplan>

export const ClearanceSchema = z.object({
  front: z.number().nonnegative(),
  back: z.number().nonnegative(),
  left: z.number().nonnegative(),
  right: z.number().nonnegative(),
}) satisfies z.ZodType<Clearance>

export const MachineTypeSchema = z.object({
  id: z.string(),
  name: z.string(),
  width: z.number().positive(),
  depth: z.number().positive(),
  clearance: ClearanceSchema,
  powerKw: z.number().nonnegative(),
  needsWater: z.boolean(),
  needsFireSuppression: z.boolean(),
  height: z.number().positive().optional(),
}) satisfies z.ZodType<MachineType>

export const RotationSchema = z
    .number()
    .finite()
    .min(0)
    .refine((rotation) => rotation < 360) satisfies z.ZodType<Rotation>

export const MachineInstanceSchema = z.object({
  id: z.string(),
  typeId: z.string(),
  width: z.number().positive().optional(),
  depth: z.number().positive().optional(),
  height: z.number().positive().optional(),
  clearance: ClearanceSchema.optional(),
  x: z.number(),
  y: z.number(),
  rotation: RotationSchema,
  length: z.number().positive().optional(),
  name: z.string().optional(),
  work: z.string().optional(),
  people: z.number().int().min(0).optional(),
  colour: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
}) satisfies z.ZodType<MachineInstance>

export const UtilityKindSchema = z.enum([
  'power',
  'water',
  'sprinkler',
  'extinguisher',
  'exit',
]) satisfies z.ZodType<UtilityKind>

export const UtilitySchema = z.object({
  id: z.string(),
  kind: UtilityKindSchema,
  x: z.number(),
  y: z.number(),
  radius: z.number().positive().optional(),
  capacityKw: z.number().nonnegative().optional(),
}) satisfies z.ZodType<Utility>

export const ZoneSchema = z.object({
  id: z.string(),
  name: z.string(),
  kind: z.enum(['area', 'aisle', 'height']),
  x: z.number(),
  y: z.number(),
  width: z.number().positive(),
  depth: z.number().positive(),
  colour: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  maxHeight: z.number().positive().optional(),
}) satisfies z.ZodType<Zone>

export const PillarSchema = z.object({
  id: z.string(),
  x: z.number(),
  y: z.number(),
  width: z.number().positive(),
  depth: z.number().positive(),
}) satisfies z.ZodType<Pillar>

export const WallSchema = z
  .object({
    id: z.string(),
    start: PointSchema,
    end: PointSchema,
    thickness: z.number().positive(),
  })
  .refine((w) => w.start.x === w.end.x || w.start.y === w.end.y, {
    message: 'Walls must be horizontal or vertical.',
  }) satisfies z.ZodType<Wall>

export const LoadingDockSchema = z.object({
  id: z.string(),
  name: z.string().trim().min(1),
  widthMm: z.number().finite().positive(),
  boundaryOffsetMm: z.number().finite().nonnegative(),
  flowDirection: z.enum(['inbound', 'outbound', 'two-way']),
}) satisfies z.ZodType<LoadingDock>

export const LoadingBaySchema = z.object({
  id: z.string(),
  name: z.string().trim().min(1),
  loadingDockId: z.string(),
  outline: z.array(PointSchema).min(3),
}) satisfies z.ZodType<LoadingBay>

const IdListSchema = z.array(z.string())

export const TruckTypeSchema = z.object({
  id: z.string(),
  name: z.string(),
  widthMm: z.number().finite().nonnegative().nullable(),
  lengthMm: z.number().finite().nonnegative().nullable(),
  turningRadiusMm: z.number().finite().nonnegative().nullable(),
  minimumAisleWidthMm: z.number().finite().nonnegative().nullable(),
  loadCapacityKg: z.number().finite().nonnegative().nullable(),
  energyType: z.enum(['electric', 'combustion', 'other']),
  batteryType: z.string().optional(),
  compatibleChargerTypes: IdListSchema,
  category: z.enum(['pallet-truck', 'stacker', 'reach-truck', 'counterbalance-forklift']).optional(),
  manufacturer: z.string().optional(),
  model: z.string().optional(),
  configuration: z.string().optional(),
  sourceUrl: z.string().url().optional(),
}) satisfies z.ZodType<TruckType>

export const ForkliftInstanceSchema = z.object({
  id: z.string(),
  typeId: z.string(),
  x: z.number().finite(),
  y: z.number().finite(),
  rotation: z.number().finite(),
}) satisfies z.ZodType<ForkliftInstance>

export const TruckParkingSpotSchema = z.object({
  id: z.string(),
  name: z.string(),
  outline: z.array(PointSchema).min(3),
  compatibleTruckTypeIds: IdListSchema,
}) satisfies z.ZodType<TruckParkingSpot>

export const TruckServiceStationSchema = z.object({
  id: z.string(),
  name: z.string(),
  x: z.number().finite(),
  y: z.number().finite(),
  kind: z.enum(['charging', 'battery-watering']),
  chargerType: z.string().optional(),
  serviceCapacity: z.number().finite().nonnegative(),
  compatibleTruckTypeIds: IdListSchema,
  compatibleBatteryTypes: z.array(z.string()),
  connectedPowerUtilityId: z.string().optional(),
  connectedWaterUtilityId: z.string().optional(),
  chargerPowerKw: z.number().finite().nonnegative().optional(),
  powerDemandKw: z.number().finite().nonnegative().optional(),
  requiresPower: z.boolean().optional(),
}) satisfies z.ZodType<TruckServiceStation>

export const TruckRouteSchema = z.object({
  id: z.string(),
  name: z.string(),
  points: z.array(PointSchema).min(2),
  usableWidthMm: z.number().finite().nonnegative(),
  allowedTruckTypeIds: IdListSchema,
  direction: z.enum(['one-way', 'two-way']),
}) satisfies z.ZodType<TruckRoute>

export const PedestrianRouteSchema = z.object({
  id: z.string(),
  name: z.string(),
  points: z.array(PointSchema).min(2),
  usableWidthMm: z.number().finite().nonnegative(),
  parallel: z.object({
    truckRouteId: z.string(),
    side: z.enum(['left', 'right']),
    offsetMm: z.number().finite().nonnegative(),
  }).optional(),
}) satisfies z.ZodType<PedestrianRoute>

export const PedestrianCrossingSchema = z.object({
  id: z.string(),
  name: z.string(),
  x: z.number().finite(),
  y: z.number().finite(),
  truckRouteId: z.string(),
  pedestrianRouteId: z.string(),
  pedestrianRouteIds: z.array(z.string()).optional(),
}) satisfies z.ZodType<PedestrianCrossing>

export const SafetyBarrierSchema = z.object({
  id: z.string(),
  name: z.string(),
  points: z.array(PointSchema).min(2),
  thicknessMm: z.number().finite().nonnegative(),
  purpose: z.enum(['pedestrian-separation', 'machine-protection', 'other']),
  protectedTargetId: z.string().optional(),
  keepClearOutline: z.array(PointSchema).min(3).optional(),
  generatedForPedestrianRouteId: z.string().optional(),
  openings: z.array(z.object({ crossingId: z.string(), distanceMm: z.number().finite().nonnegative(), widthMm: z.number().finite().positive() })).optional(),
}) satisfies z.ZodType<SafetyBarrier>

export const LayoutCommentSchema = z.object({
  id: z.string(),
  x: z.number(),
  y: z.number(),
  targetId: z.string().optional(),
  author: z.string(),
  createdAt: z.string(),
  message: z.string(),
  status: z.enum(['open', 'resolved']),
}) satisfies z.ZodType<LayoutComment>
