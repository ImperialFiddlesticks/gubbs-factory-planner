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
