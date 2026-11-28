import { useRef } from 'react'
import { Arrow, Group, Line } from 'react-konva'
import { clickItem, dragGroup, pressItem, setCursor, type DragState } from '@/components/canvas/shared'
import { SCALE } from '@/constants'
import { loadingDockPointAt, loadingDockSpans, nearestLoadingDockPosition } from '@/lib/loadingDocks'
import { usePlanner } from '@/store'
import { CANVAS, COLORS } from '@/theme'
import type { Floorplan, LoadingDock, Point } from '@/types'

export function LoadingDockNode({
  dock,
  floorplan,
  fit,
  selected,
  invalid,
  interactive,
  onDrag,
}: {
  dock: LoadingDock
  floorplan: Floorplan
  fit: number
  selected: boolean
  invalid: boolean
  interactive: boolean
  onDrag: (drag: DragState | null) => void
}) {
  const moveItems = usePlanner((s) => s.moveItems)
  const moveLoadingDock = usePlanner((s) => s.moveLoadingDock)
  const groupIds = useRef<string[]>([])
  const center = loadingDockPointAt(floorplan, dock.boundaryOffsetMm)
  if (!center) return null

  const group = () => (groupIds.current.length ? groupIds.current : undefined)

  function snap(node: { x: () => number; y: () => number; position: (p: { x: number; y: number }) => void }): Point {
    const x = node.x() / SCALE
    const y = node.y() / SCALE
    const snapped = nearestPosition(x, y, floorplan)
    if (snapped) node.position({ x: snapped.x * SCALE, y: snapped.y * SCALE })
    return snapped ?? { x, y }
  }

  return (
    <Group
      id={dock.id}
      name="loading-dock"
      x={center.x * SCALE}
      y={center.y * SCALE}
      draggable={interactive}
      listening={interactive}
      onMouseDown={(e) => pressItem(dock.id, e)}
      onTouchStart={(e) => pressItem(dock.id, e)}
      onClick={(e) => clickItem(dock.id, e)}
      onTap={(e) => clickItem(dock.id, e)}
      onDragStart={(e) => {
        groupIds.current = dragGroup(dock.id)
        const p = snap(e.target)
        onDrag({ id: dock.id, ...p, group: group() })
      }}
      onDragMove={(e) => onDrag({ id: dock.id, ...snap(e.target), group: group() })}
      onDragEnd={(e) => {
        const p = snap(e.target)
        if (groupIds.current.length) moveItems([dock.id, ...groupIds.current], p.x - center.x, p.y - center.y)
        else moveLoadingDock(dock.id, p.x, p.y)
        groupIds.current = []
        onDrag(null)
      }}
      onMouseEnter={(e) => setCursor(e, 'move')}
      onMouseLeave={(e) => setCursor(e, '')}
    >
      <LoadingDockGlyph
        dock={dock}
        floorplan={floorplan}
        fit={fit}
        selected={selected}
        invalid={invalid}
        center={center}
      />
    </Group>
  )
}

export function LoadingDockGlyph({
  dock,
  floorplan,
  fit,
  center,
  selected = false,
  invalid = false,
}: {
  dock: Pick<LoadingDock, 'widthMm' | 'heightMm' | 'depthMm' | 'boundaryOffsetMm' | 'flowDirection'>
  floorplan: Floorplan
  fit: number
  center?: Point
  selected?: boolean
  invalid?: boolean
}) {
  const anchor = center ?? loadingDockPointAt(floorplan, dock.boundaryOffsetMm)
  if (!anchor) return null
  const colour = invalid ? CANVAS.invalid : selected ? CANVAS.selected : COLORS.green
  const spans = loadingDockSpans(dock, floorplan)

  return (
    <Group>
      {spans.map((span, index) => {
        const points = [
          (span.start.x - anchor.x) * SCALE,
          (span.start.y - anchor.y) * SCALE,
          (span.end.x - anchor.x) * SCALE,
          (span.end.y - anchor.y) * SCALE,
        ]
        const mx = (span.midpoint.x - anchor.x) * SCALE
        const my = (span.midpoint.y - anchor.y) * SCALE
        const nx = span.inward.x
        const ny = span.inward.y
        const ax = -ny
        const ay = nx
        const arrow = (direction: 1 | -1, side: number) => (
          <Arrow
            key={`flow-${index}-${direction}-${side}`}
            points={[
              mx + ax * side - nx * direction * (8 / fit),
              my + ay * side - ny * direction * (8 / fit),
              mx + ax * side + nx * direction * (8 / fit),
              my + ay * side + ny * direction * (8 / fit),
            ]}
            pointerLength={4 / fit}
            pointerWidth={4 / fit}
            stroke={colour}
            fill={colour}
            strokeWidth={1.5 / fit}
            listening={false}
          />
        )

        const outerStart = { x: span.start.x - nx * dock.depthMm, y: span.start.y - ny * dock.depthMm }
        const outerEnd = { x: span.end.x - nx * dock.depthMm, y: span.end.y - ny * dock.depthMm }
        const innerStart = { x: span.start.x + nx * dock.depthMm, y: span.start.y + ny * dock.depthMm }
        const innerEnd = { x: span.end.x + nx * dock.depthMm, y: span.end.y + ny * dock.depthMm }
        const depthPoints = [outerStart, outerEnd, innerEnd, innerStart].map((point) => [(point.x - anchor.x) * SCALE, (point.y - anchor.y) * SCALE]).flat()

        return (
          <Group key={index}>
            <Line
              points={depthPoints}
              closed
              stroke={colour}
              strokeWidth={selected ? 2 : 1.5}
              strokeScaleEnabled={false}
              dash={[4 / fit, 3 / fit]}
              opacity={0.8}
              listening={false}
            />
            <Line
              points={points}
              stroke={CANVAS.floor}
              strokeWidth={10 / fit}
              strokeScaleEnabled={false}
              lineCap="butt"
              hitStrokeWidth={14 / fit}
            />
            <Line
              points={points}
              stroke={colour}
              strokeWidth={3 / fit}
              strokeScaleEnabled={false}
              lineCap="butt"
              dash={[4 / fit, 3 / fit]}
            />
            {dock.flowDirection === 'inbound' && arrow(1, 0)}
            {dock.flowDirection === 'outbound' && arrow(-1, 0)}
            {dock.flowDirection === 'two-way' && <>{arrow(1, -5 / fit)}{arrow(-1, 5 / fit)}</>}
          </Group>
        )
      })}
    </Group>
  )
}

function nearestPosition(x: number, y: number, floorplan: Floorplan): Point | null {
  return nearestLoadingDockPosition(x, y, floorplan)?.point ?? null
}
