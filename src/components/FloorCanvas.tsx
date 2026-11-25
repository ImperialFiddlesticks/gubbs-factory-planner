import { useEffect, useRef, useState } from 'react'
import type Konva from 'konva'
import type { KonvaEventObject } from 'konva/lib/Node'
import { Group, Layer, Line, Shape, Stage } from 'react-konva'
import { ClearanceZone, Machine, MachineBody, type Outline } from '@/components/canvas/MachineNode'
import { GHOST_ID, type DragState } from '@/components/canvas/shared'
import { PillarBody, PillarNode } from '@/components/canvas/PillarNode'
import { WallBody, WallNode } from '@/components/canvas/WallNode'
import { CoverageCircle, UtilityGlyph, UtilityNode } from '@/components/canvas/UtilityNode'
import { SCALE } from '@/constants'
import { getMachineType } from '@/data/catalog'
import { DEFAULT_PILLAR_SIZE, DEFAULT_WALL_THICKNESS, MIN_WALL_LENGTH } from '@/data/structures'
import { UTILITY_KINDS } from '@/data/utilities'
import { floorCorners } from '@/lib/floorShapes'
import { snapToWall, straightenWall, wallLength } from '@/lib/geometry'
import { findLayoutIssues, idsWithIssues, needsByMachine } from '@/lib/validation'
import { usePlanner, type Placing } from '@/store'
import { CANVAS } from '@/theme'
import type { Floorplan, MachineInstance, Pillar, Point, Utility, Wall } from '@/types'

interface FloorCanvasProps {
  floorplan: Floorplan | null
}

export function FloorCanvas({ floorplan }: FloorCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const size = useElementSize(containerRef)

  return (
    <main
      ref={containerRef}
      className="relative overflow-hidden"
      style={{ backgroundColor: CANVAS.background }}
    >
      {floorplan && size.width > 0 && <FloorStage floorplan={floorplan} size={size} />}
      <PlacingHint />
    </main>
  )
}

function placingName(p: Placing) {
  if (p.kind === 'machine') return getMachineType(p.typeId)?.name
  if (p.kind === 'pillar') return 'Pillar'
  if (p.kind === 'wall') return 'Wall'
  return UTILITY_KINDS[p.utilityKind].name
}

/** Instruction strip shown at the top of the work area while placing. */
function PlacingHint() {
  const placing = usePlanner((s) => s.placing)
  if (!placing) return null
  if (placing.kind === 'wall') {
    return (
      <div className="pointer-events-none absolute top-3 left-1/2 -translate-x-1/2 rounded-md bg-foreground/90 px-3 py-1.5 text-xs text-background shadow">
        Drawing a <span className="font-semibold">Wall</span> ·{' '}
        {placing.start ? 'Click to set the end' : 'Click to set the start'} · Esc or right-click to
        cancel
      </div>
    )
  }
  return (
    <div className="pointer-events-none absolute top-3 left-1/2 -translate-x-1/2 rounded-md bg-foreground/90 px-3 py-1.5 text-xs text-background shadow">
      Placing <span className="font-semibold">{placingName(placing)}</span> · Click to place
      {placing.kind === 'machine' && ' · R to rotate'}
      {placing.kind === 'utility' && placing.utilityKind === 'exit' && ' on a wall'} · Esc or
      right-click to cancel
    </div>
  )
}

/** What is being moved right now (ghost or drag), at its live position. */
type Active =
  | { kind: 'machine'; item: MachineInstance }
  | { kind: 'utility'; item: Utility }
  | { kind: 'pillar'; item: Pillar }
  | { kind: 'wall'; item: Wall }

