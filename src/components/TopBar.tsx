import { GoalCounter } from '@/components/GoalCounter'
import { ProjectSwitcher } from '@/components/ProjectSwitcher'
import { DEFAULT_FACTORY_HEIGHT_MM } from '@/data/defaults'
import { useSyncExternalStore } from 'react'
import { CircleHelp, Volume2, VolumeX } from 'lucide-react'
import { isMuted, playSound, setMuted, subscribeMuted } from '@/lib/sound'
import { cn } from '@/lib/utils'
import { usePlanner } from '@/store'

interface TopBarProps {
  /** Opens the wizard for a new project (from the project menu). */
  onNewFloor: () => void
  onOpenFactoryProperties: () => void
  onOpenHelp: () => void
}

export function TopBar({ onNewFloor, onOpenFactoryProperties, onOpenHelp }: TopBarProps) {
  const floorplan = usePlanner((s) => s.floorplan)

  return (
    <header className="theme-chrome planner-topbar relative z-10 col-span-3 flex h-14 items-center gap-6 border-b bg-card px-4 shadow-soft">
      <div className="flex items-center gap-3">
        <span className="h-6 w-1 bg-accent" aria-hidden />
        <h1 className="text-sm font-semibold tracking-widest uppercase">Factory Planner</h1>
      </div>

      {floorplan && <ProjectSwitcher onNewProject={onNewFloor} />}
      {floorplan && (
        <button
          type="button"
          onClick={onOpenFactoryProperties}
          aria-label="Open factory properties"
          title="Edit factory dimensions"
          className="whitespace-nowrap rounded-md px-2 py-1 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {formatMetres(floorplan.width)} × {formatMetres(floorplan.depth)} × {formatMetres(floorplan.height ?? DEFAULT_FACTORY_HEIGHT_MM)} m
        </button>
      )}
      {floorplan && <GoalCounter />}

      <SoundToggle />
      <button
        type="button"
        onClick={onOpenHelp}
        aria-label="Help"
        title="Show Factory Planner instructions"
        className="inline-flex shrink-0 items-center gap-2 rounded-md border bg-card px-3 py-1.5 text-sm text-foreground shadow-soft transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <CircleHelp className="size-4" aria-hidden />
        Help
      </button>
    </header>
  )
}

/** Turns the game sounds on or off; remembered in this browser. */
function SoundToggle() {
  const muted = useSyncExternalStore(subscribeMuted, isMuted)
  const Icon = muted ? VolumeX : Volume2
  return (
    <button
      type="button"
      onClick={() => {
        setMuted(!muted)
        if (muted) playSound('pick')
      }}
      aria-pressed={!muted}
      aria-label={muted ? 'Turn sounds on' : 'Turn sounds off'}
      title={muted ? 'Sounds off: click to turn on' : 'Sounds on: click to mute'}
      className="ml-auto grid size-8 shrink-0 place-items-center rounded-full border bg-card text-foreground shadow-soft transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <Icon className={cn('size-4', muted && 'text-muted-foreground')} aria-hidden />
    </button>
  )
}

function formatMetres(mm: number) {
  return String(Number((mm / 1000).toFixed(2)))
}
