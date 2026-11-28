import { useRef } from 'react'
import { Arrow, Circle, Group, Line, Rect, Text } from 'react-konva'
import { clickItem, dragGroup, GHOST_ID, pressItem, uprightTextRoom, type DragState } from '@/components/canvas/shared'
import { SCALE } from '@/constants'
import { usePlanner } from '@/store'
import { CANVAS, CANVAS_FONT } from '@/theme'
import { UtilityIcon } from '@/components/canvas/UtilityNode'
import { barrierCollisionSegments } from '@/lib/truckLogistics'
import type { ForkliftInstance, PedestrianCrossing, PedestrianRoute, Point, SafetyBarrier, TruckParkingSpot, TruckRoute, TruckServiceStation, TruckType } from '@/types'

/** Access roads from outside: asphalt grey so they read as outdoor roads. */
export const ACCESS_ROAD_COLOUR = '#57534e'

export function TruckLogisticsNodes({
  parkingSpots,
  forkliftInstances,
  truckTypes,
  invalidForkliftIds,
  onDrag,
  stations,
  connectedStationUtilities,
  truckRoutes,
  pedestrianRoutes,
  crossings,
  barriers,
  selectedIds,
  fit,
  interactive,
}: {
  parkingSpots: TruckParkingSpot[]
  forkliftInstances: ForkliftInstance[]
  truckTypes: TruckType[]
  invalidForkliftIds: Set<string>
  onDrag: (drag: DragState | null) => void
  stations: TruckServiceStation[]
  connectedStationUtilities: Set<string>
  truckRoutes: TruckRoute[]
  pedestrianRoutes: PedestrianRoute[]
  crossings: PedestrianCrossing[]
  barriers: SafetyBarrier[]
  selectedIds: string[]
  fit: number
  interactive: boolean
}) {
  return (
    <>
      {truckRoutes.map((route) => <PathNode key={route.id} id={route.id} name="truck-route" label={route.name} points={route.points} color={route.access ? ACCESS_ROAD_COLOUR : '#e87924'} width={route.usableWidthMm} direction={route.direction} fit={fit} selected={selectedIds.includes(route.id)} interactive={interactive} />)}
      {forkliftInstances.filter((instance) => instance.id !== GHOST_ID).map((instance) => {
        const type = truckTypes.find((item) => item.id === instance.typeId)
        return type && <ForkliftInstanceNode key={instance.id} instance={instance} type={type} fit={fit} selected={selectedIds.includes(instance.id)} invalid={invalidForkliftIds.has(instance.id)} interactive={interactive} onDrag={onDrag} />
      })}
      {pedestrianRoutes.map((route) => <PathNode key={route.id} id={route.id} name="pedestrian-route" label={route.name} points={route.points} color="#8b5cf6" width={route.usableWidthMm} fit={fit} selected={selectedIds.includes(route.id)} interactive={interactive} />)}
      {barriers.map((barrier) => <Group key={barrier.id}>
        {barrier.keepClearOutline && <Line points={barrier.keepClearOutline.flatMap((point) => [point.x * SCALE, point.y * SCALE])} closed fill="#dc262622" stroke="#dc2626" strokeWidth={2 / fit} dash={[8 / fit, 5 / fit]} listening={false} />}
        <PathNode id={barrier.id} name="safety-barrier" label={barrier.name} points={barrier.points} color="#374151" width={barrier.thicknessMm} openings={barrier.openings} fit={fit} selected={selectedIds.includes(barrier.id)} interactive={interactive} />
      </Group>)}
      {parkingSpots.map((spot) => <ParkingNode key={spot.id} spot={spot} fit={fit} selected={selectedIds.includes(spot.id)} interactive={interactive} />)}
      {stations.map((station) => <StationNode key={station.id} station={station} connectedUtilities={connectedStationUtilities} selected={selectedIds.includes(station.id)} fit={fit} interactive={interactive} />)}
      {crossings.map((crossing) => <CrossingNode key={crossing.id} crossing={crossing} selected={selectedIds.includes(crossing.id)} fit={fit} interactive={interactive} />)}
    </>
  )
}