function FloorStage({
  floorplan,
  size,
}: {
  floorplan: Floorplan
  size: { width: number; height: number }
}) {
  const floorW = floorplan.width * SCALE
  const floorH = floorplan.depth * SCALE
  // Floors larger than the work area are shrunk to fit; smaller ones stay at SCALE.
  const fit = Math.min(
    1,
    (size.width - 2 * VIEW_PADDING) / floorW,
    (size.height - 2 * VIEW_PADDING) / floorH,
  )
  // Centre the floorplan in the work area.
  const originX = Math.round((size.width - floorW * fit) / 2)
  const originY = Math.round((size.height - floorH * fit) / 2)

  // Floor corners in layer px, flat [x0, y0, x1, y1, ...] for Konva.
  const floorPoints = floorCorners(floorplan).flatMap((p) => [p.x * SCALE, p.y * SCALE])
  const clipToFloor = (ctx: Konva.Context) => {
    ctx.beginPath()
    for (let i = 0; i < floorPoints.length; i += 2) {
      ctx.lineTo(floorPoints[i], floorPoints[i + 1])
    }
    ctx.closePath()
  }

  const machines = usePlanner((s) => s.machines)
  const utilities = usePlanner((s) => s.utilities)
  const pillars = usePlanner((s) => s.pillars)
  const walls = usePlanner((s) => s.walls)
  const lockStructures = usePlanner((s) => s.lockStructures)
  const selectedId = usePlanner((s) => s.selectedId)
  const placing = usePlanner((s) => s.placing)
  const showCoverage = usePlanner((s) => s.showCoverage)
  const select = usePlanner((s) => s.select)
  const addMachine = usePlanner((s) => s.addMachine)
  const addUtility = usePlanner((s) => s.addUtility)
  const addPillar = usePlanner((s) => s.addPillar)
  const addWall = usePlanner((s) => s.addWall)
  const setWallStart = usePlanner((s) => s.setWallStart)
  const cancelPlacing = usePlanner((s) => s.cancelPlacing)

  const layerRef = useRef<Konva.Layer>(null)
  /** Cursor position on the floor in mm, while it is over the canvas. */
  const [pointer, setPointer] = useState<{ x: number; y: number } | null>(null)
  const [drag, setDrag] = useState<DragState | null>(null)

  usePlacingKeys()

  const active = activeItem(placing, pointer, drag, machines, utilities, pillars, walls, floorplan)

  // The layout as it would be if the active item were dropped where it is now.
  // Recomputed every render; cheap for the number of items on a floor.
  const liveMachines = active?.kind === 'machine' ? withItem(machines, active.item) : machines
  const liveUtilities = active?.kind === 'utility' ? withItem(utilities, active.item) : utilities
  const livePillars = active?.kind === 'pillar' ? withItem(pillars, active.item) : pillars
  const liveWalls = active?.kind === 'wall' ? withItem(walls, active.item) : walls

  const issues = findLayoutIssues(liveMachines, liveUtilities, floorplan, { pillars: livePillars, walls: liveWalls })
  const spaceBad = idsWithIssues(issues, 'space')
  const utilityBad = idsWithIssues(issues, 'utility')
  const needs = needsByMachine(issues)

  // Clearance zones: the active/selected machine plus anything it physically clashes with.
  const focusId = active?.item.id ?? selectedId
  const zoneIds = new Set<string>()
  if (focusId) {
    zoneIds.add(focusId)
    for (const issue of issues) {
      if (issue.category === 'space' && issue.ids.includes(focusId)) {
        issue.ids.forEach((id) => zoneIds.add(id))
      }
    }
  }

  function pointerMm() {
    const p = layerRef.current?.getRelativePointerPosition()
    return p ? { x: p.x / SCALE, y: p.y / SCALE } : null
  }

  function handlePointerDown(e: KonvaEventObject<MouseEvent | TouchEvent>) {
    if (placing) {
      // Left click (or touch) drops the ghost where it is; right click is handled below.
      if ('button' in e.evt && e.evt.button !== 0) return
      const at = pointerMm()
      if (at && placing.kind === 'wall') {
        // Two clicks: the first sets the start, the second (far enough away) finishes the wall.
        if (!placing.start) return setWallStart(at)
        const end = straightenWall(placing.start, at)
        if (wallLength({ start: placing.start, end }) < MIN_WALL_LENGTH) return
        addWall(placing.start, end)
        cancelPlacing()
        return
      }
      if (at && placing.kind === 'machine') {
        addMachine(placing.typeId, { ...at, rotation: placing.rotation })
      } else if (at && placing.kind === 'utility') {
        addUtility(placing.utilityKind, at.x, at.y)
      } else if (at && placing.kind === 'pillar') {
        addPillar(at.x, at.y)
      }
      cancelPlacing()
      return
    }
    // Clicking empty floor clears the selection.
    const t = e.target
    if (!['.machine', '.utility', '.pillar', '.wall'].some((n) => t.findAncestor(n, true))) select(null)
  }

  function outlineFor(id: string): Outline {
    if (id === active?.item.id) return spaceBad.has(id) ? 'invalid' : 'valid'
    if (id === selectedId) return 'selected'
    return spaceBad.has(id) ? 'invalid' : 'none'
  }

  return (
    <Stage
      width={size.width}
      height={size.height}
      style={{ cursor: placing ? 'crosshair' : undefined }}
      onMouseDown={handlePointerDown}
      onTouchStart={handlePointerDown}
      onMouseMove={() => setPointer(pointerMm())}
      onMouseLeave={() => setPointer(null)}
      onContextMenu={(e) => {
        e.evt.preventDefault()
        cancelPlacing()
      }}
    >
      <Layer ref={layerRef} x={originX} y={originY} scaleX={fit} scaleY={fit}>
        {/* Floor, grid and walls follow the floor's outline (its rectangle when it has none). */}
        <Line points={floorPoints} closed fill={CANVAS.floor} listening={false} />
        <Group clipFunc={clipToFloor} listening={false}>
          <Grid floorplan={floorplan} fit={fit} />
        </Group>
        <Line
          points={floorPoints}
          closed
          stroke={CANVAS.floorStroke}
          strokeWidth={2}
          strokeScaleEnabled={false}
          lineJoin="round"
          listening={false}
        />

        {/* Coverage layer: all utilities when toggled on, otherwise just the active/selected one. */}
        {/* Clipped to the floor: reach stops at the building walls. */}
        <Group clipFunc={clipToFloor} listening={false}>
          {liveUtilities
            .filter((u) => showCoverage || u.id === focusId)
            .map((u) => (
              <CoverageCircle key={`cover-${u.id}`} utility={u} strong={u.id === focusId} walls={liveWalls} />
            ))}
        </Group>

        {/* Walls and pillars sit under machines and their clearance zones, so a clash stays visible. */}
        {walls.map((w) => (
          <WallNode
            key={w.id}
            wall={w}
            fit={fit}
            selected={w.id === selectedId}
            invalid={spaceBad.has(w.id)}
            interactive={!placing && !lockStructures}
            onDrag={setDrag}
          />
        ))}
        {pillars.map((p) => (
          <PillarNode
            key={p.id}
            pillar={p}
            fit={fit}
            selected={p.id === selectedId}
            invalid={spaceBad.has(p.id)}
            interactive={!placing && !lockStructures}
            onDrag={setDrag}
          />
        ))}

        {liveMachines
          .filter((m) => zoneIds.has(m.id))
          .map((m) => (
            <ClearanceZone key={`zone-${m.id}`} machine={m} valid={!spaceBad.has(m.id)} />
          ))}

        {machines.map((m) => (
          <Machine
            key={m.id}
            machine={m}
            outline={outlineFor(m.id)}
            needs={needs.get(m.id) ?? []}
            fit={fit}
            interactive={!placing}
            onDrag={setDrag}
          />
        ))}

        {utilities.map((u) => (
          <UtilityNode
            key={u.id}
            utility={u}
            floorplan={floorplan}
            fit={fit}
            selected={u.id === selectedId}
            invalid={utilityBad.has(u.id)}
            interactive={!placing}
            onDrag={setDrag}
          />
        ))}

        {active && active.kind !== 'wall' && active.item.id === GHOST_ID && (
          <Group
            x={active.item.x * SCALE}
            y={active.item.y * SCALE}
            opacity={0.75}
            listening={false}
          >
            {active.kind === 'machine' ? (
              <MachineBody
                typeId={active.item.typeId}
                rotation={active.item.rotation}
                outline={outlineFor(GHOST_ID)}
                needs={needs.get(GHOST_ID) ?? []}
                fit={fit}
                dashed
              />
            ) : active.kind === 'pillar' ? (
              <PillarBody
                width={active.item.width}
                depth={active.item.depth}
                fit={fit}
                outline={outlineFor(GHOST_ID)}
              />
            ) : (
              <UtilityGlyph utility={active.item} floorplan={floorplan} fit={fit} selected />
            )}
          </Group>
        )}

        {/* Wall being drawn: from the first click to the cursor, kept horizontal/vertical. */}
        {active?.kind === 'wall' && active.item.id === GHOST_ID && (
          <Group opacity={0.75} listening={false}>
            <WallBody wall={active.item} fit={fit} outline={outlineFor(GHOST_ID)} showLength />
          </Group>
        )}
      </Layer>
    </Stage>
  )
}

