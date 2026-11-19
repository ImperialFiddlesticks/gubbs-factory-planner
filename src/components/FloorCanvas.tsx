import { useEffect, useRef, useState } from 'react'
import { Layer, Line, Rect, Stage } from 'react-konva'
import { SCALE } from '@/constants'
import { CANVAS } from '@/theme'
import type { Floorplan } from '@/types'

interface FloorCanvasProps {
  floorplan: Floorplan
}

export function FloorCanvas({ floorplan }: FloorCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const size = useElementSize(containerRef)

  const floorW = floorplan.width * SCALE
  const floorH = floorplan.depth * SCALE
  // Centre the floorplan in the work area.
  const originX = Math.round((size.width - floorW) / 2)
  const originY = Math.round((size.height - floorH) / 2)

  return (
    <main
      ref={containerRef}
      className="relative overflow-hidden"
      style={{ backgroundColor: CANVAS.background }}
    >
      {size.width > 0 && (
        <Stage width={size.width} height={size.height}>
          <Layer x={originX} y={originY}>
            <Rect width={floorW} height={floorH} fill={CANVAS.floor} />
            <Grid floorplan={floorplan} />
            <Rect
              width={floorW}
              height={floorH}
              stroke={CANVAS.floorStroke}
              strokeWidth={2}
              listening={false}
            />
          </Layer>
        </Stage>
      )}
    </main>
  )
}

function Grid({ floorplan }: { floorplan: Floorplan }) {
  const { width, depth, gridSize } = floorplan
  const lines = []
  for (let x = gridSize; x < width; x += gridSize) {
    lines.push(
      <Line key={`v${x}`} points={[x * SCALE, 0, x * SCALE, depth * SCALE]} stroke={CANVAS.grid} strokeWidth={1} />,
    )
  }
  for (let y = gridSize; y < depth; y += gridSize) {
    lines.push(
      <Line key={`h${y}`} points={[0, y * SCALE, width * SCALE, y * SCALE]} stroke={CANVAS.grid} strokeWidth={1} />,
    )
  }
  return <>{lines}</>
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