export function ForkliftGlyph({ type, rotation, fit, selected = false, invalid = false }: { type: TruckType; rotation: number; fit: number; selected?: boolean; invalid?: boolean }) {
  if (type.widthMm === null || type.widthMm <= 0 || type.lengthMm === null || type.lengthMm <= 0) return null
  const width = type.widthMm * SCALE
  const length = type.lengthMm * SCALE
  const stroke = invalid ? CANVAS.invalid : selected ? CANVAS.selected : '#1d4ed8'
  return <Group rotation={rotation} listening={false}>
    <Rect x={-width / 2} y={-length / 2} width={width} height={length} cornerRadius={Math.min(width, length) * 0.12} fill={invalid ? '#ef444433' : '#3b82f633'} stroke={stroke} strokeWidth={2 / fit} />
    <Rect x={-width * 0.28} y={-length * 0.34} width={width * 0.56} height={length * 0.38} cornerRadius={Math.min(width, length) * 0.04} fill={invalid ? '#ef4444' : '#2563eb'} opacity={0.9} />
    <Line points={[-width * 0.3, -length * 0.45, -width * 0.3, -length * 0.17]} stroke={stroke} strokeWidth={Math.max(3 / fit, width * 0.09)} lineCap="round" />
    <Line points={[width * 0.3, -length * 0.45, width * 0.3, -length * 0.17]} stroke={stroke} strokeWidth={Math.max(3 / fit, width * 0.09)} lineCap="round" />
    {/* The name stays level (see below), so only the body turns here. */}
  </Group>
}

/** A forklift's body with its name kept level, whichever way it faces. */
export function ForkliftGlyphWithLabel({ type, rotation, fit, selected = false, invalid = false }: { type: TruckType; rotation: number; fit: number; selected?: boolean; invalid?: boolean }) {
  if (type.widthMm === null || type.widthMm <= 0 || type.lengthMm === null || type.lengthMm <= 0) return null
  const width = type.widthMm * SCALE
  const length = type.lengthMm * SCALE
  const fontSize = Math.min(10 / fit, Math.max(6.5, width * 0.13))
  const room = uprightTextRoom(width, length, rotation, fontSize * 1.3)
  // At rotation 0 the name sits on the lower part of the body (below the mast); turned, it
  // moves with that spot but stays level.
  const a = (rotation * Math.PI) / 180
  const cx = -Math.sin(a) * length * 0.2
  const cy = Math.cos(a) * length * 0.2
  return <>
    <ForkliftGlyph type={type} rotation={rotation} fit={fit} selected={selected} invalid={invalid} />
    <Text fontFamily={CANVAS_FONT} text={type.name} x={cx - room.width / 2} y={cy - fontSize / 2} width={room.width} align="center" wrap="none" ellipsis fontSize={fontSize} fill="#1e3a8a" listening={false} />
  </>
}

function ForkliftInstanceNode({ instance, type, fit, selected, invalid, interactive, onDrag }: { instance: ForkliftInstance; type: TruckType; fit: number; selected: boolean; invalid: boolean; interactive: boolean; onDrag: (drag: DragState | null) => void }) {
  const moveItems = usePlanner((s) => s.moveItems)
  const start = useRef<Point>({ x: instance.x, y: instance.y })
  const group = useRef<string[]>([])
  return <Group
    id={instance.id}
    name="forklift-instance"
    x={instance.x * SCALE}
    y={instance.y * SCALE}
    draggable={interactive}
    onMouseDown={(event) => pressItem(instance.id, event)}
    onTouchStart={(event) => pressItem(instance.id, event)}
    onClick={(event) => clickItem(instance.id, event)}
    onTap={(event) => clickItem(instance.id, event)}
    onDragStart={(event) => {
      start.current = { x: event.target.x() / SCALE, y: event.target.y() / SCALE }
      group.current = dragGroup(instance.id)
      onDrag({ id: instance.id, x: start.current.x, y: start.current.y, group: group.current })
    }}
    onDragMove={(event) => onDrag({ id: instance.id, x: event.target.x() / SCALE, y: event.target.y() / SCALE, group: group.current })}
    onDragEnd={(event) => {
      const x = event.target.x() / SCALE
      const y = event.target.y() / SCALE
      moveItems([instance.id, ...group.current], x - start.current.x, y - start.current.y)
      group.current = []
      onDrag(null)
      event.target.position({ x: instance.x * SCALE, y: instance.y * SCALE })
    }}
  >
    <ForkliftGlyphWithLabel type={type} rotation={instance.rotation} fit={fit} selected={selected} invalid={invalid} />
  </Group>
}

