import { useRef, useState } from 'react'
import { Circle, Group, Line, Text } from 'react-konva'
import { clickItem, dragGroup, pressItem, setCursor, type DragState } from '@/components/canvas/shared'
import { SCALE } from '@/constants'
import { MIN_LOADING_BAY_SIZE_MM, loadingBayBounds, loadingBayCentroid, loadingBayConnection, loadingBayIssue } from '@/lib/loadingBays'
import { usePlanner } from '@/store'
import { CANVAS, COLORS, CANVAS_FONT } from '@/theme'
import type { Floorplan, LoadingBay, LoadingDock, Point } from '@/types'

export function LoadingBayNode({
  bay,
  dock,
  floorplan,
  selected,
  invalid,
  interactive,
  fit,
  onDrag,
}: {
  bay: LoadingBay
  dock: LoadingDock | undefined
  floorplan: Floorplan
  selected: boolean
  invalid: boolean
  interactive: boolean
  fit: number
  onDrag: (drag: DragState | null) => void
}) {
  const moveItems = usePlanner((s) => s.moveItems)
  const updateLoadingBay = usePlanner((s) => s.updateLoadingBay)
  const docks = usePlanner((s) => s.loadingDocks)
  const bays = usePlanner((s) => s.loadingBays)
  const [outlinePreview, setOutlinePreview] = useState<Point[] | null>(null)
  const groupIds = useRef<string[]>([])
  const start = useRef({ x: 0, y: 0 })
  const [resizeBase, setResizeBase] = useState<Point[] | null>(null)
  const center = loadingBayCentroid(bay)
  const shownOutline = outlinePreview ?? bay.outline
  const shownBay = { ...bay, outline: shownOutline }
  const bounds = loadingBayBounds({ outline: shownOutline })
  const rectangular = bounds !== null && shownOutline.length === 4 && shownOutline.every((point) =>
    (point.x === bounds.x || point.x === bounds.x + bounds.width) &&
    (point.y === bounds.y || point.y === bounds.y + bounds.depth),
  )
  const connection = dock ? loadingBayConnection(shownBay, dock, floorplan) : null
  const previewIssue = outlinePreview ? loadingBayIssue(shownBay, floorplan, docks, bays) : null
  const invalidNow = invalid || Boolean(previewIssue)
  const colour = invalidNow ? CANVAS.invalid : selected ? CANVAS.selected : COLORS.green
  const group = () => groupIds.current.length ? groupIds.current : undefined
  const toMm = (node: { x: () => number; y: () => number }) => ({ x: node.x() / SCALE, y: node.y() / SCALE })

  function resizeOutline(handle: string, point: Point, baseOutline: Point[]): Point[] {
    const baseBounds = loadingBayBounds({ outline: baseOutline })
    if (!baseBounds) return baseOutline
    let left = baseBounds.x
    let right = baseBounds.x + baseBounds.width
    let top = baseBounds.y
    let bottom = baseBounds.y + baseBounds.depth
    if (handle.includes('w')) left = Math.min(point.x, right - MIN_LOADING_BAY_SIZE_MM)
    if (handle.includes('e')) right = Math.max(point.x, left + MIN_LOADING_BAY_SIZE_MM)
    if (handle.includes('n')) top = Math.min(point.y, bottom - MIN_LOADING_BAY_SIZE_MM)
    if (handle.includes('s')) bottom = Math.max(point.y, top + MIN_LOADING_BAY_SIZE_MM)
    return [{ x: left, y: top }, { x: right, y: top }, { x: right, y: bottom }, { x: left, y: bottom }]
  }

  const handles = bounds ? [
    { id: 'nw', x: bounds.x, y: bounds.y },
    { id: 'n', x: bounds.x + bounds.width / 2, y: bounds.y },
    { id: 'ne', x: bounds.x + bounds.width, y: bounds.y },
    { id: 'e', x: bounds.x + bounds.width, y: bounds.y + bounds.depth / 2 },
    { id: 'se', x: bounds.x + bounds.width, y: bounds.y + bounds.depth },
    { id: 's', x: bounds.x + bounds.width / 2, y: bounds.y + bounds.depth },
    { id: 'sw', x: bounds.x, y: bounds.y + bounds.depth },
    { id: 'w', x: bounds.x, y: bounds.y + bounds.depth / 2 },
  ] : []

  return (
    <Group
      id={bay.id}
      name="loading-bay"
      x={center.x * SCALE}
      y={center.y * SCALE}
      draggable={interactive}
      listening={interactive}
      onMouseDown={(e) => pressItem(bay.id, e)}
      onTouchStart={(e) => pressItem(bay.id, e)}
      onClick={(e) => clickItem(bay.id, e)}
      onTap={(e) => clickItem(bay.id, e)}
      onDragStart={(e) => {
        if (e.target.name().startsWith('loading-bay-')) return
        start.current = center
        groupIds.current = dragGroup(bay.id)
        onDrag({ id: bay.id, ...toMm(e.currentTarget), group: group() })
      }}
      onDragMove={(e) => {
        if (!e.target.name().startsWith('loading-bay-')) onDrag({ id: bay.id, ...toMm(e.currentTarget), group: group() })
      }}
      onDragEnd={(e) => {
        if (e.target.name().startsWith('loading-bay-')) return
        const at = toMm(e.currentTarget)
        moveItems([bay.id, ...groupIds.current], at.x - start.current.x, at.y - start.current.y)
        groupIds.current = []
        onDrag(null)
      }}
      onMouseEnter={(e) => setCursor(e, 'move')}
      onMouseLeave={(e) => setCursor(e, '')}
    >
      {connection && (
        <Line
          points={[
            (connection.dockPoint.x - center.x) * SCALE,
            (connection.dockPoint.y - center.y) * SCALE,
            (connection.bayPoint.x - center.x) * SCALE,
            (connection.bayPoint.y - center.y) * SCALE,
          ]}
          stroke={colour}
          strokeWidth={2}
          strokeScaleEnabled={false}
          dash={[5, 4]}
          listening={false}
        />
      )}
      <Line
        points={shownOutline.flatMap((point) => [(point.x - center.x) * SCALE, (point.y - center.y) * SCALE])}
        closed={shownOutline.length >= 3}
        fill={colour}
        opacity={0.24}
        stroke={colour}
        strokeWidth={selected ? 3 : 2}
        strokeScaleEnabled={false}
        dash={invalidNow ? [7, 4] : undefined}
        lineJoin="round"
      />
      {selected && interactive && rectangular && handles.map((handle) => (
        <Circle
          key={handle.id}
          name="loading-bay-resize-handle"
          x={(handle.x - center.x) * SCALE}
          y={(handle.y - center.y) * SCALE}
          radius={6 / fit}
          fill={CANVAS.selected}
          stroke="white"
          strokeWidth={1.5 / fit}
          draggable
          onDragStart={() => setResizeBase(bay.outline)}
          onDragMove={(e) => {
            const point = { x: center.x + e.target.x() / SCALE, y: center.y + e.target.y() / SCALE }
            setOutlinePreview(resizeOutline(handle.id, point, resizeBase ?? bay.outline))
          }}
          onDragEnd={(e) => {
            const point = { x: center.x + e.target.x() / SCALE, y: center.y + e.target.y() / SCALE }
            const outline = resizeOutline(handle.id, point, resizeBase ?? bay.outline)
            if (!loadingBayIssue({ ...bay, outline }, floorplan, docks, bays)) updateLoadingBay(bay.id, { outline })
            setResizeBase(null)
            setOutlinePreview(null)
          }}
          onMouseEnter={(e) => setCursor(e, 'crosshair')}
          onMouseLeave={(e) => setCursor(e, '')}
        />
      ))}
      {selected && interactive && !rectangular && shownOutline.map((point, index) => (
        <Circle
          key={`vertex-${index}`}
          name="loading-bay-vertex"
          x={(point.x - center.x) * SCALE}
          y={(point.y - center.y) * SCALE}
          radius={6 / fit}
          fill={CANVAS.selected}
          stroke="white"
          strokeWidth={1.5 / fit}
          draggable
          onDragMove={(e) => {
            const moved = { x: center.x + e.target.x() / SCALE, y: center.y + e.target.y() / SCALE }
            setOutlinePreview(bay.outline.map((vertex, vertexIndex) => vertexIndex === index ? moved : vertex))
          }}
          onDragEnd={(e) => {
            const moved = { x: center.x + e.target.x() / SCALE, y: center.y + e.target.y() / SCALE }
            const outline = bay.outline.map((vertex, vertexIndex) => vertexIndex === index ? moved : vertex)
            if (!loadingBayIssue({ ...bay, outline }, floorplan, docks, bays)) updateLoadingBay(bay.id, { outline })
            setOutlinePreview(null)
          }}
          onMouseEnter={(e) => setCursor(e, 'crosshair')}
          onMouseLeave={(e) => setCursor(e, '')}
        />
      ))}
      {selected && interactive && shownOutline.map((point, index) => {
        const next = shownOutline[(index + 1) % shownOutline.length]
        const midpoint = { x: (point.x + next.x) / 2, y: (point.y + next.y) / 2 }
        return (
          <Circle
            key={`edge-${index}`}
            name="loading-bay-edge-handle"
            x={(midpoint.x - center.x) * SCALE}
            y={(midpoint.y - center.y) * SCALE}
            radius={4 / fit}
            fill="white"
            stroke={CANVAS.selected}
            strokeWidth={1.5 / fit}
            onClick={(e) => {
              e.cancelBubble = true
              const outline = [...bay.outline]
              outline.splice(index + 1, 0, midpoint)
              if (!loadingBayIssue({ ...bay, outline }, floorplan, docks, bays)) updateLoadingBay(bay.id, { outline })
            }}
            onTap={(e) => {
              e.cancelBubble = true
              const outline = [...bay.outline]
              outline.splice(index + 1, 0, midpoint)
              if (!loadingBayIssue({ ...bay, outline }, floorplan, docks, bays)) updateLoadingBay(bay.id, { outline })
            }}
            onMouseEnter={(e) => setCursor(e, 'copy')}
            onMouseLeave={(e) => setCursor(e, '')}
          />
        )
      })}
      <Text fontFamily={CANVAS_FONT}
        x={((bounds?.x ?? Math.min(...shownOutline.map((point) => point.x))) - center.x) * SCALE + 8}
        y={((bounds?.y ?? Math.min(...shownOutline.map((point) => point.y))) - center.y) * SCALE + 8}
        text={bounds ? `${bay.name} - ${(bounds.width / 1000).toFixed(1)} x ${(bounds.depth / 1000).toFixed(1)} m` : bay.name}
        fontSize={12}
        fontStyle="bold"
        fill={colour}
        listening={false}
      />
    </Group>
  )
}
