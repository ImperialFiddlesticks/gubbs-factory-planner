import { CommitInput } from '@/components/CommitInput'
import { GoalCounter } from '@/components/GoalCounter'
import { ProjectSwitcher } from '@/components/ProjectSwitcher'
import { Label } from '@/components/ui/label'
import { usePlanner } from '@/store'

interface TopBarProps {
  /** Opens the wizard for a new project (from the project menu). */
  onNewFloor: () => void
}

export function TopBar({ onNewFloor }: TopBarProps) {
  const floorplan = usePlanner((s) => s.floorplan)
  const setFloorplan = usePlanner((s) => s.setFloorplan)

  return (
    <header className="theme-dark col-span-3 flex items-center gap-6 border-b px-4">
      <div className="flex items-center gap-3">
        <span className="h-6 w-1 bg-accent" aria-hidden />
        <h1 className="text-sm font-semibold tracking-widest uppercase">Factory Planner</h1>
      </div>

      {floorplan && <ProjectSwitcher onNewProject={onNewFloor} />}
      {floorplan && <GoalCounter />}

      <div className="ml-auto flex items-center gap-6">
        {floorplan && (
          <>
            <MetresInput
              id="floor-width"
              label="Width"
              mm={floorplan.width}
              onCommit={(mm) => setFloorplan(mm, floorplan.depth)}
            />
            <MetresInput
              id="floor-depth"
              label="Depth"
              mm={floorplan.depth}
              onCommit={(mm) => setFloorplan(floorplan.width, mm)}
            />
          </>
        )}
      </div>
    </header>
  )
}

interface MetresInputProps {
  id: string
  label: string
  mm: number
  onCommit: (mm: number) => void
}

function MetresInput({ id, label, mm, onCommit }: MetresInputProps) {
  return (
    <div className="flex items-center gap-2">
      <Label htmlFor={id} className="text-muted-foreground">
        {label}
      </Label>
      <CommitInput
        id={id}
        min={0}
        step={0.5}
        value={mm / 1000}
        isValid={(m) => m > 0}
        onCommit={(m) => onCommit(Math.round(m * 1000))}
        className="h-8 w-20"
      />
      <span className="text-sm text-muted-foreground">m</span>
    </div>
  )
}
