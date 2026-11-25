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
}

/** Rotation in degrees, clockwise. */
export type Rotation = 0 | 90 | 180 | 270

/** A machine placed on the floorplan. */
export interface MachineInstance {
  id: string
  /** References MachineType.id. */
  typeId: string
  /** Centre of the machine on the floorplan, mm. */
  x: number
  /** Centre of the machine on the floorplan, mm. */
  y: number
  rotation: Rotation
}

export type UtilityKind = 'power' | 'water' | 'sprinkler' | 'exit'

/** A utility point on the floorplan. */
export interface Utility {
  id: string
  kind: UtilityKind
  /** Position on the floorplan, mm. */
  x: number
  /** Position on the floorplan, mm. */
  y: number
  /** Reach of the utility, mm (e.g. sprinkler coverage). */
  radius?: number
  /** Power available at this point, kW (power utilities only). */
  capacityKw?: number
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
}) satisfies z.ZodType<MachineType>

export const RotationSchema = z.union([
  z.literal(0),
  z.literal(90),
  z.literal(180),
  z.literal(270),
]) satisfies z.ZodType<Rotation>

export const MachineInstanceSchema = z.object({
  id: z.string(),
  typeId: z.string(),
  x: z.number(),
  y: z.number(),
  rotation: RotationSchema,
}) satisfies z.ZodType<MachineInstance>

export const UtilityKindSchema = z.enum([
  'power',
  'water',
  'sprinkler',
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
