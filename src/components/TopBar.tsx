import { Button } from '@/components/ui/button'
import { GoalCounter } from '@/components/GoalCounter'
import { ProjectSwitcher } from '@/components/ProjectSwitcher'
import { DEFAULT_FACTORY_HEIGHT_MM } from '@/data/defaults'
import { CircleHelp } from 'lucide-react'
import { usePlanner } from '@/store'

interface TopBarProps {
  /** Opens the wizard for a new project (from the project menu). */
  onNewFloor: () => void
  onOpenSimulation: () => void
  onOpenFactoryProperties: () => void
  onOpenHelp: () => void
}

export function TopBar({
  onNewFloor,
  onOpenSimulation,
  onOpenFactoryProperties,
  onOpenHelp
}: TopBarProps) {
  const floorplan = usePlanner((s) => s.floorplan)

  return (
    <header className="theme-dark planner-topbar col-span-3 flex h-14 items-center gap-6 border-b px-4">
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
          className="whitespace-nowrap rounded-md px-2 py-1 text-sm font-medium text-muted-foreground transition-colors hover:bg-white/10 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {formatMetres(floorplan.width)} × {formatMetres(floorplan.depth)} × {formatMetres(floorplan.height ?? DEFAULT_FACTORY_HEIGHT_MM)} m
        </button>
      )}

      {floorplan && <GoalCounter />}

      {floorplan && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onOpenSimulation}
        >
          3D &amp; simulation
        </Button>
      )}

      <button
        type="button"
        onClick={onOpenHelp}
        aria-label="Help"
        title="Show Factory Planner instructions"
        className="ml-auto inline-flex shrink-0 items-center gap-2 rounded-md border border-white/15 bg-white/5 px-3 py-1.5 text-sm text-foreground transition-colors hover:border-white/30 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <CircleHelp className="size-4" aria-hidden />
        Help
      </button>
    </header>
  )
}

function formatMetres(mm: number) {
  return String(Number((mm / 1000).toFixed(2)))
}