import { machineTypeFor } from '@/data/catalog'
import { UTILITY_KINDS } from '@/data/utilities'
import { bodyRect, rectCorners } from '@/lib/geometry'
import { machineName } from '@/lib/machineLabels'
import type { LayoutComment, MachineInstance, Pillar, Utility, Wall } from '@/types'

/** The items a comment can be attached to. */
export interface CommentTargets {
  machines: MachineInstance[]
  utilities: Utility[]
  pillars: Pillar[]
  walls: Wall[]
}

/**
 * Where a comment icon sits relative to its anchor (see commentAnchor), screen px: the tip of
 * its tail lands just on the item's corner, so the bubble perches on it.
 */
export const COMMENT_ICON_OFFSET = { x: -2, y: -2 }

/** All comments on one item (or one floor spot), and where their marker sits, mm. */
export interface CommentGroup {
  key: string
  x: number
  y: number
  targetId?: string
  comments: LayoutComment[]
}

/** Groups comments by what they are on, so one item shows one marker with a count. */
export function commentGroups(comments: LayoutComment[], targets: CommentTargets): CommentGroup[] {
  const groups = new Map<string, CommentGroup>()
  for (const comment of comments) {
    const key = comment.targetId ? `item:${comment.targetId}` : `point:${comment.x}:${comment.y}`
    const group = groups.get(key)
    if (group) group.comments.push(comment)
    else groups.set(key, { key, ...commentAnchor(comment, targets), targetId: comment.targetId, comments: [comment] })
  }
  return [...groups.values()]
}

/**
 * Where a comment's marker sits: on its item's top-right corner (following it), or its own
 * floor spot. Small items (utilities) and walls use their centre.
 */
export function commentAnchor(comment: LayoutComment, { machines, utilities, pillars, walls }: CommentTargets) {
  const id = comment.targetId
  const machine = machines.find((item) => item.id === id)
  if (machine) {
    const type = machineTypeFor(machine)
    if (!type) return { x: machine.x, y: machine.y }
    // The corner furthest up and to the right on screen, whichever way the machine is turned.
    return rectCorners(bodyRect(type, machine)).reduce((best, p) => (p.x - p.y > best.x - best.y ? p : best))
  }
  const utility = utilities.find((item) => item.id === id)
  if (utility) return { x: utility.x, y: utility.y }
  const pillar = pillars.find((item) => item.id === id)
  if (pillar) return { x: pillar.x + pillar.width / 2, y: pillar.y - pillar.depth / 2 }
  const wall = walls.find((item) => item.id === id)
  if (wall) return { x: (wall.start.x + wall.end.x) / 2, y: (wall.start.y + wall.end.y) / 2 }
  return { x: comment.x, y: comment.y }
}

/** What a comment is on, in words ("CNC 01", "Pillar", "Floor location"). */
export function commentTargetName(id: string | undefined, { machines, utilities, pillars, walls }: CommentTargets) {
  const machine = machines.find((item) => item.id === id)
  if (machine) return machineName(machine, machines)
  const utility = utilities.find((item) => item.id === id)
  if (utility) return UTILITY_KINDS[utility.kind].name
  if (pillars.some((item) => item.id === id)) return 'Pillar'
  if (walls.some((item) => item.id === id)) return 'Wall'
  return 'Floor location'
}

export function formatCommentTime(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? 'Unknown time' : date.toLocaleString()
}

/** A friendly short time for chat bubbles: "just now", "5 min ago", "3 h ago", else the date. */
export function formatCommentAge(value: string, now = Date.now()) {
  const date = new Date(value)
  const ms = now - date.getTime()
  if (Number.isNaN(ms)) return 'Unknown time'
  const min = Math.floor(ms / 60_000)
  if (min < 1) return 'just now'
  if (min < 60) return `${min} min ago`
  const h = Math.floor(min / 60)
  if (h < 24) return `${h} h ago`
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
}
