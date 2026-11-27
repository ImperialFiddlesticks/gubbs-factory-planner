import { Circle, Group, Text } from 'react-konva'
import { setCursor } from '@/components/canvas/shared'
import { SCALE } from '@/constants'
import type { LayoutComment, MachineInstance, Pillar, Utility, Wall } from '@/types'
import { usePlanner } from '@/store'
import { COLORS } from '@/theme'

interface MarkerGroup {
  key: string
  x: number
  y: number
  comments: LayoutComment[]
}

export function CommentMarkers({
  comments,
  machines,
  utilities,
  pillars,
  walls,
  fit,
}: {
  comments: LayoutComment[]
  machines: MachineInstance[]
  utilities: Utility[]
  pillars: Pillar[]
  walls: Wall[]
  fit: number
}) {
  const selectedCommentId = usePlanner((s) => s.selectedCommentId)
  const selectComment = usePlanner((s) => s.selectComment)
  const select = usePlanner((s) => s.select)
  const groups = new Map<string, MarkerGroup>()

  for (const comment of comments) {
    const point = commentAnchor(comment, machines, utilities, pillars, walls)
    const key = comment.targetId ? `item:${comment.targetId}` : `point:${comment.x}:${comment.y}`
    const group = groups.get(key)
    if (group) group.comments.push(comment)
    else groups.set(key, { key, x: point.x, y: point.y, comments: [comment] })
  }

  return (
    <>
      {[...groups.values()].map((group) => {
        const active = group.comments.some((comment) => comment.id === selectedCommentId)
        const firstOpen = group.comments.find((comment) => comment.status === 'open')
        const comment = firstOpen ?? group.comments[0]
        const radius = (active ? 11 : 9) / fit
        return (
          <Group
            key={group.key}
            name="comment-marker"
            x={group.x * SCALE + 12 / fit}
            y={group.y * SCALE - 12 / fit}
            onMouseDown={(e) => {
              e.cancelBubble = true
            }}
            onTouchStart={(e) => {
              e.cancelBubble = true
            }}
            onClick={(e) => {
              e.cancelBubble = true
              selectComment(comment.id)
              select(comment.targetId ?? null)
            }}
            onTap={(e) => {
              e.cancelBubble = true
              selectComment(comment.id)
              select(comment.targetId ?? null)
            }}
            onMouseEnter={(e) => setCursor(e, 'pointer')}
            onMouseLeave={(e) => setCursor(e, '')}
          >
            <Circle
              radius={radius}
              fill={comment.status === 'open' ? COLORS.yellow : COLORS.grey500}
              stroke={active ? COLORS.charcoal : COLORS.white}
              strokeWidth={(active ? 2 : 1.5) / fit}
              hitStrokeWidth={8 / fit}
              shadowColor="black"
              shadowOpacity={0.25}
              shadowBlur={3 / fit}
            />
            <Text
              x={-radius}
              y={-radius}
              width={radius * 2}
              height={radius * 2}
              text={group.comments.length > 1 ? String(group.comments.length) : '•'}
              align="center"
              verticalAlign="middle"
              fontSize={10 / fit}
              fontStyle="bold"
              fill={COLORS.charcoal}
              listening={false}
            />
          </Group>
        )
      })}
    </>
  )
}

function commentAnchor(
  comment: LayoutComment,
  machines: MachineInstance[],
  utilities: Utility[],
  pillars: Pillar[],
  walls: Wall[],
) {
  const id = comment.targetId
  const machine = machines.find((item) => item.id === id)
  if (machine) return { x: machine.x, y: machine.y }
  const utility = utilities.find((item) => item.id === id)
  if (utility) return { x: utility.x, y: utility.y }
  const pillar = pillars.find((item) => item.id === id)
  if (pillar) return { x: pillar.x, y: pillar.y }
  const wall = walls.find((item) => item.id === id)
  if (wall) return { x: (wall.start.x + wall.end.x) / 2, y: (wall.start.y + wall.end.y) / 2 }
  return { x: comment.x, y: comment.y }
}
