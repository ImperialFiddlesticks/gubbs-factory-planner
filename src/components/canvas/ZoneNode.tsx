import { useRef, useState } from 'react'
import type Konva from 'konva'
import { Group, Label, Rect, Shape, Tag, Text } from 'react-konva'
import { clickItem, dragGroup, pressItem, setCursor, type DragState } from '@/components/canvas/shared'
import { SCALE } from '@/constants'
import { MIN_ZONE_SIZE, zoneArea } from '@/data/zones'
import { usePlanner } from '@/store'
import { CANVAS, CANVAS_FONT } from '@/theme'
import type { Zone } from '@/types'

type ZoneRect = Pick<Zone, 'x' | 'y' | 'width' | 'depth'>

/**
 * A placed zone. Only its name tag is clickable: click the tag to select the zone, drag it to
 * move the zone. Dragging elsewhere inside the zone still draws the select box, and machines in
 * it stay clickable. A selected zone gets corner handles to resize it.
 */
export function ZoneNode({
  zone,
  fit,
  selected,
  resizable,
  interactive,
  onDrag,
}: {
  zone: Zone
  fit: number
  selected: boolean
  /** Show corner handles (when it's the only thing selected). */
  resizable: boolean
  interactive: boolean
  /** Live position while dragging (with what moves along), and null when the drag ends. */
  onDrag: (drag: DragState | null) => void
}) {
  const moveItems = usePlanner((s) => s.moveItems)
  const updateZone = usePlanner((s) => s.updateZone)
  /** The rectangle while a corner handle is being dragged. */
  const [resizing, setResizing] = useState<ZoneRect | null>(null)
  /** Set on drag start: where the zone started and what moves with it. */
  const drag = useRef<{ from: { x: number; y: number }; group: string[] }>({ from: { x: 0, y: 0 }, group: [] })

  const shown = { ...zone, ...resizing }
  const toMm = (node: Konva.Node) => ({ x: node.x() / SCALE, y: node.y() / SCALE })
  const group = () => (drag.current.group.length ? drag.current.group : undefined)

  return (
    <Group
      id={zone.id}
      name="zone"
      x={zone.x * SCALE}
      y={zone.y * SCALE}
      draggable={interactive}
      listening={interactive}
      onDragStart={(e) => {
        // Handle drags bubble up here; only the tag moves the zone.
        if (e.target !== e.currentTarget) return
        const from = usePlanner.getState().zones.find((z) => z.id === zone.id) ?? zone
        drag.current = { from, group: dragGroup(zone.id) }
        onDrag({ id: zone.id, ...toMm(e.target), group: group() })
      }}
      onDragMove={(e) => {
        if (e.target === e.currentTarget) onDrag({ id: zone.id, ...toMm(e.target), group: group() })
      }}
      onDragEnd={(e) => {
        if (e.target !== e.currentTarget) return
        const at = toMm(e.target)
        const { from, group: ids } = drag.current
        moveItems([zone.id, ...ids], at.x - from.x, at.y - from.y)
        drag.current = { from: { x: 0, y: 0 }, group: [] }
        onDrag(null)
      }}
    >
      {/* Drawn around the group's origin (the zone's centre), so moving the group moves it all. */}
      <Group x={-zone.x * SCALE} y={-zone.y * SCALE} listening={false}>
        <ZoneShape zone={shown} fit={fit} selected={selected} />
      </Group>

      <ZoneTag
        zone={zone}
        x={(shown.x - shown.width / 2 - zone.x) * SCALE}
        y={(shown.y - shown.depth / 2 - zone.y) * SCALE}
        fit={fit}
        selected={selected}
        onPress={(e) => pressItem(zone.id, e)}
        onClick={(e) => clickItem(zone.id, e)}
      />

      {resizable && interactive && (
        <ResizeHandles
          zone={zone}
          fit={fit}
          onResize={setResizing}
          onDone={(r) => {
            setResizing(null)
            if (r && r.width >= MIN_ZONE_SIZE && r.depth >= MIN_ZONE_SIZE) updateZone(zone.id, r)
          }}
        />
      )}
    </Group>
  )
}

/** The zone's fill, border and (for aisles) hatching, in floor coordinates. Not clickable. */
export function ZoneShape({ zone, fit, selected = false }: { zone: Pick<Zone, 'kind' | 'colour'> & ZoneRect; fit: number; selected?: boolean }) {
  const x = (zone.x - zone.width / 2) * SCALE
  const y = (zone.y - zone.depth / 2) * SCALE
  const w = zone.width * SCALE
  const h = zone.depth * SCALE
  return (
    <Group listening={false}>
      <Rect x={x} y={y} width={w} height={h} fill={zone.colour} opacity={zone.kind === 'aisle' ? 0.1 : 0.14} />
      {zone.kind === 'aisle' && <Hatch x={x} y={y} w={w} h={h} colour={zone.colour} fit={fit} />}
      <Rect
        x={x}
        y={y}
        width={w}
        height={h}
        stroke={selected ? CANVAS.selected : zone.colour}
        strokeWidth={selected ? 2.5 : 1.5}
        strokeScaleEnabled={false}
        dash={zone.kind === 'aisle' ? [10, 5] : zone.kind === 'height' ? [3, 4] : undefined}
      />
    </Group>
  )
}

