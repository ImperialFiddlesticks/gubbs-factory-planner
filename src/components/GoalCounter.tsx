import { useState } from 'react'
import { CircleCheck, TriangleAlert } from 'lucide-react'
import { findLayoutIssues } from '@/lib/validation'
import { cn } from '@/lib/utils'
import { usePlanner } from '@/store'

/** Confetti colours: Saab yellow, blue and white. */
const CONFETTI = ['var(--saab-yellow)', 'var(--saab-blue)', 'var(--saab-white)', 'var(--saab-yellow-dark)']
const PIECES = 14

/** Top-bar goal: placed stations against the wizard's target, plus the warning count. */
export function GoalCounter() {
  const floorplan = usePlanner((s) => s.floorplan)
  const machines = usePlanner((s) => s.machines)
  const utilities = usePlanner((s) => s.utilities)
  const pillars = usePlanner((s) => s.pillars)
  const walls = usePlanner((s) => s.walls)
  const target = usePlanner((s) => s.setup.stationTarget)

  const placed = machines.length
  const warnings = floorplan ? findLayoutIssues(machines, utilities, floorplan, { pillars, walls }).length : 0
  const reached = placed >= target && warnings === 0

  // Celebrate each time the goal goes from not reached to reached (not on first render).
  const [wasReached, setWasReached] = useState(reached)
  const [burst, setBurst] = useState(0)
  if (reached !== wasReached) {
    setWasReached(reached)
    if (reached) setBurst((b) => b + 1)
  }

  return (
    <div
      className="relative z-10 flex items-center gap-3"
      role="status"
      aria-live="polite"
      aria-label={
        reached
          ? `Goal reached: ${placed} of ${target} stations, no warnings`
          : `${placed} of ${target} stations, ${warnings} ${warnings === 1 ? 'warning' : 'warnings'}`
      }
    >
      <div
        key={burst}
        className={cn(
          'flex items-center gap-2 rounded-full px-3 py-1 text-sm',
          reached ? 'bg-(--feedback-green) text-white' : 'bg-secondary',
          burst > 0 && reached && 'animate-goal-pop',
        )}
      >
        {reached && <CircleCheck className="size-4" aria-hidden />}
        <span className="font-semibold tabular-nums">
          {placed} / {target}
        </span>
        <span className={reached ? 'text-white/90' : 'text-muted-foreground'}>
          {reached ? 'Goal reached' : 'stations'}
        </span>
        {!reached && (
          <span className="h-1.5 w-16 overflow-hidden rounded-full bg-background" aria-hidden>
            <span
              className="block h-full rounded-full bg-accent transition-[width] duration-300"
              style={{ width: `${Math.min(100, (placed / target) * 100)}%` }}
            />
          </span>
        )}
      </div>

      <span
        className={cn(
          'flex items-center gap-1 text-sm tabular-nums',
          warnings > 0 ? 'text-accent' : 'text-muted-foreground',
        )}
      >
        <TriangleAlert className="size-4" aria-hidden />
        {warnings}
      </span>

      {burst > 0 && reached && <Confetti key={`c${burst}`} />}
    </div>
  )
}

/** A one-off burst of small squares from the counter. Hidden when reduced motion is preferred. */
function Confetti() {
  return (
    <span className="pointer-events-none absolute top-1/2 left-12 motion-reduce:hidden" aria-hidden>
      {Array.from({ length: PIECES }, (_, i) => {
        const angle = (i / PIECES) * Math.PI * 2
        const dist = 40 + (i % 3) * 18
        return (
          <span
            key={i}
            className="animate-confetti absolute size-1.5 rounded-[1px]"
            style={
              {
                backgroundColor: CONFETTI[i % CONFETTI.length],
                '--dx': `${Math.cos(angle) * dist}px`,
                '--dy': `${Math.sin(angle) * dist + 20}px`,
                '--rot': `${(i % 2 ? 1 : -1) * (180 + i * 25)}deg`,
              } as React.CSSProperties
            }
          />
        )
      })}
    </span>
  )
}
