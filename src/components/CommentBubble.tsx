import { useEffect, useRef, useState } from 'react'
import { CircleCheck, RotateCcw, Trash2, X } from 'lucide-react'
import { SCALE } from '@/constants'
import { COMMENT_ICON_OFFSET, commentGroups, commentTargetName, formatCommentAge, formatCommentTime, type CommentTargets } from '@/lib/comments'
import { playSound } from '@/lib/sound'
import { cn } from '@/lib/utils'
import { usePlanner } from '@/store'
import type { LayoutComment } from '@/types'

const WIDTH = 272
/** Gap between the bubble and the edge of the work area, px. */
const MARGIN = 8
/** Below this much room above the icon, the bubble opens downwards instead, px. */
const MIN_ROOM_ABOVE = 240

/**
 * The open comment's big chat bubble, drawn as HTML over the canvas next to its icon. It lists
 * every comment on that item with resolve/reopen and delete; clicking outside, Escape or the
 * close button folds it back to the icon.
 */
export function CommentBubble({
  comments,
  targets,
  originX,
  originY,
  fit,
  areaWidth,
}: {
  comments: LayoutComment[]
  targets: CommentTargets
  /** The canvas layer's offset and zoom, to turn floor mm into screen px. */
  originX: number
  originY: number
  fit: number
  areaWidth: number
}) {
  const selectedCommentId = usePlanner((s) => s.selectedCommentId)
  const selectComment = usePlanner((s) => s.selectComment)
  const ref = useRef<HTMLDivElement>(null)
  const group = selectedCommentId
    ? commentGroups(comments, targets).find((g) => g.comments.some((c) => c.id === selectedCommentId))
    : undefined

  // Fold back on a press anywhere outside the bubble, or on Escape. (Pressing another icon
  // closes this one first, then its click opens the new one.)
  const open = Boolean(group)
  useEffect(() => {
    if (!open) return
    const onPointerDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) selectComment(null)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') selectComment(null)
    }
    window.addEventListener('pointerdown', onPointerDown, true)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('pointerdown', onPointerDown, true)
      window.removeEventListener('keydown', onKey)
    }
  }, [open, selectComment])

  if (!group) return null

  // The icon's screen position; the bubble's tail points at it.
  const iconX = originX + group.x * SCALE * fit + COMMENT_ICON_OFFSET.x
  const iconY = originY + group.y * SCALE * fit + COMMENT_ICON_OFFSET.y
  const below = iconY < MIN_ROOM_ABOVE
  const left = Math.max(MARGIN, Math.min(iconX - 18, areaWidth - WIDTH - MARGIN))
  const tailLeft = Math.max(14, Math.min(iconX - left, WIDTH - 24))
  const title = group.targetId ? commentTargetName(group.targetId, targets) : 'Floor note'

  return (
    <div
      ref={ref}
      role="dialog"
      aria-label={`Comments on ${title}`}
      className={cn(
        'absolute z-30 animate-in fade-in-0 zoom-in-90 duration-150',
        below ? 'origin-top-left' : 'origin-bottom-left -translate-y-full',
      )}
      style={{ left, top: below ? iconY + 14 : iconY - 30, width: WIDTH }}
    >
      <div className="relative rounded-2xl border bg-card text-card-foreground shadow-lift">
        <header className="flex items-center gap-2 border-b px-3 py-2">
          <span className="min-w-0 flex-1 truncate text-xs font-extrabold">{title}</span>
          <span className="text-[10px] font-bold text-muted-foreground">
            {group.comments.length} {group.comments.length === 1 ? 'comment' : 'comments'}
          </span>
          <button
            type="button"
            onClick={() => selectComment(null)}
            aria-label="Close comments"
            className="grid size-6 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <X className="size-3.5" aria-hidden />
          </button>
        </header>
        <ul className="max-h-72 space-y-2 overflow-y-auto p-2">
          {group.comments.map((comment) => (
            <CommentMessage key={comment.id} comment={comment} siblings={group.comments} />
          ))}
        </ul>
        {/* The tail, pointing at the icon. */}
        <span
          aria-hidden
          className={cn(
            'absolute size-3.5 rotate-45 border bg-card',
            below ? '-top-[7.5px] border-r-0 border-b-0' : '-bottom-[7.5px] border-t-0 border-l-0',
          )}
          style={{ left: tailLeft }}
        />
      </div>
    </div>
  )
}

