import { useEffect, useRef, useState } from 'react'
import type Konva from 'konva'
import type { KonvaEventObject } from 'konva/lib/Node'
import { Group, Label, Layer, Line, Rect, Shape, Stage, Tag, Text } from 'react-konva'
import { MapToolbar } from '@/components/MapToolbar'
import { ConveyorEnds } from '@/components/canvas/ConveyorBody'
import { CommentMarkers } from '@/components/canvas/CommentMarkers'
import { ClearanceZone, Machine, MachineBody, type Outline } from '@/components/canvas/MachineNode'
import { GHOST_ID, type DragState } from '@/components/canvas/shared'
import { PillarBody, PillarNode } from '@/components/canvas/PillarNode'
import { WallBody, WallNode } from '@/components/canvas/WallNode'
import { ZoneNode, ZoneShape } from '@/components/canvas/ZoneNode'
import { CoverageCircle, UtilityGlyph, UtilityNode } from '@/components/canvas/UtilityNode'
import { PowerLoadTags, SupplyLines } from '@/components/canvas/SupplyLines'
import { WalkingRoutes } from '@/components/canvas/WalkingRoutes'
import { SCALE } from '@/constants'
import { getMachineType, machineTypeFor } from '@/data/catalog'
import { UTILITY_LAYER, utilityVisible } from '@/data/layers'
import { DEFAULT_PILLAR_SIZE, DEFAULT_WALL_THICKNESS, MIN_WALL_LENGTH } from '@/data/structures'
import { UTILITY_KINDS } from '@/data/utilities'
import { MIN_ZONE_SIZE, ZONE_KINDS, zoneArea } from '@/data/zones'
import { conveyorRuns, snapConveyor, snapMachineToConveyor } from '@/lib/conveyors'
import { keepOnFloor } from '@/lib/placement'
import { floorCorners } from '@/lib/floorShapes'
import {
  bodyBox,
  boxesOverlap,
  pillarBox,
  snapToWall,
  straightenWall,
  wallBox,
  wallLength,
  type Box,
} from '@/lib/geometry'
import { findLayoutIssues, idsWithIssues, needsByMachine } from '@/lib/validation'
import { useElementSize } from '@/lib/useElementSize'
import { usePlanner, type Placing } from '@/store'
import { CANVAS } from '@/theme'
import type { Floorplan, MachineInstance, Pillar, Point, Utility, Wall, Zone, ZoneKind } from '@/types'

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
      {floorplan && size.width > 0 && <FloorStage key={floorplan.id} floorplan={floorplan} size={size} />}
      <PlacingHint />
    </main>
  )
}

function placingName(p: Placing) {
  if (p.kind === 'machine') return getMachineType(p.typeId)?.name
  if (p.kind === 'pillar') return 'Pillar'
  if (p.kind === 'wall') return 'Wall'
  if (p.kind === 'zone') return ZONE_KINDS[p.zoneKind].name
  return UTILITY_KINDS[p.utilityKind].name
}

