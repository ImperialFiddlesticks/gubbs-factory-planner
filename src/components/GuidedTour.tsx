import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, ArrowRight, X } from 'lucide-react'
import { Button } from '@/components/ui/button'

const TOUR_STEPS = [
  {
    target: 'equipment-library',
    title: 'Choose equipment',
    text: 'Pick a machine or other item from the Equipment Library. Drag it onto the floor to place it.',
  },
  {
    target: 'floor',
    title: 'Arrange the floor',
    text: 'Click to place equipment. Drag a placed item to move it around the floor.',
  },
  {
    target: 'properties',
    title: 'Edit and group',
    text: 'Select an item to change its properties. Select several machines to group them and move them together.',
  },
  {
    target: 'layout-checks',
    title: 'Review the layout',
    text: 'Layout checks point out clashes, spacing concerns, and equipment requirements to review.',
  },
  {
    target: 'projects',
    title: 'Manage your projects',
    text: 'Open this menu to switch projects, save to the server, or import and export project files.',
  },
] as const

interface Rect { left: number; top: number; width: number; height: number; right: number; bottom: number }

export function GuidedTour({
  stepIndex,
  onStepChange,
  onClose,
}: {
  stepIndex: number
  onStepChange: (step: number) => void
  onClose: () => void
}) {
  const step = TOUR_STEPS[stepIndex]
  const cardRef = useRef<HTMLDivElement>(null)
  const onCloseRef = useRef(onClose)
  const [targetRect, setTargetRect] = useState<Rect | null>(null)
  const [cardRect, setCardRect] = useState<Rect | null>(null)
  const [viewport, setViewport] = useState({ width: window.innerWidth, height: window.innerHeight })

  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  useEffect(() => {
    const previouslyFocused = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null
    const dialog = cardRef.current
    dialog?.focus()

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault()
        onCloseRef.current()
        return
      }

      if (event.key !== 'Tab' || !dialog) return
      const focusable = Array.from(dialog.querySelectorAll<HTMLElement>(
        'button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])',
      ))
      if (focusable.length === 0) {
        event.preventDefault()
        dialog.focus()
        return
      }

      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog)) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      previouslyFocused?.focus()
    }
  }, [])

  useEffect(() => {
    let frame = 0
    const scheduleMeasure = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        const target = document.querySelector<HTMLElement>(`[data-guide-target="${step.target}"]`)
        const targetBounds = target?.getBoundingClientRect()
        const cardBounds = cardRef.current?.getBoundingClientRect()
        setViewport({ width: window.innerWidth, height: window.innerHeight })
        setTargetRect(targetBounds ? {
          left: targetBounds.left,
          top: targetBounds.top,
          width: targetBounds.width,
          height: targetBounds.height,
          right: targetBounds.right,
          bottom: targetBounds.bottom,
        } : null)
        setCardRect(cardBounds ? {
          left: cardBounds.left,
          top: cardBounds.top,
          width: cardBounds.width,
          height: cardBounds.height,
          right: cardBounds.right,
          bottom: cardBounds.bottom,
        } : null)
      })
    }

    const target = document.querySelector<HTMLElement>(`[data-guide-target="${step.target}"]`)
    target?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
    scheduleMeasure()
    const observer = new ResizeObserver(scheduleMeasure)
    if (target) observer.observe(target)
    if (cardRef.current) observer.observe(cardRef.current)
    window.addEventListener('resize', scheduleMeasure)
    window.addEventListener('scroll', scheduleMeasure, true)
    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
      window.removeEventListener('resize', scheduleMeasure)
      window.removeEventListener('scroll', scheduleMeasure, true)
    }
  }, [step.target, stepIndex])

  const position = targetRect
    ? cardPosition(targetRect, cardRect, viewport)
    : { left: 16, top: Math.max(16, viewport.height - 220), width: Math.min(420, viewport.width - 32) }
  const arrow = targetRect && cardRect ? arrowPath(targetRect, cardRect) : null

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const bounds = cardRef.current?.getBoundingClientRect()
      if (bounds) {
        setCardRect((current) => {
          const next = {
            left: bounds.left,
            top: bounds.top,
            width: bounds.width,
            height: bounds.height,
            right: bounds.right,
            bottom: bounds.bottom,
          }
          return current && current.left === next.left && current.top === next.top && current.width === next.width && current.height === next.height
            ? current
            : next
        })
      }
    })
    return () => cancelAnimationFrame(frame)
  }, [position.left, position.top, position.width, stepIndex])

  return (
    <>
      <svg className="pointer-events-auto fixed inset-0 z-[100] size-full" aria-hidden>
        <defs>
          <mask id="guided-tour-spotlight">
            <rect width="100%" height="100%" fill="white" />
            {targetRect && (
              <rect x={targetRect.left - 7} y={targetRect.top - 7} width={targetRect.width + 14} height={targetRect.height + 14} rx="10" fill="black" />
            )}
          </mask>
          <marker id="guided-tour-arrowhead" markerWidth="12" markerHeight="12" refX="10" refY="6" orient="auto">
            <path d="M 1 1 L 10 6 L 1 11" fill="none" stroke="#f0b83d" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </marker>
        </defs>
        <rect width="100%" height="100%" fill="rgba(24, 22, 19, 0.68)" mask="url(#guided-tour-spotlight)" />
        {targetRect && (
          <rect x={targetRect.left - 7} y={targetRect.top - 7} width={targetRect.width + 14} height={targetRect.height + 14} rx="10" fill="none" stroke="#f0b83d" strokeWidth="3" />
        )}
        {arrow && (
          <path d={arrow} fill="none" stroke="#f0b83d" strokeWidth="3" strokeLinecap="round" markerEnd="url(#guided-tour-arrowhead)" />
        )}
      </svg>

      <div
        ref={cardRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="guided-tour-title"
        tabIndex={-1}
        className="theme-chrome fixed z-[101] rounded-xl border bg-background p-4 text-foreground shadow-2xl sm:p-5"
        style={{ left: position.left, top: position.top, width: position.width, maxHeight: 'calc(100dvh - 2rem)', overflowY: 'auto' }}
      >
        <button type="button" onClick={onClose} aria-label="Close guided tour" className="absolute right-3 top-3 rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground">
          <X className="size-4" />
        </button>
        <div className="pr-8 text-xs font-medium text-muted-foreground" aria-live="polite">Quick tour · {stepIndex + 1} of {TOUR_STEPS.length}</div>
        <h2 id="guided-tour-title" className="mt-1 text-base font-semibold">{step.title}</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground" aria-live="polite">{step.text}</p>
        <div className="mt-4 flex items-center justify-between gap-2">
          <Button variant="ghost" size="sm" onClick={onClose}>Skip tour</Button>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => onStepChange(stepIndex - 1)} disabled={stepIndex === 0}>
              <ArrowLeft /> Back
            </Button>
            {stepIndex < TOUR_STEPS.length - 1 ? (
              <Button size="sm" onClick={() => onStepChange(stepIndex + 1)}>Next <ArrowRight /></Button>
            ) : (
              <Button size="sm" onClick={onClose}>Done</Button>
            )}
          </div>
        </div>
      </div>
    </>
  )
}

