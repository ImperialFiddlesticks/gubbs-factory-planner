import { Circle, Group, Layer, Line, Rect, Stage, Text } from 'react-konva'
import { UtilityGlyph } from '@/components/canvas/UtilityNode'
import { SCALE } from '@/constants'
import { machineTypeFor } from '@/data/catalog'
import { floorCorners } from '@/lib/floorShapes'
import { barrierCollisionSegments } from '@/lib/truckLogistics'
import { loadingDockSpans } from '@/lib/loadingDocks'
import { supplyLines } from '@/lib/validation'
import type { Project } from '@/store'
import type { Point } from '@/types'
import { CANVAS, CANVAS_FONT } from '@/theme'

export type OverlayContent = 'machines' | 'utilities' | 'structures' | 'logistics' | 'loading'

export interface OverlayPlan {
  project: Project
  color: string
  visible: boolean
}

const PADDING = 28

function boundsOf(plans: OverlayPlan[]) {
  let minX = 0
  let minY = 0
  let maxX = 1
  let maxY = 1
  const addPoint = (point: Point, radius = 0) => {
    if (![point.x, point.y, radius].every(Number.isFinite)) return
    minX = Math.min(minX, point.x - radius)
    minY = Math.min(minY, point.y - radius)
    maxX = Math.max(maxX, point.x + radius)
    maxY = Math.max(maxY, point.y + radius)
  }
  const addRect = (x: number, y: number, width: number, depth: number, rotation = 0) => {
    if (![x, y, width, depth, rotation].every(Number.isFinite)) return
    const radians = (rotation * Math.PI) / 180
    const halfWidth = (Math.abs(Math.cos(radians)) * width + Math.abs(Math.sin(radians)) * depth) / 2
    const halfDepth = (Math.abs(Math.sin(radians)) * width + Math.abs(Math.cos(radians)) * depth) / 2
    minX = Math.min(minX, x - halfWidth)
    maxX = Math.max(maxX, x + halfWidth)
    minY = Math.min(minY, y - halfDepth)
    maxY = Math.max(maxY, y + halfDepth)
  }

  for (const { project } of plans) {
    const { floorplan } = project
    floorCorners(floorplan).forEach((point) => addPoint(point))
    ;(project.loadingBays ?? []).forEach((bay) => bay.outline.forEach((point) => addPoint(point)))
    project.walls.forEach((wall) => {
      addPoint(wall.start, wall.thickness / 2)
      addPoint(wall.end, wall.thickness / 2)
    })
    project.pillars.forEach((pillar) => addRect(pillar.x, pillar.y, pillar.width, pillar.depth))
    ;(project.zones ?? []).forEach((zone) => addRect(zone.x, zone.y, zone.width, zone.depth))
    project.machines.forEach((machine) => {
      const type = machineTypeFor(machine)
      if (type) addRect(machine.x, machine.y, type.width, type.depth, machine.rotation)
    })
    project.utilities.forEach((utility) => addPoint(utility))
    ;(project.truckTypes ?? []).forEach((type) => {
      ;(project.forkliftInstances ?? []).filter((instance) => instance.typeId === type.id).forEach((instance) => {
        if (type.widthMm && type.lengthMm) addRect(instance.x, instance.y, type.widthMm, type.lengthMm, instance.rotation)
      })
    })
    ;(project.truckRoutes ?? []).forEach((route) => route.points.forEach((point) => addPoint(point, route.usableWidthMm / 2)))
    ;(project.pedestrianRoutes ?? []).forEach((route) => route.points.forEach((point) => addPoint(point, route.usableWidthMm / 2)))
    ;(project.truckParkingSpots ?? []).forEach((spot) => spot.outline.forEach((point) => addPoint(point)))
    ;(project.truckServiceStations ?? []).forEach((station) => addPoint(station, 500))
    ;(project.safetyBarriers ?? []).forEach((barrier) => {
      barrier.points.forEach((point) => addPoint(point, barrier.thicknessMm / 2))
      barrier.keepClearOutline?.forEach((point) => addPoint(point))
    })
    ;(project.pedestrianCrossings ?? []).forEach((crossing) => addPoint(crossing, 500))
    ;(project.loadingDocks ?? []).forEach((dock) => {
      loadingDockSpans(dock, floorplan).forEach((span) => {
        addPoint(span.start)
        addPoint(span.end)
        addPoint({ x: span.start.x + span.inward.x * dock.depthMm, y: span.start.y + span.inward.y * dock.depthMm })
        addPoint({ x: span.end.x + span.inward.x * dock.depthMm, y: span.end.y + span.inward.y * dock.depthMm })
      })
    })
  }

  return { minX, minY, width: Math.max(1, maxX - minX), depth: Math.max(1, maxY - minY) }
}