/** Instruction strip shown at the top of the work area while placing. */
function PlacingHint() {
  const placing = usePlanner((s) => s.placing)
  const commentDraft = usePlanner((s) => s.commentDraft)
  if (commentDraft) {
    return (
      <div className="pointer-events-none absolute top-3 left-1/2 -translate-x-1/2 rounded-md bg-foreground/90 px-3 py-1.5 text-xs text-background shadow">
        Pin comment on the floor · Click a location · Esc to cancel
      </div>
    )
  }
  if (!placing) return null
  if (placing.kind === 'zone') {
    return (
      <div className="pointer-events-none absolute top-3 left-1/2 -translate-x-1/2 rounded-md bg-foreground/90 px-3 py-1.5 text-xs text-background shadow">
        Drawing a <span className="font-semibold">{ZONE_KINDS[placing.zoneKind].name}</span> zone · Press and
        drag on the floor · Esc or right-click to cancel
      </div>
    )
  }
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
  // The map toolbar sits at the bottom, so the floor uses the space above it.
  const viewH = size.height - TOOLBAR_SPACE
  // Floors larger than the work area are shrunk to fit; smaller ones stay at SCALE.
  const baseFit = Math.min(
    1,
    (size.width - 2 * VIEW_PADDING) / floorW,
    (viewH - 2 * VIEW_PADDING) / floorH,
  )
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [panActive, setPanActive] = useState(false)
  const panStart = useRef<{ pointer: Point; pan: Point } | null>(null)
  const spacePan = useSpacePan()
  const fit = baseFit * zoom
  // Keep the plan centred at the current zoom, then apply any user panning.
  const originX = Math.round((size.width - floorW * fit) / 2 + pan.x)
  const originY = Math.round((viewH - floorH * fit) / 2 + pan.y)

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
  const zones = usePlanner((s) => s.zones)
  const lockStructures = usePlanner((s) => s.lockStructures)
  const selectedId = usePlanner((s) => s.selectedId)
  const selectedIds = usePlanner((s) => s.selectedIds)
  const selectMany = usePlanner((s) => s.selectMany)
  const singlePieceId = usePlanner((s) => s.singlePieceId)
  const placing = usePlanner((s) => s.placing)
  const layers = usePlanner((s) => s.layers)
  const comments = usePlanner((s) => s.comments)
  const commentDraft = usePlanner((s) => s.commentDraft)
  const select = usePlanner((s) => s.select)
  const addMachine = usePlanner((s) => s.addMachine)
  const addUtility = usePlanner((s) => s.addUtility)
  const addPillar = usePlanner((s) => s.addPillar)
  const addWall = usePlanner((s) => s.addWall)
  const setWallStart = usePlanner((s) => s.setWallStart)
  const setZoneStart = usePlanner((s) => s.setZoneStart)
  const addZone = usePlanner((s) => s.addZone)
  const cancelPlacing = usePlanner((s) => s.cancelPlacing)
  const addLocationComment = usePlanner((s) => s.addLocationComment)
  const cancelCommentPlacement = usePlanner((s) => s.cancelCommentPlacement)

  const layerRef = useRef<Konva.Layer>(null)
  /** Cursor position on the floor in mm, while it is over the canvas. */
  const [pointer, setPointer] = useState<{ x: number; y: number } | null>(null)
  const [drag, setDrag] = useState<DragState | null>(null)
  /** Selection box being dragged out on empty floor, in mm; `add` when Shift was held. */
  const [box, setBox] = useState<{ start: Point; end: Point; add: boolean } | null>(null)

  function zoomAround(nextZoom: number, anchor: Point) {
    const boundedZoom = Math.max(1, Math.min(4, nextZoom))
    const oldFit = baseFit * zoom
    const nextFit = baseFit * boundedZoom
    const oldOriginX = (size.width - floorW * oldFit) / 2 + pan.x
    const oldOriginY = (viewH - floorH * oldFit) / 2 + pan.y
    const mapX = (anchor.x - oldOriginX) / oldFit
    const mapY = (anchor.y - oldOriginY) / oldFit
    const nextOriginX = (size.width - floorW * nextFit) / 2
    const nextOriginY = (viewH - floorH * nextFit) / 2
    setZoom(boundedZoom)
    setPan({
      x: anchor.x - nextOriginX - mapX * nextFit,
      y: anchor.y - nextOriginY - mapY * nextFit,
    })
  }

  function zoomAtCenter(nextZoom: number) {
    zoomAround(nextZoom, { x: size.width / 2, y: viewH / 2 })
  }

  function fitToView() {
    setZoom(1)
    setPan({ x: 0, y: 0 })
  }

  usePlacingKeys()
  useSelectionKeys()

  const active = keepGhostOnFloor(
    activeItem(placing, pointer, drag, machines, utilities, pillars, walls, floorplan),
    floorplan,
  )

  // Items moving along with the dragged one (multi-selection, conveyor run), at their live spot.
  const delta = groupDelta(drag, machines, utilities, pillars, walls, zones)
  const moving = new Set(delta ? drag?.group : [])
  const shiftItems = <T extends { id: string; x: number; y: number }>(list: T[]) =>
    delta ? list.map((i) => (moving.has(i.id) ? { ...i, x: i.x + delta.x, y: i.y + delta.y } : i)) : list
  const shiftPoint = (p: Point) => (delta ? { x: p.x + delta.x, y: p.y + delta.y } : p)
  const shownUtilities = shiftItems(utilities)
  const shownPillars = shiftItems(pillars)
  const shownZones = shiftItems(zones)
  const shownWalls = delta
    ? walls.map((w) => (moving.has(w.id) ? { ...w, start: shiftPoint(w.start), end: shiftPoint(w.end) } : w))
    : walls

  // The layout as it would be if the active item (and its group) were dropped where it is now.
  // Recomputed every render; cheap for the number of items on a floor.
  const liveMachines = shiftItems(active?.kind === 'machine' ? withItem(machines, active.item) : machines)
  const liveUtilities = active?.kind === 'utility' ? withItem(shownUtilities, active.item) : shownUtilities
  const livePillars = active?.kind === 'pillar' ? withItem(shownPillars, active.item) : shownPillars
  const liveWalls = active?.kind === 'wall' ? withItem(shownWalls, active.item) : shownWalls

  // A zone being dragged by its tag, at its live spot.
  const draggedZone = drag && zones.find((z) => z.id === drag.id)
  const liveZones = draggedZone ? withItem(shownZones, { ...draggedZone, x: drag.x, y: drag.y }) : shownZones
  const issues = findLayoutIssues(liveMachines, liveUtilities, floorplan, {
    pillars: livePillars,
    walls: liveWalls,
    zones: layers.zones ? liveZones : zones,
  })
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
    if (commentDraft) {
      if ('button' in e.evt && e.evt.button !== 0) return
      const at = pointerMm()
      if (at) addLocationComment(at.x, at.y)
      return
    }
    if (spacePan && !placing && 'button' in e.evt && e.evt.button === 0) {
      const pointer = e.target.getStage()?.getPointerPosition()
      if (pointer) {
        panStart.current = { pointer, pan }
        setPanActive(true)
      }
      return
    }
    if (placing) {
      // Left click (or touch) drops the ghost where it is; right click is handled below.
      if ('button' in e.evt && e.evt.button !== 0) return
      const at = pointerMm()
      // Zones: press here, drag, release to finish (see finishZone).
      if (at && placing.kind === 'zone') return setZoneStart(at)
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
        // Where the ghost is drawn, which includes conveyor snapping and staying on the floor.
        const ghost = active?.kind === 'machine' ? active.item : at
        // In the cut-out corner of a shaped floor it can't go: wait for a click where it fits.
        if (active?.kind === 'machine' && !keepOnFloor([active.item], { x: 0, y: 0 }, floorplan)) return
        // The ghost's rotation: a machine snapped onto a belt end is turned to face it.
        const rotation = active?.kind === 'machine' ? active.item.rotation : placing.rotation
        addMachine(placing.typeId, { x: ghost.x, y: ghost.y, rotation, length: placing.length })
      } else if (at && placing.kind === 'utility') {
        addUtility(placing.utilityKind, at.x, at.y)
      } else if (at && placing.kind === 'pillar') {
        addPillar(at.x, at.y)
      }
      cancelPlacing()
      return
    }
    // Pressing empty floor starts a selection box (a plain click clears the selection on release).
    const t = e.target
    if (['.machine', '.utility', '.pillar', '.wall', '.zone'].some((n) => t.findAncestor(n, true))) return
    if ('button' in e.evt && e.evt.button !== 0) return
    const at = pointerMm()
    if (at) setBox({ start: at, end: at, add: e.evt.shiftKey })
  }

  function handlePointerMove(e: KonvaEventObject<MouseEvent | TouchEvent>) {
    const screenPointer = e.target.getStage()?.getPointerPosition()
    if (panStart.current && screenPointer) {
      setPan({
        x: panStart.current.pan.x + screenPointer.x - panStart.current.pointer.x,
        y: panStart.current.pan.y + screenPointer.y - panStart.current.pointer.y,
      })
      return
    }
    const at = pointerMm()
    setPointer(at)
    if (box && at) setBox({ ...box, end: at })
  }

  /** Release while drawing a zone: create it if it's big enough, or wait for another try. */
  function finishZone() {
    if (placing?.kind !== 'zone' || !placing.start) return
    const at = pointerMm()
    const r = at && boxRect(placing.start, at)
    if (at && r && r.width >= MIN_ZONE_SIZE && r.depth >= MIN_ZONE_SIZE) {
      addZone(placing.zoneKind, placing.start, at)
      cancelPlacing()
    } else {
      setZoneStart(null)
    }
  }

  /** Release: select everything the box touches (added to the selection with Shift). */
  function finishBox() {
    if (!box) return
    setBox(null)
    const r = boxRect(box.start, box.end)
    // Barely moved: it was a click on empty floor.
    if (Math.max(r.width, r.depth) * SCALE * fit < 4) {
      if (!box.add) select(null)
      return
    }
    const hit = (b: Box) => boxesOverlap(r, b)
    const ids = [
      ...machines.flatMap((m) => {
        const type = machineTypeFor(m)
        return type && hit(bodyBox(type, m)) ? [m.id] : []
      }),
      ...utilities
        .filter((u) => utilityVisible(u.kind, layers))
        .filter((u) => u.x >= r.x && u.x <= r.x + r.width && u.y >= r.y && u.y <= r.y + r.depth)
        .map((u) => u.id),
      // Locked structures can't be selected.
      ...(lockStructures ? [] : pillars.filter((p) => hit(pillarBox(p))).map((p) => p.id)),
      ...(lockStructures ? [] : walls.filter((w) => hit(wallBox(w))).map((w) => w.id)),
    ]
    selectMany(ids, box.add)
  }

  // Everything selected, plus the whole run of any selected conveyor piece (what a drag moves),
  // unless the piece was double-clicked to move on its own.
  const selected = new Set(selectedIds)
  const { runOf } = conveyorRuns(liveMachines)
  for (const id of selectedIds) {
    if (id !== singlePieceId) runOf.get(id)?.pieceIds.forEach((p) => selected.add(p))
  }

  function outlineFor(id: string): Outline {
    if (id === active?.item.id) return spaceBad.has(id) ? 'invalid' : 'valid'
    if (selected.has(id)) return 'selected'
    return spaceBad.has(id) ? 'invalid' : 'none'
  }

  return (
    <>
    <Stage
      width={size.width}
      height={size.height}
      style={{ cursor: placing ? 'crosshair' : panActive ? 'grabbing' : spacePan ? 'grab' : undefined }}
      onMouseDown={handlePointerDown}
      onTouchStart={handlePointerDown}
      onMouseMove={handlePointerMove}
      onTouchMove={handlePointerMove}
      onMouseUp={() => {
        panStart.current = null
        setPanActive(false)
        finishZone()
        finishBox()
      }}
      onTouchEnd={() => {
        finishZone()
        finishBox()
      }}
      onMouseLeave={() => {
        setPointer(null)
        panStart.current = null
        setPanActive(false)
        finishBox()
      }}
      onWheel={(e) => {
        const pointer = e.target.getStage()?.getPointerPosition()
        if (!pointer) return
        e.evt.preventDefault()
        zoomAround(zoom * (e.evt.deltaY > 0 ? 1 / 1.1 : 1.1), pointer)
      }}
      onContextMenu={(e) => {
        e.evt.preventDefault()
        if (commentDraft) cancelCommentPlacement()
        else cancelPlacing()
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

        {/* Zones are floor markings: under everything else. Only their name tags are clickable. */}
        {layers.zones &&
          shownZones.map((z) => (
            <ZoneNode
              key={z.id}
              zone={z}
              fit={fit}
              selected={selected.has(z.id)}
              resizable={selectedId === z.id}
              interactive={!placing && !spacePan && !commentDraft}
              onDrag={setDrag}
            />
          ))}
        {/* Zone being drawn: from where the mouse went down to the cursor, with its size. */}
        {placing?.kind === 'zone' && placing.start && pointer && (
          <ZoneGhost kind={placing.zoneKind} a={placing.start} b={pointer} fit={fit} />
        )}

        {/* Coverage: utilities whose layer is on, plus the active/selected one. */}
        {/* Clipped to the floor: reach stops at the building walls. */}
        <Group clipFunc={clipToFloor} listening={false}>
          {liveUtilities
            .filter((u) => layers[UTILITY_LAYER[u.kind]] || u.id === focusId)
            .map((u) => (
              <CoverageCircle key={`cover-${u.id}`} utility={u} strong={u.id === focusId} walls={liveWalls} />
            ))}
        </Group>

        {/* Walls and pillars sit under machines and their clearance zones, so a clash stays visible. */}
        {shownWalls.map((w) => (
          <WallNode
            key={w.id}
            wall={w}
            fit={fit}
            selected={selected.has(w.id)}
            invalid={spaceBad.has(w.id)}
            interactive={!placing && !lockStructures && !spacePan && !commentDraft}
            onDrag={setDrag}
          />
        ))}
        {shownPillars.map((p) => (
          <PillarNode
            key={p.id}
            pillar={p}
            fit={fit}
            selected={selected.has(p.id)}
            invalid={spaceBad.has(p.id)}
            interactive={!placing && !lockStructures && !spacePan && !commentDraft}
            onDrag={setDrag}
          />
        ))}

        {liveMachines
          .filter((m) => zoneIds.has(m.id))
          .map((m) => (
            <ClearanceZone key={`zone-${m.id}`} machine={m} valid={!spaceBad.has(m.id)} />
          ))}

        {/* Live positions, so the rest of a dragged conveyor run moves along. */}
        {liveMachines
          .filter((m) => m.id !== GHOST_ID)
          .map((m) => (
            <Machine
              key={m.id}
              machine={m}
              outline={outlineFor(m.id)}
              needs={needs.get(m.id) ?? []}
              fit={fit}
              interactive={!placing && !spacePan && !commentDraft}
              onDrag={setDrag}
            />
          ))}

        {/* Free conveyor ends, where a run can continue (includes the piece being moved), */}
        {/* and free machine fronts while a conveyor piece is being moved. */}
        <ConveyorEnds
          machines={liveMachines}
          showFronts={active?.kind === 'machine' && !!getMachineType(active.item.typeId)?.conveyor}
          fit={fit}
        />

        {/* Lines and routes go above machines (they end at the machine's edge), under utilities. */}
        <SupplyLines
          kind="water"
          all={layers.water}
          focusId={focusId}
          machines={liveMachines}
          utilities={liveUtilities}
          walls={liveWalls}
          fit={fit}
        />
        <SupplyLines
          kind="power"
          all={layers.electrical}
          focusId={focusId}
          machines={liveMachines}
          utilities={liveUtilities}
          walls={liveWalls}
          fit={fit}
        />
        <WalkingRoutes
          kind="extinguisher"
          all={layers.fire}
          focusId={focusId}
          machines={liveMachines}
          utilities={liveUtilities}
          walls={liveWalls}
          floorplan={floorplan}
          fit={fit}
        />
        <WalkingRoutes
          kind="exit"
          all={layers.exits}
          focusId={focusId}
          machines={liveMachines}
          utilities={liveUtilities}
          walls={liveWalls}
          floorplan={floorplan}
          fit={fit}
        />

        {/* Ceiling-mounted utilities (sprinklers) are only drawn while their layer is on. */}
        {shownUtilities.filter((u) => utilityVisible(u.kind, layers)).map((u) => (
          <UtilityNode
            key={u.id}
            utility={u}
            floorplan={floorplan}
            fit={fit}
            selected={selected.has(u.id)}
            invalid={utilityBad.has(u.id)}
            interactive={!placing && !spacePan && !commentDraft}
            onDrag={setDrag}
          />
        ))}

        <PowerLoadTags
          all={layers.electrical}
          focusId={focusId}
          machines={liveMachines}
          utilities={liveUtilities}
          walls={liveWalls}
          fit={fit}
        />

        <CommentMarkers
          comments={comments}
          machines={liveMachines}
          utilities={shownUtilities}
          pillars={shownPillars}
          walls={shownWalls}
          fit={fit}
        />

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
                length={active.item.length}
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
        {/* Selection box while dragging on empty floor. */}
        {box && <SelectionBox rect={boxRect(box.start, box.end)} />}
      </Layer>
    </Stage>
      <MapToolbar
        zoom={zoom}
        onZoomIn={() => zoomAtCenter(zoom * 1.2)}
        onZoomOut={() => zoomAtCenter(zoom / 1.2)}
        onFit={fitToView}
      />
    </>
  )
}

/**
 * A machine being placed (the ghost) slides along the outer walls instead of going past them.
 * On a shaped floor, where it can't fit (the cut-out corner) it stays under the cursor, drawn as
 * a clash, and a click there doesn't place it.
 */
function keepGhostOnFloor(active: Active | null, floorplan: Floorplan): Active | null {
  if (active?.kind !== 'machine' || active.item.id !== GHOST_ID) return active
  const kept = keepOnFloor([active.item], { x: 0, y: 0 }, floorplan)
  if (!kept || (kept.x === 0 && kept.y === 0)) return active
  return { kind: 'machine', item: { ...active.item, x: active.item.x + kept.x, y: active.item.y + kept.y } }
}

/** How far the dragged item has moved, when other items move along with it (else null). */
function groupDelta(
  drag: DragState | null,
  machines: MachineInstance[],
  utilities: Utility[],
  pillars: Pillar[],
  walls: Wall[],
  zones: Zone[],
): Point | null {
  if (!drag?.group?.length) return null
  // A wall reports its offset from where it started; everything else its position.
  if (walls.some((w) => w.id === drag.id)) return { x: drag.x, y: drag.y }
  const from = [...machines, ...utilities, ...pillars, ...zones].find((i) => i.id === drag.id)
  return from ? { x: drag.x - from.x, y: drag.y - from.y } : null
}

/** The zone being drawn, with its size in metres. */
function ZoneGhost({ kind, a, b, fit }: { kind: ZoneKind; a: Point; b: Point; fit: number }) {
  const r = boxRect(a, b)
  const zone = { kind, colour: ZONE_KINDS[kind].colour, x: r.x + r.width / 2, y: r.y + r.depth / 2, width: r.width, depth: r.depth }
  const big = r.width >= MIN_ZONE_SIZE && r.depth >= MIN_ZONE_SIZE
  return (
    <Group listening={false} opacity={big ? 0.9 : 0.5}>
      <ZoneShape zone={zone} fit={fit} selected />
      <Group x={(r.x + r.width) * SCALE} y={(r.y + r.depth) * SCALE} scaleX={1 / fit} scaleY={1 / fit}>
        <Label x={6} y={6}>
          <Tag fill={CANVAS.selected} cornerRadius={3} />
          <Text
            text={`${(r.width / 1000).toFixed(1)} × ${(r.depth / 1000).toFixed(1)} m · ${zoneArea(r)} m²`}
            fontSize={11}
            padding={4}
            fill="black"
          />
        </Label>
      </Group>
    </Group>
  )
}

/** Faint yellow fill with a dashed yellow border. */
function SelectionBox({ rect }: { rect: Box }) {
  const px = { x: rect.x * SCALE, y: rect.y * SCALE, width: rect.width * SCALE, height: rect.depth * SCALE }
  return (
    <Group listening={false}>
      <Rect {...px} fill={CANVAS.selected} opacity={0.12} />
      <Rect {...px} stroke={CANVAS.selected} strokeWidth={1.5} strokeScaleEnabled={false} dash={[6, 4]} />
    </Group>
  )
}

/** The rectangle between two corners, mm. */
function boxRect(a: Point, b: Point): Box {
  return { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), width: Math.abs(b.x - a.x), depth: Math.abs(b.y - a.y) }
}

