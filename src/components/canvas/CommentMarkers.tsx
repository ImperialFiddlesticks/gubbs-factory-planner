import { useRef } from 'react'
import type Konva from 'konva'
import { Circle, Group, Line, Rect, Text } from 'react-konva'
import { setCursor } from '@/components/canvas/shared'
import { SCALE } from '@/constants'
import { COMMENT_ICON_OFFSET, commentGroups, type CommentGroup, type CommentTargets } from '@/lib/comments'
import { playSound } from '@/lib/sound'
import { usePlanner } from '@/store'
import type { LayoutComment } from '@/types'
import { COLORS, CANVAS_FONT, mixColours } from '@/theme'

/** The icon's size on screen, px (kept the same at every zoom). */
const ICON_W = 24
const ICON_H = 19
const TAIL = 6

/**
 * A chat-bubble icon on the corner of each commented item (or on its floor spot). Open comments
 * are chat blue; when every comment on it is resolved it turns mint with a tick. Several comments
 * on one thing show a count. Clicking opens the big chat bubble (see CommentBubble).
 */
export function CommentMarkers({
  comments,
  fit,
  ...targets
}: CommentTargets & { comments: LayoutComment[]; fit: number }) {
  const selectedCommentId = usePlanner((s) => s.selectedCommentId)

  return (
    <>
      {commentGroups(comments, targets).map((group) => (
        <CommentIcon
          key={group.key}
          group={group}
          fit={fit}
          active={group.comments.some((comment) => comment.id === selectedCommentId)}
        />
      ))}
    </>
  )
}

function CommentIcon({ group, fit, active }: { group: CommentGroup; fit: number; active: boolean }) {
  const selectComment = usePlanner((s) => s.selectComment)
  const select = usePlanner((s) => s.select)
  const ref = useRef<Konva.Group>(null)
  const open = group.comments.filter((comment) => comment.status === 'open')
  const resolved = open.length === 0
  const first = open[0] ?? group.comments[0]
  // Friendly chat colours: blue while open, mint once resolved; white dots, count or tick.
  const fill = resolved ? COLORS.chatGreen : COLORS.chatBlue
  const ink = COLORS.white
  const ring = active ? (resolved ? mixColours(COLORS.chatGreen, COLORS.charcoal900, 0.35) : COLORS.chatBlueDark) : COLORS.white
  const count = group.comments.length

  const openBubble = () => {
    playSound('pick')
    selectComment(first.id)
    select(group.targetId ?? null)
  }
  const grow = (to: number) => ref.current?.to({ scaleX: to / fit, scaleY: to / fit, duration: 0.12 })

  return (
    // Drawn in screen px inside a group scaled by 1/zoom, so it keeps its size when zooming.
    <Group
      ref={ref}
      name="comment-marker"
      x={group.x * SCALE + COMMENT_ICON_OFFSET.x / fit}
      y={group.y * SCALE + COMMENT_ICON_OFFSET.y / fit}
      scaleX={(active ? 1.15 : 1) / fit}
      scaleY={(active ? 1.15 : 1) / fit}
      opacity={resolved && !active ? 0.85 : 1}
      onMouseDown={(e) => {
        e.cancelBubble = true
      }}
      onTouchStart={(e) => {
        e.cancelBubble = true
      }}
      onClick={(e) => {
        e.cancelBubble = true
        openBubble()
      }}
      onTap={(e) => {
        e.cancelBubble = true
        openBubble()
      }}
      onMouseEnter={(e) => {
        setCursor(e, 'pointer')
        grow(active ? 1.25 : 1.12)
      }}
      onMouseLeave={(e) => {
        setCursor(e, '')
        grow(active ? 1.15 : 1)
      }}
    >
      {/* The bubble sits up-right of the item, its tail pointing down-left at it. */}
      <Group x={0} y={-ICON_H - TAIL + 4}>
        <Line
          points={[4, ICON_H - 3, 0, ICON_H + TAIL, 11, ICON_H - 1]}
          closed
          fill={fill}
          stroke={ring}
          strokeWidth={active ? 2 : 1.5}
          lineJoin="round"
        />
        <Rect
          width={ICON_W}
          height={ICON_H}
          cornerRadius={8}
          fill={fill}
          stroke={ring}
          strokeWidth={active ? 2 : 1.5}
          hitStrokeWidth={10}
          shadowColor={COLORS.charcoal900}
          shadowOpacity={0.22}
          shadowBlur={4}
          shadowOffsetY={1.5}
        />
        {/* Cover the tail's join so the outline reads as one shape. */}
        <Rect x={3} y={ICON_H - 5} width={8} height={4} fill={fill} listening={false} />
        {resolved ? (
          <Line points={[7, 9.5, 10.5, 13, 17, 6]} stroke={ink} strokeWidth={2} lineCap="round" lineJoin="round" listening={false} />
        ) : count > 1 ? (
          <Text
            fontFamily={CANVAS_FONT}
            width={ICON_W}
            height={ICON_H}
            text={String(count)}
            align="center"
            verticalAlign="middle"
            fontSize={11}
            fontStyle="bold"
            fill={ink}
            listening={false}
          />
        ) : (
          // "Typing" dots: a message waiting to be read.
          [7, 12, 17].map((cx) => <Circle key={cx} x={cx} y={ICON_H / 2} radius={1.7} fill={ink} listening={false} />)
        )}
      </Group>
    </Group>
  )
}