/** The ghost under the cursor, or the item being dragged, at its live position. */
function activeItem(
  placing: Placing | null,
  pointer: { x: number; y: number } | null,
  drag: DragState | null,
  machines: MachineInstance[],
  utilities: Utility[],
  pillars: Pillar[],
  walls: Wall[],
  floorplan: Floorplan,
): Active | null {
  if (placing && pointer) {
    if (placing.kind === 'machine') {
      return {
        kind: 'machine',
        item: { id: GHOST_ID, typeId: placing.typeId, rotation: placing.rotation, ...pointer },
      }
    }
    if (placing.kind === 'pillar') {
      return {
        kind: 'pillar',
        item: { id: GHOST_ID, ...pointer, width: DEFAULT_PILLAR_SIZE, depth: DEFAULT_PILLAR_SIZE },
      }
    }
    // A wall being drawn runs from the first click to the cursor (nothing to show before that).
    if (placing.kind === 'wall') {
      if (!placing.start) return null
      return {
        kind: 'wall',
        item: {
          id: GHOST_ID,
          start: placing.start,
          end: straightenWall(placing.start, pointer),
          thickness: DEFAULT_WALL_THICKNESS,
        },
      }
    }
    const info = UTILITY_KINDS[placing.utilityKind]
    const at = placing.utilityKind === 'exit' ? snapToWall(pointer.x, pointer.y, floorplan) : pointer
    return {
      kind: 'utility',
      item: {
        id: GHOST_ID,
        kind: placing.utilityKind,
        ...at,
        radius: info.defaultRadius,
        capacityKw: info.defaultCapacityKw,
      },
    }
  }
  if (!drag) return null
  const m = machines.find((m) => m.id === drag.id)
  if (m) return { kind: 'machine', item: { ...m, x: drag.x, y: drag.y } }
  const u = utilities.find((u) => u.id === drag.id)
  if (u) return { kind: 'utility', item: { ...u, x: drag.x, y: drag.y } }
  const p = pillars.find((p) => p.id === drag.id)
  if (p) return { kind: 'pillar', item: { ...p, x: drag.x, y: drag.y } }
  // A wall's drag state is its offset from where it started.
  const w = walls.find((w) => w.id === drag.id)
  if (w) {
    const shift = (q: Point) => ({ x: q.x + drag.x, y: q.y + drag.y })
    return { kind: 'wall', item: { ...w, start: shift(w.start), end: shift(w.end) } }
  }
  return null
}

