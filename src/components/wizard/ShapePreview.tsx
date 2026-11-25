import { floorCorners, shapeError, shapeOutline, type FloorShape } from '@/lib/floorShapes'

interface ShapePreviewProps {
  shape: FloorShape
  /** Pixel box the shape is fitted into. */
  boxWidth: number
  boxHeight: number
  /** Show width/depth labels along the edges. */
  labels?: boolean
}

/** Top view of a floor shape, scaled to fit. Draws nothing useful while the sizes are invalid. */
export function ShapePreview({ shape, boxWidth, boxHeight, labels }: ShapePreviewProps) {
  const pad = labels ? 28 : 4
  const valid = shapeError(shape) === null
  const corners = valid
    ? floorCorners({ width: shape.width, depth: shape.depth, outline: shapeOutline(shape) })
    : []
  const scale = valid
    ? Math.min((boxWidth - 2 * pad) / shape.width, (boxHeight - 2 * pad) / shape.depth)
    : 0
  const ox = (boxWidth - shape.width * scale) / 2
  const oy = (boxHeight - shape.depth * scale) / 2
  const points = corners.map((p) => `${ox + p.x * scale},${oy + p.y * scale}`).join(' ')

  return (
    <svg
      viewBox={`0 0 ${boxWidth} ${boxHeight}`}
      width={boxWidth}
      height={boxHeight}
      className="max-w-full"
      aria-hidden
    >
      {valid ? (
        <>
          <polygon
            points={points}
            fill="var(--saab-white)"
            stroke="var(--saab-charcoal)"
            strokeWidth={labels ? 2 : 1.5}
            strokeLinejoin="round"
          />
          {labels && (
            <g fontSize="12" fill="var(--saab-grey-700)" textAnchor="middle">
              <text x={boxWidth / 2} y={oy + shape.depth * scale + 18}>
                {metres(shape.width)}
              </text>
              <text
                x={ox - 10}
                y={boxHeight / 2}
                transform={`rotate(-90 ${ox - 10} ${boxHeight / 2})`}
              >
                {metres(shape.depth)}
              </text>
            </g>
          )}
        </>
      ) : (
        <rect
          x={pad}
          y={pad}
          width={boxWidth - 2 * pad}
          height={boxHeight - 2 * pad}
          fill="none"
          stroke="var(--saab-grey-400)"
          strokeDasharray="4 3"
        />
      )}
    </svg>
  )
}

function metres(mm: number) {
  return `${Number((mm / 1000).toFixed(2))} m`
}