function PathNode({ id, name, label, points, color, width, direction, openings, fit, selected, interactive }: {
  id: string
  name: string
  label: string
  points: Point[]
  color: string
  width: number
  direction?: TruckRoute['direction']
  openings?: SafetyBarrier['openings']
  fit: number
  selected: boolean
  interactive: boolean
}) {
  const moveItems = usePlanner((s) => s.moveItems)
  const start = useRef<Point>({ x: 0, y: 0 })
  const group = useRef<string[]>([])
  const openingSegments = openings?.length ? barrierCollisionSegments({ points, openings }) : null
  return (
    <Group
      id={id}
      name={name}
      draggable={interactive}
      onMouseDown={(event) => pressItem(id, event)}
      onTouchStart={(event) => pressItem(id, event)}
      onClick={(event) => clickItem(id, event)}
      onTap={(event) => clickItem(id, event)}
      onDragStart={(event) => { start.current = { x: event.target.x() / SCALE, y: event.target.y() / SCALE }; group.current = dragGroup(id) }}
      onDragEnd={(event) => {
        const dx = event.target.x() / SCALE - start.current.x
        const dy = event.target.y() / SCALE - start.current.y
        moveItems([id, ...group.current], dx, dy)
        group.current = []
        event.target.position({ x: 0, y: 0 })
      }}
    >
      {openingSegments ? <>
        {openingSegments.map((segment, index) => <Line key={index} points={[segment.a.x * SCALE, segment.a.y * SCALE, segment.b.x * SCALE, segment.b.y * SCALE]} stroke={selected ? CANVAS.selected : color} strokeWidth={Math.max(width * SCALE, 3 / fit)} opacity={0.78} lineCap="round" dash={name === 'safety-barrier' ? [10 / fit, 5 / fit] : undefined} listening={false} />)}
        <Line points={points.flatMap((point) => [point.x * SCALE, point.y * SCALE])} stroke="transparent" strokeWidth={Math.max(width * SCALE, 3 / fit)} hitStrokeWidth={Math.max(width * SCALE, 16 / fit)} listening={interactive} />
      </> : <Line
        points={points.flatMap((point) => [point.x * SCALE, point.y * SCALE])}
        stroke={selected ? CANVAS.selected : color}
        strokeWidth={Math.max(width * SCALE, 3 / fit)}
        opacity={0.78}
        lineCap="round"
        lineJoin="round"
        dash={name === 'safety-barrier' ? [10 / fit, 5 / fit] : undefined}
        hitStrokeWidth={Math.max(width * SCALE, 16 / fit)}
        listening={interactive}
      />}
      {(name === 'truck-route' || name === 'pedestrian-route') && <Line
        points={points.flatMap((point) => [point.x * SCALE, point.y * SCALE])}
        stroke="white"
        strokeWidth={1.5 / fit}
        dash={[8 / fit, 8 / fit]}
        opacity={0.8}
        lineCap="round"
        lineJoin="round"
        listening={false}
      />}
      {name === 'truck-route' && direction === 'one-way' && points.length >= 2 && (
        <Arrow points={[points[0].x * SCALE, points[0].y * SCALE, points[1].x * SCALE, points[1].y * SCALE]} stroke={color} fill={color} strokeWidth={2 / fit} pointerLength={8 / fit} pointerWidth={8 / fit} listening={false} />
      )}
      {points[0] && <Text fontFamily={CANVAS_FONT} text={label} x={points[0].x * SCALE + 5 / fit} y={points[0].y * SCALE + 5 / fit} fontSize={11 / fit} fill={color} listening={false} />}
    </Group>
  )
}