/** Replace the item with the same id, or append it (for the ghost). */
function withItem<T extends { id: string }>(list: T[], item: T): T[] {
  return list.some((x) => x.id === item.id)
    ? list.map((x) => (x.id === item.id ? item : x))
    : [...list, item]
}

/** R rotates and Esc cancels whatever is being placed (ignored while typing in a field). */
function usePlacingKeys() {
  const placing = usePlanner((s) => s.placing !== null)
  const rotatePlacing = usePlanner((s) => s.rotatePlacing)
  const cancelPlacing = usePlanner((s) => s.cancelPlacing)

  useEffect(() => {
    if (!placing) return
    function onKeyDown(e: KeyboardEvent) {
      const t = e.target as HTMLElement
      if (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable) return
      if (e.key === 'Escape') cancelPlacing()
      else if (e.key === 'r' || e.key === 'R') rotatePlacing()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [placing, rotatePlacing, cancelPlacing])
}

/** Space kept between the floor and the edge of the work area, px. */
const VIEW_PADDING = 40
/** Grid lines closer than this on screen are thinned out, px. */
const MIN_GRID_PX = 6

/** All grid lines drawn as one shape, so large floors stay fast. */
function Grid({ floorplan, fit }: { floorplan: Floorplan; fit: number }) {
  const { width, depth, gridSize } = floorplan
  // Draw every nth line when the grid would be too dense to see.
  const every = Math.max(1, Math.ceil(MIN_GRID_PX / (gridSize * SCALE * fit)))
  const step = gridSize * every * SCALE
  const w = width * SCALE
  const h = depth * SCALE

  return (
    <Shape
      listening={false}
      stroke={CANVAS.grid}
      strokeWidth={1}
      strokeScaleEnabled={false}
      sceneFunc={(ctx, shape) => {
        ctx.beginPath()
        for (let x = step; x < w; x += step) {
          ctx.moveTo(x, 0)
          ctx.lineTo(x, h)
        }
        for (let y = step; y < h; y += step) {
          ctx.moveTo(0, y)
          ctx.lineTo(w, y)
        }
        ctx.strokeShape(shape)
      }}
    />
  )
}

function useElementSize(ref: React.RefObject<HTMLElement | null>) {
  const [size, setSize] = useState({ width: 0, height: 0 })
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect
      setSize({ width: Math.floor(width), height: Math.floor(height) })
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [ref])
  return size
}