function cardPosition(target: Rect, card: Rect | null, viewport: { width: number; height: number }) {
  const margin = 16
  const width = Math.min(420, viewport.width - margin * 2)
  const height = card?.height ?? 210
  const centerY = target.top + target.height / 2
  let left: number
  let top: number

  if (target.width > viewport.width * 0.45 && target.height > viewport.height * 0.65) {
    left = (viewport.width - width) / 2
    top = target.top + margin
  } else if (target.right < viewport.width * 0.32 && viewport.width - target.right > width + margin * 2) {
    left = target.right + margin
    top = centerY < height / 2 + margin ? target.bottom + margin : centerY - height / 2
  } else if (target.left > viewport.width * 0.68 && target.left > width + margin * 2) {
    left = target.left - width - margin
    top = centerY < height / 2 + margin ? target.bottom + margin : centerY - height / 2
  } else {
    left = target.left + target.width / 2 - width / 2
    top = target.bottom + height + margin * 2 < viewport.height
      ? target.bottom + margin
      : target.top - height - margin
  }

  return {
    left: Math.max(margin, Math.min(left, viewport.width - width - margin)),
    top: Math.max(margin, Math.min(top, viewport.height - height - margin)),
    width,
  }
}

function arrowPath(target: Rect, card: Rect) {
  const targetCenter = { x: target.left + target.width / 2, y: target.top + target.height / 2 }
  const cardCenter = { x: card.left + card.width / 2, y: card.top + card.height / 2 }
  let start: { x: number; y: number }
  let end: { x: number; y: number }

  const overlaps = card.left < target.right && card.right > target.left && card.top < target.bottom && card.bottom > target.top
  if (overlaps) {
    const dx = targetCenter.x - cardCenter.x
    const dy = targetCenter.y - cardCenter.y
    if (Math.abs(dy) >= Math.abs(dx)) {
      start = { x: Math.max(card.left + 28, Math.min(targetCenter.x, card.left + card.width - 28)), y: dy >= 0 ? card.bottom : card.top }
    } else {
      start = { x: dx >= 0 ? card.right : card.left, y: Math.max(card.top + 24, Math.min(targetCenter.y, card.top + card.height - 24)) }
    }
    end = targetCenter
    const controlX = (start.x + end.x) / 2
    const controlY = (start.y + end.y) / 2
    return `M ${start.x} ${start.y} Q ${controlX} ${controlY} ${end.x} ${end.y}`
  }

  if (Math.abs(targetCenter.y - cardCenter.y) > Math.abs(targetCenter.x - cardCenter.x)) {
    const below = targetCenter.y > cardCenter.y
    start = { x: Math.max(card.left + 28, Math.min(targetCenter.x, card.left + card.width - 28)), y: below ? card.top + card.height : card.top }
    end = { x: targetCenter.x, y: below ? target.top : target.top + target.height }
  } else {
    const right = targetCenter.x > cardCenter.x
    start = { x: right ? card.left + card.width : card.left, y: Math.max(card.top + 24, Math.min(targetCenter.y, card.top + card.height - 24)) }
    end = { x: right ? target.left : target.left + target.width, y: targetCenter.y }
  }

  const controlX = (start.x + end.x) / 2
  const controlY = (start.y + end.y) / 2
  return `M ${start.x} ${start.y} Q ${controlX} ${controlY} ${end.x} ${end.y}`
}