function ParkingNode({ spot, fit, selected, interactive }: { spot: TruckParkingSpot; fit: number; selected: boolean; interactive: boolean }) {
  const moveItems = usePlanner((s) => s.moveItems)
  const start = useRef<Point>({ x: 0, y: 0 })
  const group = useRef<string[]>([])
  const x = Math.min(...spot.outline.map((point) => point.x))
  const y = Math.min(...spot.outline.map((point) => point.y))
  const width = Math.max(...spot.outline.map((point) => point.x)) - x
  const depth = Math.max(...spot.outline.map((point) => point.y)) - y
  const stroke = selected ? CANVAS.selected : '#ca8a04'
  return (
    <Group
      id={spot.id}
      name="truck-parking"
      draggable={interactive}
      onMouseDown={(event) => pressItem(spot.id, event)}
      onTouchStart={(event) => pressItem(spot.id, event)}
      onClick={(event) => clickItem(spot.id, event)}
      onTap={(event) => clickItem(spot.id, event)}
      onDragStart={(event) => { start.current = { x: event.target.x() / SCALE, y: event.target.y() / SCALE }; group.current = dragGroup(spot.id) }}
      onDragEnd={(event) => {
        moveItems([spot.id, ...group.current], event.target.x() / SCALE - start.current.x, event.target.y() / SCALE - start.current.y)
        group.current = []
        event.target.position({ x: 0, y: 0 })
      }}
    >
      <Line points={spot.outline.flatMap((point) => [point.x * SCALE, point.y * SCALE])} closed fill="#facc1522" stroke={stroke} strokeWidth={selected ? 3 / fit : 2 / fit} dash={[8 / fit, 4 / fit]} />
      {width >= depth && <Line points={[(x + width / 3) * SCALE, y * SCALE, (x + width / 3) * SCALE, (y + depth) * SCALE, (x + width * 2 / 3) * SCALE, y * SCALE, (x + width * 2 / 3) * SCALE, (y + depth) * SCALE]} stroke={stroke} strokeWidth={1 / fit} dash={[5 / fit, 5 / fit]} listening={false} />}
      {depth > width && <Line points={[x * SCALE, (y + depth / 3) * SCALE, (x + width) * SCALE, (y + depth / 3) * SCALE, x * SCALE, (y + depth * 2 / 3) * SCALE, (x + width) * SCALE, (y + depth * 2 / 3) * SCALE]} stroke={stroke} strokeWidth={1 / fit} dash={[5 / fit, 5 / fit]} listening={false} />}
      {spot.outline[0] && <Text fontFamily={CANVAS_FONT} text={spot.name} x={spot.outline[0].x * SCALE + 5 / fit} y={spot.outline[0].y * SCALE + 5 / fit} fontSize={11 / fit} fill={selected ? CANVAS.selected : '#854d0e'} listening={false} />}
      {spot.outline.length >= 3 && <Text fontFamily={CANVAS_FONT}
        text={`${(width / 1000).toFixed(1)} × ${(depth / 1000).toFixed(1)} m`}
        x={x * SCALE}
        y={y * SCALE}
        width={width * SCALE}
        height={depth * SCALE}
        align="center"
        verticalAlign="middle"
        fontSize={11 / fit}
        fill="#854d0e"
        listening={false}
      />}
    </Group>
  )
}