/** One message in the bubble: who, when, what, and its actions. */
function CommentMessage({ comment, siblings }: { comment: LayoutComment; siblings: LayoutComment[] }) {
  const selectedCommentId = usePlanner((s) => s.selectedCommentId)
  const selectComment = usePlanner((s) => s.selectComment)
  const setCommentStatus = usePlanner((s) => s.setCommentStatus)
  const deleteComment = usePlanner((s) => s.deleteComment)
  // Comments are not part of undo, so deleting asks once more.
  const [confirming, setConfirming] = useState(false)
  const resolved = comment.status === 'resolved'

  return (
    <li className={cn('rounded-xl p-2.5', resolved ? 'bg-(--chat-green)/10' : 'bg-(--chat-blue)/10')}>
      <div className="flex items-baseline gap-2 text-[11px]">
        <span className="font-extrabold">{comment.author}</span>
        <time dateTime={comment.createdAt} title={formatCommentTime(comment.createdAt)} className="text-muted-foreground">
          {formatCommentAge(comment.createdAt)}
        </time>
        {resolved && (
          <span className="ml-auto inline-flex items-center gap-0.5 font-bold text-(--chat-green)">
            <CircleCheck className="size-3" aria-hidden /> Resolved
          </span>
        )}
      </div>
      <p className={cn('mt-1 text-[13px] leading-snug whitespace-pre-wrap', resolved && 'text-muted-foreground line-through decoration-1')}>
        {comment.message}
      </p>
      <div className="mt-2 flex items-center gap-1.5">
        {resolved ? (
          <button
            type="button"
            onClick={() => {
              playSound('undo')
              setCommentStatus(comment.id, 'open')
            }}
            className="inline-flex items-center gap-1 rounded-full border bg-card px-2.5 py-1 text-[11px] font-bold shadow-soft transition-colors hover:bg-muted"
          >
            <RotateCcw className="size-3" aria-hidden /> Reopen
          </button>
        ) : (
          <button
            type="button"
            onClick={() => {
              playSound('resolve')
              setCommentStatus(comment.id, 'resolved')
            }}
            className="inline-flex items-center gap-1 rounded-full bg-(--chat-green) px-2.5 py-1 text-[11px] font-bold text-white shadow-soft transition-[filter] hover:brightness-110"
          >
            <CircleCheck className="size-3" aria-hidden /> Mark as resolved
          </button>
        )}
        {confirming ? (
          <span className="ml-auto inline-flex items-center gap-1">
            <button
              type="button"
              onClick={() => setConfirming(false)}
              className="rounded-full px-2 py-1 text-[11px] font-bold text-muted-foreground hover:bg-muted"
            >
              Keep
            </button>
            <button
              type="button"
              onClick={() => {
                playSound('remove')
                // Keep the bubble open on the others when the open one goes.
                const next = siblings.find((c) => c.id !== comment.id)
                if (next && selectedCommentId === comment.id) selectComment(next.id)
                deleteComment(comment.id)
              }}
              className="rounded-full bg-destructive px-2.5 py-1 text-[11px] font-bold text-white shadow-soft hover:brightness-110"
            >
              Delete
            </button>
          </span>
        ) : (
          <button
            type="button"
            onClick={() => setConfirming(true)}
            aria-label="Delete comment"
            title="Delete comment"
            className="ml-auto grid size-7 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-destructive"
          >
            <Trash2 className="size-3.5" aria-hidden />
          </button>
        )}
      </div>
    </li>
  )
}