/** Diagonal stripes across a rectangle, a fixed distance apart on screen. */
function Hatch({ x, y, w, h, colour, fit }: { x: number; y: number; w: number; h: number; colour: string; fit: number }) {
  const gap = 14 / fit
  return (
    <Shape
      stroke={colour}
      strokeWidth={1}
      strokeScaleEnabled={false}
      opacity={0.45}
      sceneFunc={(ctx, shape) => {
        ctx.save()
        ctx.beginPath()
        ctx.rect(x, y, w, h)
        ctx.clip()
        ctx.beginPath()
        for (let d = -h; d < w; d += gap) {
          ctx.moveTo(x + d, y + h)
          ctx.lineTo(x + d + h, y)
        }
        ctx.strokeShape(shape)
        ctx.restore()
      }}
    />
  )
}

/** "Name · 41.8 m²" (and the height limit) in the zone's top-left corner; the zone's handle. */
function ZoneTag({
  zone,
  x,
  y,
  fit,
  selected,
  onPress,
  onClick,
}: {
  zone: Zone
  x: number
  y: number
  fit: number
  selected: boolean
  onPress: (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => void
  onClick: (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => void
}) {
  const parts = [zone.name, `${zoneArea(zone)} m²`]
  if (zone.kind === 'height' && zone.maxHeight) parts.push(`max ${zone.maxHeight / 1000} m`)
  return (
    <Group x={x} y={y} scaleX={1 / fit} scaleY={1 / fit}>
      <Label
        x={4}
        y={4}
        onMouseDown={onPress}
        onTouchStart={onPress}
        onClick={onClick}
        onTap={onClick}
        onMouseEnter={(e) => setCursor(e, 'move')}
        onMouseLeave={(e) => setCursor(e, '')}
      >
        <Tag fill={zone.colour} cornerRadius={3} stroke={selected ? CANVAS.selected : undefined} strokeWidth={selected ? 2 : 0} />
        <Text fontFamily={CANVAS_FONT} text={parts.join(' · ')} fontSize={11} fontStyle="bold" padding={4} fill="white" />
      </Label>
    </Group>
  )
}

/**
 * Four corner handles. Dragging one keeps the opposite corner where it is; `onResize` reports
 * the rectangle as it changes and `onDone` the final one.
 */
function ResizeHandles({
  zone,
  fit,
  onResize,
  onDone,
}: {
  zone: Zone
  fit: number
  onResize: (r: ZoneRect) => void
  onDone: (r: ZoneRect | null) => void
}) {
  const size = 9 / fit
  const corners = [
    [-1, -1],
    [1, -1],
    [1, 1],
    [-1, 1],
  ] as const
  const last = useRef<ZoneRect | null>(null)

  /** The rectangle from the fixed opposite corner to the handle, in mm. */
  function rectFrom(node: Konva.Node, sx: number, sy: number): ZoneRect {
    // Handle positions are relative to the zone's centre.
    const hx = zone.x + node.x() / SCALE
    const hy = zone.y + node.y() / SCALE
    const ox = zone.x - (sx * zone.width) / 2
    const oy = zone.y - (sy * zone.depth) / 2
    return { x: (hx + ox) / 2, y: (hy + oy) / 2, width: Math.abs(hx - ox), depth: Math.abs(hy - oy) }
  }

  return (
    <>
      {corners.map(([sx, sy]) => (
        <Rect
          key={`${sx}${sy}`}
          x={(sx * zone.width * SCALE) / 2}
          y={(sy * zone.depth * SCALE) / 2}
          width={size}
          height={size}
          offsetX={size / 2}
          offsetY={size / 2}
          fill="white"
          stroke={CANVAS.selected}
          strokeWidth={2}
          strokeScaleEnabled={false}
          draggable
          onMouseEnter={(e) => setCursor(e, sx === sy ? 'nwse-resize' : 'nesw-resize')}
          onMouseLeave={(e) => setCursor(e, '')}
          onDragMove={(e) => {
            last.current = rectFrom(e.target, sx, sy)
            onResize(last.current)
          }}
          onDragEnd={(e) => {
            // Put the handle back on the (possibly unchanged) corner; React redraws it there.
            e.target.position({ x: (sx * zone.width * SCALE) / 2, y: (sy * zone.depth * SCALE) / 2 })
            onDone(last.current)
            last.current = null
          }}
        />
      ))}
    </>
  )
}