function StationNode({ station, connectedUtilities, selected, fit, interactive }: { station: TruckServiceStation; connectedUtilities: Set<string>; selected: boolean; fit: number; interactive: boolean }) {
  const moveItems = usePlanner((s) => s.moveItems)
  const start = useRef<Point>({ x: station.x, y: station.y })
  const group = useRef<string[]>([])
  const needsPower = station.kind === 'charging' || station.requiresPower === true
  const utilityKinds = station.kind === 'charging' ? ['power'] as const : needsPower ? ['water', 'power'] as const : ['water'] as const
  return (
    <Group
      id={station.id}
      name="truck-service-station"
      x={station.x * SCALE}
      y={station.y * SCALE}
      draggable={interactive}
      onMouseDown={(event) => pressItem(station.id, event)}
      onTouchStart={(event) => pressItem(station.id, event)}
      onClick={(event) => clickItem(station.id, event)}
      onTap={(event) => clickItem(station.id, event)}
      onDragStart={(event) => { start.current = { x: event.target.x() / SCALE, y: event.target.y() / SCALE }; group.current = dragGroup(station.id) }}
      onDragEnd={(event) => {
        moveItems([station.id, ...group.current], event.target.x() / SCALE - start.current.x, event.target.y() / SCALE - start.current.y)
        group.current = []
        event.target.position({ x: station.x * SCALE, y: station.y * SCALE })
      }}
    >
      <Circle radius={11 / fit} fill={station.kind === 'charging' ? '#2563eb' : '#0f766e'} stroke={selected ? CANVAS.selected : 'white'} strokeWidth={2 / fit} />
      <Text fontFamily={CANVAS_FONT} text={station.kind === 'charging' ? '⚡' : 'W'} x={-6 / fit} y={-7 / fit} fontSize={12 / fit} fill="white" listening={false} />
      {utilityKinds.map((kind, index) => <Group key={kind} x={(16 + index * 19) / fit} listening={false}>
        <UtilityIcon kind={kind} radius={8} fit={fit} ring={connectedUtilities.has(`${station.id}:${kind}`) ? 'white' : CANVAS.invalid} ringWidth={2} />
      </Group>)}
      <Text fontFamily={CANVAS_FONT} text={station.name} x={(utilityKinds.length ? 16 + utilityKinds.length * 19 : 14) / fit} y={-6 / fit} fontSize={11 / fit} fill="#1f2937" listening={false} />
    </Group>
  )
}

function CrossingNode({ crossing, selected, fit, interactive }: { crossing: PedestrianCrossing; selected: boolean; fit: number; interactive: boolean }) {
  const moveItems = usePlanner((s) => s.moveItems)
  const start = useRef<Point>({ x: crossing.x, y: crossing.y })
  const group = useRef<string[]>([])
  return (
    <Group
      id={crossing.id}
      name="pedestrian-crossing"
      x={crossing.x * SCALE}
      y={crossing.y * SCALE}
      draggable={interactive}
      onMouseDown={(event) => pressItem(crossing.id, event)}
      onTouchStart={(event) => pressItem(crossing.id, event)}
      onClick={(event) => clickItem(crossing.id, event)}
      onTap={(event) => clickItem(crossing.id, event)}
      onDragStart={(event) => { start.current = { x: event.target.x() / SCALE, y: event.target.y() / SCALE }; group.current = dragGroup(crossing.id) }}
      onDragEnd={(event) => {
        moveItems([crossing.id, ...group.current], event.target.x() / SCALE - start.current.x, event.target.y() / SCALE - start.current.y)
        group.current = []
        event.target.position({ x: crossing.x * SCALE, y: crossing.y * SCALE })
      }}
    >
      <Circle radius={10 / fit} fill="#f8fafc" stroke={selected ? CANVAS.selected : '#dc2626'} strokeWidth={3 / fit} />
      <Line points={[-6 / fit, -4 / fit, 6 / fit, -4 / fit]} stroke="#dc2626" strokeWidth={2 / fit} />
      <Line points={[-6 / fit, 0, 6 / fit, 0]} stroke="#dc2626" strokeWidth={2 / fit} />
      <Line points={[-6 / fit, 4 / fit, 6 / fit, 4 / fit]} stroke="#dc2626" strokeWidth={2 / fit} />
    </Group>
  )
}