/**
 * Delete / Backspace removes the selection (one undo step); Esc clears it. Ignored while
 * placing (Esc cancels that instead) or typing in a field.
 */
function useSelectionKeys() {
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const t = e.target as HTMLElement
      if (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable) return
      const s = usePlanner.getState()
      if (s.commentDraft) {
        s.cancelCommentPlacement()
        return
      }
      if (s.placing || s.selectedIds.length === 0) return
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault()
        s.removeItems(s.selectedIds)
      } else if (e.key === 'Escape') {
        s.select(null)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])
}

/** Hold Space and drag to pan without changing the existing empty-floor box-select gesture. */
function useSpacePan() {
  const [active, setActive] = useState(false)

  useEffect(() => {
    function isTyping(target: EventTarget | null) {
      return target instanceof HTMLElement && !!target.closest('input, textarea, [contenteditable="true"]')
    }

    function onKeyDown(e: KeyboardEvent) {
      if (e.code !== 'Space' || isTyping(e.target)) return
      e.preventDefault()
      setActive(true)
    }

    function onKeyUp(e: KeyboardEvent) {
      if (e.code === 'Space') setActive(false)
    }

    function onBlur() {
      setActive(false)
    }

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    window.addEventListener('blur', onBlur)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('blur', onBlur)
    }
  }, [])

  return active
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
      const item: MachineInstance = {
        id: GHOST_ID,
        typeId: placing.typeId,
        rotation: placing.rotation,
        length: placing.length,
        ...pointer,
      }
      // Conveyor pieces snap onto a nearby free end; other machines onto the end of a belt.
      return { kind: 'machine', item: { ...item, ...snapConveyor(item, machines), ...snapMachineToConveyor(item, machines) } }
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
    // A zone being drawn is shown by the canvas itself (see ZoneShape below).
    if (placing.kind === 'zone') return null
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
  if (m) return { kind: 'machine', item: { ...m, x: drag.x, y: drag.y, ...(drag.rotation !== undefined && { rotation: drag.rotation }) } }
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
/** Height kept free at the bottom of the work area for the map toolbar, px. */
const TOOLBAR_SPACE = 40
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
