import { useRef, useState } from 'react'
import { Circle, Group, Line, Text } from 'react-konva'
import { clickItem, dragGroup, pressItem, setCursor, type DragState } from '@/components/canvas/shared'
import { SCALE } from '@/constants'
import { loadingBayCentroid, loadingBayConnection, loadingBayIssue } from '@/lib/loadingBays'
import { usePlanner } from '@/store'
import { CANVAS, COLORS } from '@/theme'
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
  const center = loadingBayCentroid(bay)
  const shownOutline = outlinePreview ?? bay.outline
  const shownBay = { ...bay, outline: shownOutline }
  const connection = dock ? loadingBayConnection(shownBay, dock, floorplan) : null
  const previewIssue = outlinePreview ? loadingBayIssue(shownBay, floorplan, docks, bays) : null
  const invalidNow = invalid || Boolean(previewIssue)
  const colour = invalidNow ? CANVAS.invalid : selected ? CANVAS.selected : COLORS.green
  const group = () => groupIds.current.length ? groupIds.current : undefined
  const toMm = (node: { x: () => number; y: () => number }) => ({ x: node.x() / SCALE, y: node.y() / SCALE })

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
        if (e.target.name() === 'loading-bay-vertex') return
        start.current = center
        groupIds.current = dragGroup(bay.id)
        onDrag({ id: bay.id, ...toMm(e.currentTarget), group: group() })
      }}
      onDragMove={(e) => {
        if (e.target.name() !== 'loading-bay-vertex') onDrag({ id: bay.id, ...toMm(e.currentTarget), group: group() })
      }}
      onDragEnd={(e) => {
        if (e.target.name() === 'loading-bay-vertex') return
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
      {shownOutline.length < 3 && shownOutline.map((point, index) => (
        <Circle key={`preview-${index}`} x={(point.x - center.x) * SCALE} y={(point.y - center.y) * SCALE} radius={4 / fit} fill={colour} listening={false} />
      ))}
      {selected && interactive && shownOutline.map((point, index) => (
        <Circle
          key={index}
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
      <Text
        x={(Math.min(...shownOutline.map((point) => point.x)) - center.x) * SCALE + 8}
        y={(Math.min(...shownOutline.map((point) => point.y)) - center.y) * SCALE + 8}
        text={bay.name}
        fontSize={12}
        fontStyle="bold"
        fill={colour}
        listening={false}
      />
    </Group>
  )
}
