import { useEffect, useState } from 'react'
import { ChevronDown, CircleCheck, Crosshair, TriangleAlert } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { UTILITY_ICONS } from '@/components/utilityIcons'
import { isStation } from '@/data/catalog'
import { findLayoutIssues, type IssueCategory, type LayoutIssue } from '@/lib/validation'
import { playSound } from '@/lib/sound'
import { cn } from '@/lib/utils'
import { usePlanner } from '@/store'

/** Confetti colours: Saab yellow, blue and white. */
const CONFETTI = ['var(--saab-yellow)', 'var(--saab-blue)', 'var(--feedback-green)', 'var(--saab-yellow-dark)']
const PIECES = 14

/** Top-bar goal: placed stations against the wizard's target, plus the warning count. */
export function GoalCounter() {
  const floorplan = usePlanner((s) => s.floorplan)
  const machines = usePlanner((s) => s.machines)
  const utilities = usePlanner((s) => s.utilities)
  const pillars = usePlanner((s) => s.pillars)
  const walls = usePlanner((s) => s.walls)
  const zones = usePlanner((s) => s.zones)
  const serviceStations = usePlanner((s) => s.truckServiceStations)
  const truckTypes = usePlanner((s) => s.truckTypes)
  const target = usePlanner((s) => s.setup.stationTarget)

  // Conveyor pieces and storage (cabinets, shelves, pallets) aren't stations themselves.
  const placed = machines.filter((m) => isStation(m.typeId)).length
  const issues = floorplan ? findLayoutIssues(machines, utilities, floorplan, { pillars, walls, zones }, serviceStations, truckTypes) : []
  const warnings = issues.length
  const reached = placed >= target && warnings === 0

  // Celebrate each time the goal goes from not reached to reached (not on first render).
  const [wasReached, setWasReached] = useState(reached)
  const [burst, setBurst] = useState(0)
  if (reached !== wasReached) {
    setWasReached(reached)
    if (reached) setBurst((b) => b + 1)
  }

  // The goal fanfare plays with the confetti.
  useEffect(() => {
    if (burst > 0) playSound('goal')
  }, [burst])

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

      <WarningsMenu issues={issues} />

      {burst > 0 && reached && <Confetti key={`c${burst}`} />}
    </div>
  )
}

const ISSUE_GROUPS: { category: IssueCategory; title: string }[] = [
  { category: 'space', title: 'Space' },
  { category: 'utility', title: 'Utilities & safety' },
]

/**
 * The warning count as a button: it opens a list of every warning, grouped by kind. Clicking
 * one selects what it is about and brings it into view on the floor; warnings about the whole
 * floor (no items) are listed but not clickable.
 */
function WarningsMenu({ issues }: { issues: LayoutIssue[] }) {
  const focusItems = usePlanner((s) => s.focusItems)
  const [open, setOpen] = useState(false)
  const count = issues.length

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={count === 0 ? 'No warnings' : `${count} ${count === 1 ? 'warning' : 'warnings'}: show the list`}
          title={count === 0 ? 'All checks pass' : 'Show all warnings'}
          className={cn(
            'flex items-center gap-1 rounded-full px-2 py-1 text-sm tabular-nums transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            count > 0 ? 'text-(--amber-text)' : 'text-muted-foreground',
            open && 'bg-muted',
          )}
        >
          <TriangleAlert className="size-4" aria-hidden />
          {count}
          <ChevronDown className={cn('size-3.5 transition-transform', open && 'rotate-180')} aria-hidden />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-96 max-w-[calc(100vw-2rem)] rounded-2xl p-0">
        <div className="flex items-center gap-2 border-b px-3 py-2">
          <span className="flex-1 text-xs font-extrabold">Layout checks</span>
          <span
            className={cn(
              'rounded-full px-2 py-0.5 text-[10px] font-extrabold',
              count === 0 ? 'bg-(--feedback-green)/15 text-(--feedback-green)' : 'bg-destructive/12 text-destructive',
            )}
          >
            {count === 0 ? 'All checks pass' : `${count} flagged`}
          </span>
        </div>
        {count === 0 ? (
          <p className="flex items-center gap-2 px-3 py-4 text-sm text-muted-foreground">
            <CircleCheck className="size-4 text-(--feedback-green)" aria-hidden />
            No warnings: everything fits and every station is served.
          </p>
        ) : (
          <div className="max-h-[60vh] overflow-y-auto p-1.5">
            {ISSUE_GROUPS.map(({ category, title }) => {
              const group = issues.filter((i) => i.category === category)
              if (group.length === 0) return null
              return (
                <section key={category} className="mb-1 last:mb-0">
                  <h3 className="px-2 pt-1.5 pb-1 text-[10px] font-extrabold tracking-wide text-muted-foreground uppercase">
                    {title} · {group.length}
                  </h3>
                  <ul>
                    {group.map((issue) => (
                      <li key={issue.key}>
                        <IssueRow
                          issue={issue}
                          onGo={() => {
                            focusItems(issue.ids)
                            setOpen(false)
                          }}
                        />
                      </li>
                    ))}
                  </ul>
                </section>
              )
            })}
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}

/** One warning: its icon and message; a button that leads to the items, when it has any. */
function IssueRow({ issue, onGo }: { issue: LayoutIssue; onGo: () => void }) {
  const Icon = issue.need ? UTILITY_ICONS[issue.need] : TriangleAlert
  const body = (
    <>
      <span
        className={cn(
          'mt-0.5 grid size-5 shrink-0 place-items-center rounded-full',
          issue.category === 'space' ? 'bg-destructive/12 text-destructive' : 'bg-(--amber-text)/12 text-(--amber-text)',
        )}
        aria-hidden
      >
        <Icon className="size-3" />
      </span>
      <span className="min-w-0 flex-1 text-[13px] leading-snug">{issue.message}</span>
    </>
  )
  if (issue.ids.length === 0) {
    return <div className="flex items-start gap-2 rounded-lg px-2 py-1.5 text-muted-foreground">{body}</div>
  }
  return (
    <button
      type="button"
      onClick={onGo}
      title="Show it on the floor"
      className="group flex w-full items-start gap-2 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-muted focus-visible:bg-muted focus-visible:outline-none"
    >
      {body}
      <Crosshair className="mt-0.5 size-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100" aria-hidden />
    </button>
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