export function CompareOverlay({
  plans,
  width,
  height,
  opacity,
  content,
  referenceId,
}: {
  plans: OverlayPlan[]
  width: number
  height: number
  opacity: number
  content: Record<OverlayContent, boolean>
  referenceId: string
}) {
  const visiblePlans = plans.filter((plan) => plan.visible)
  const bounds = boundsOf(visiblePlans)
  const availableWidth = Math.max(1, width - PADDING * 2)
  const availableHeight = Math.max(1, height - PADDING * 2)
  const pxPerMm = Math.min(availableWidth / bounds.width, availableHeight / bounds.depth)
  const fit = pxPerMm / SCALE
  const renderedWidth = bounds.width * pxPerMm
  const renderedHeight = bounds.depth * pxPerMm
  const layerX = PADDING + (availableWidth - renderedWidth) / 2 - bounds.minX * pxPerMm
  const layerY = PADDING + (availableHeight - renderedHeight) / 2 - bounds.minY * pxPerMm

  return (
    <Stage width={width} height={height} listening={false}>
      <Layer x={layerX} y={layerY} scaleX={fit} scaleY={fit} listening={false}>
        {visiblePlans.map(({ project, color }) => {
          const corners = floorCorners(project.floorplan)
          const points = corners.flatMap((point) => [point.x * SCALE, point.y * SCALE])
          return <Line key={`floor-fill-${project.floorplan.id}`} points={points} closed fill={color} opacity={Math.max(0.06, Math.min(0.38, opacity))} listening={false} />
        })}
        {visiblePlans.map(({ project, color }) => {
          const { floorplan } = project
          const corners = floorCorners(floorplan)
          const points = corners.flatMap((point) => [point.x * SCALE, point.y * SCALE])
          return <Group key={`floor-outline-${floorplan.id}`} listening={false}>
            <Line points={points} closed stroke={color} strokeWidth={3 / fit} strokeScaleEnabled={false} lineJoin="round" />
            <Text
              text={`${floorplan.name}${floorplan.id === referenceId ? ' | reference' : ''}`}
              x={Math.min(...corners.map((point) => point.x)) * SCALE + 5 / fit}
              y={Math.min(...corners.map((point) => point.y)) * SCALE + 5 / fit}
              fontFamily={CANVAS_FONT}
              fontSize={12 / fit}
              fontStyle="bold"
              fill={color}
              stroke={CANVAS.background}
              strokeWidth={3 / fit}
              listening={false}
            />
          </Group>
        })}
        {visiblePlans.map(({ project, color }) => {
          const { floorplan } = project
          const polygon = (points: Point[]) => points.flatMap((point) => [point.x * SCALE, point.y * SCALE])
          return (
            <Group key={floorplan.id} listening={false}>
              {content.utilities && (['power', 'water'] as const).flatMap((kind) => supplyLines(project.machines, project.utilities, kind, project.walls, project.truckServiceStations ?? [], project.truckTypes ?? []).map((line) => <Line key={`supply-${kind}-${line.machineId}`} points={polygon(line.path)} stroke={color} strokeWidth={2 / fit} opacity={0.75} lineCap="round" lineJoin="round" dash={[5 / fit, 3 / fit]} />))}

              {content.structures && <>
                {(project.zones ?? []).map((zone) => <Rect key={`zone-${zone.id}`} x={(zone.x - zone.width / 2) * SCALE} y={(zone.y - zone.depth / 2) * SCALE} width={zone.width * SCALE} height={zone.depth * SCALE} fill={color} opacity={0.08} stroke={color} strokeWidth={1.5 / fit} dash={[6 / fit, 4 / fit]} />)}
                {project.walls.map((wall) => <Line key={`wall-${wall.id}`} points={[wall.start.x * SCALE, wall.start.y * SCALE, wall.end.x * SCALE, wall.end.y * SCALE]} stroke={color} strokeWidth={Math.max(wall.thickness * SCALE, 2 / fit)} opacity={0.8} lineCap="square" />)}
                {project.pillars.map((pillar) => <Rect key={`pillar-${pillar.id}`} x={(pillar.x - pillar.width / 2) * SCALE} y={(pillar.y - pillar.depth / 2) * SCALE} width={pillar.width * SCALE} height={pillar.depth * SCALE} fill={color} opacity={0.4} stroke={color} strokeWidth={2 / fit} />)}
              </>}

              {content.machines && project.machines.map((machine) => {
                const type = machineTypeFor(machine)
                if (!type) return null
                return <Group key={`machine-${machine.id}`} x={machine.x * SCALE} y={machine.y * SCALE} rotation={machine.rotation}>
                  <Rect x={-type.width * SCALE / 2} y={-type.depth * SCALE / 2} width={type.width * SCALE} height={type.depth * SCALE} fill={color} opacity={0.2} stroke={color} strokeWidth={2 / fit} />
                  <Text text={machine.name ?? type.shortName} x={-type.width * SCALE / 2} y={-5 / fit} width={type.width * SCALE} align="center" fontFamily={CANVAS_FONT} fontSize={9 / fit} fill={color} listening={false} />
                </Group>
              })}

              {content.utilities && project.utilities.map((utility) => <Group key={`utility-${utility.id}`} x={utility.x * SCALE} y={utility.y * SCALE}>
                <UtilityGlyph utility={utility} floorplan={floorplan} fit={fit} />
                <Text text={utility.kind} x={14 / fit} y={-5 / fit} fontFamily={CANVAS_FONT} fontSize={9 / fit} fill={color} stroke={CANVAS.background} strokeWidth={2 / fit} listening={false} />
              </Group>)}

              {content.loading && <>
                {(project.loadingBays ?? []).map((bay) => <Group key={`bay-${bay.id}`}>
                  <Line points={polygon(bay.outline)} closed fill={color} opacity={0.13} stroke={color} strokeWidth={2 / fit} dash={[8 / fit, 4 / fit]} />
                  {bay.outline[0] && <Text text={bay.name} x={bay.outline[0].x * SCALE + 4 / fit} y={bay.outline[0].y * SCALE + 4 / fit} fontFamily={CANVAS_FONT} fontSize={10 / fit} fill={color} listening={false} />}
                </Group>)}
                {(project.loadingDocks ?? []).map((dock) => loadingDockSpans(dock, floorplan).map((span, index) => {
                  const outerStart = { x: span.start.x + span.inward.x * dock.depthMm, y: span.start.y + span.inward.y * dock.depthMm }
                  const outerEnd = { x: span.end.x + span.inward.x * dock.depthMm, y: span.end.y + span.inward.y * dock.depthMm }
                  return <Group key={`dock-${dock.id}-${index}`}>
                    <Line points={polygon([span.start, span.end, outerEnd, outerStart])} closed fill={color} opacity={0.22} stroke={color} strokeWidth={2 / fit} />
                    <Text text={dock.name} x={span.midpoint.x * SCALE + 4 / fit} y={span.midpoint.y * SCALE + 4 / fit} fontFamily={CANVAS_FONT} fontSize={9 / fit} fill={color} listening={false} />
                  </Group>
                }))}
              </>}

              {content.logistics && <>
                {(project.truckRoutes ?? []).map((route) => <Group key={`truck-route-${route.id}`}>
                  <Line points={polygon(route.points)} stroke={color} strokeWidth={Math.max(route.usableWidthMm * SCALE, 2 / fit)} opacity={0.2} lineCap="round" lineJoin="round" />
                  <Line points={polygon(route.points)} stroke={color} strokeWidth={1.5 / fit} dash={[8 / fit, 5 / fit]} lineCap="round" lineJoin="round" />
                  {route.points[0] && <Text text={route.name} x={route.points[0].x * SCALE + 4 / fit} y={route.points[0].y * SCALE + 4 / fit} fontFamily={CANVAS_FONT} fontSize={9 / fit} fill={color} listening={false} />}
                </Group>)}
                {(project.pedestrianRoutes ?? []).map((route) => <Group key={`pedestrian-route-${route.id}`}>
                  <Line points={polygon(route.points)} stroke={color} strokeWidth={Math.max(route.usableWidthMm * SCALE, 2 / fit)} opacity={0.1} lineCap="round" lineJoin="round" />
                  <Line points={polygon(route.points)} stroke={color} strokeWidth={1.5 / fit} dash={[3 / fit, 4 / fit]} lineCap="round" lineJoin="round" />
                </Group>)}
                {(project.safetyBarriers ?? []).map((barrier) => <Group key={`barrier-${barrier.id}`}>
                  {barrier.keepClearOutline && <Line points={polygon(barrier.keepClearOutline)} closed fill={color} opacity={0.08} stroke={color} strokeWidth={2 / fit} dash={[8 / fit, 4 / fit]} />}
                  {barrierCollisionSegments(barrier).map((segment, index) => <Line key={index} points={[segment.a.x * SCALE, segment.a.y * SCALE, segment.b.x * SCALE, segment.b.y * SCALE]} stroke={color} strokeWidth={Math.max(barrier.thicknessMm * SCALE, 2 / fit)} opacity={0.75} dash={[8 / fit, 4 / fit]} lineCap="square" />)}
                </Group>)}
                {(project.truckParkingSpots ?? []).map((spot) => <Group key={`parking-${spot.id}`}>
                  <Line points={polygon(spot.outline)} closed fill={color} opacity={0.12} stroke={color} strokeWidth={2 / fit} dash={[6 / fit, 4 / fit]} />
                  {spot.outline[0] && <Text text={spot.name} x={spot.outline[0].x * SCALE + 4 / fit} y={spot.outline[0].y * SCALE + 4 / fit} fontFamily={CANVAS_FONT} fontSize={9 / fit} fill={color} listening={false} />}
                </Group>)}
                {(project.truckTypes ?? []).flatMap((type) => (project.forkliftInstances ?? []).filter((instance) => instance.typeId === type.id).map((instance) => {
                  if (!type.widthMm || !type.lengthMm) return null
                  return <Group key={`forklift-${instance.id}`} x={instance.x * SCALE} y={instance.y * SCALE} rotation={instance.rotation}>
                    <Rect x={-type.widthMm * SCALE / 2} y={-type.lengthMm * SCALE / 2} width={type.widthMm * SCALE} height={type.lengthMm * SCALE} cornerRadius={Math.min(type.widthMm, type.lengthMm) * SCALE * 0.12} fill={color} opacity={0.3} stroke={color} strokeWidth={2 / fit} />
                    <Text text={type.name} x={-type.widthMm * SCALE / 2} y={-4 / fit} width={type.widthMm * SCALE} align="center" fontFamily={CANVAS_FONT} fontSize={8 / fit} fill={color} listening={false} />
                  </Group>
                }))}
                {(project.truckServiceStations ?? []).map((station) => <Group key={`station-${station.id}`} x={station.x * SCALE} y={station.y * SCALE}>
                  <Circle radius={10 / fit} fill={color} opacity={0.25} stroke={color} strokeWidth={2 / fit} />
                  <Text text={station.kind === 'charging' ? 'E' : 'W'} x={-6 / fit} y={-6 / fit} fontFamily={CANVAS_FONT} fontSize={10 / fit} fill={color} listening={false} />
                  <Text text={station.name} x={13 / fit} y={-5 / fit} fontFamily={CANVAS_FONT} fontSize={9 / fit} fill={color} stroke={CANVAS.background} strokeWidth={2 / fit} listening={false} />
                </Group>)}
                {(project.pedestrianCrossings ?? []).map((crossing) => <Group key={`crossing-${crossing.id}`} x={crossing.x * SCALE} y={crossing.y * SCALE}>
                  <Circle radius={9 / fit} fill={color} opacity={0.5} stroke={color} strokeWidth={2 / fit} />
                  <Text text="+" x={-5 / fit} y={-8 / fit} fontFamily={CANVAS_FONT} fontSize={15 / fit} fill={color} listening={false} />
                </Group>)}
              </>}
            </Group>
          )
        })}
      </Layer>
    </Stage>
  )
}
