import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { Floorplan } from '@/types'

interface TopBarProps {
  floorplan: Floorplan
}

export function TopBar({ floorplan }: TopBarProps) {
  return (
    <header className="theme-dark col-span-3 flex items-center gap-8 border-b px-4">
      <div className="flex items-center gap-3">
        <span className="h-6 w-1 bg-accent" aria-hidden />
        <h1 className="text-sm font-semibold tracking-widest uppercase">
          Factory Planner
        </h1>
      </div>

      <div className="ml-auto flex items-center gap-6">
        <DimensionInput id="floor-width" label="Width" mm={floorplan.width} />
        <DimensionInput id="floor-depth" label="Depth" mm={floorplan.depth} />
      </div>
    </header>
  )
}

function DimensionInput({ id, label, mm }: { id: string; label: string; mm: number }) {
  return (
    <div className="flex items-center gap-2">
      <Label htmlFor={id} className="text-muted-foreground">
        {label}
      </Label>
      <Input
        id={id}
        type="number"
        min={1}
        step={0.5}
        defaultValue={mm / 1000}
        className="h-8 w-20"
      />
      <span className="text-sm text-muted-foreground">m</span>
    </div>
  )
}
