import { useMemo } from 'react'
import { CommitInput } from '@/components/CommitInput'
import { PanelHeading } from '@/components/PanelHeading'
import { UTILITY_ICONS } from '@/components/utilityIcons'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { getMachineType } from '@/data/catalog'
import { EXIT_MAX_DISTANCE, UTILITY_KINDS, utilityRadius } from '@/data/utilities'
import { animateNodeOut } from '@/lib/animations'
import { footprint } from '@/lib/geometry'
import { cn } from '@/lib/utils'
import { findLayoutIssues, powerAssignments } from '@/lib/validation'
import { usePlanner } from '@/store'
import { CANVAS } from '@/theme'
import type { MachineInstance, Utility } from '@/types'

export function PropertiesPanel() {
  return (
    <aside className="theme-dark flex flex-col overflow-y-auto border-l p-4">
      <section>
        <PanelHeading>Properties</PanelHeading>
        <Selection />
      </section>

      <Separator className="my-6" />

      <section>
        <PanelHeading>Warnings</PanelHeading>
        <WarningsList />
      </section>
    </aside>
  )
}

function Selection() {
  const machine = usePlanner((s) => s.machines.find((m) => m.id === s.selectedId))
  const utility = usePlanner((s) => s.utilities.find((u) => u.id === s.selectedId))
  if (machine) return <MachineProperties machine={machine} />
  if (utility) return <UtilityProperties utility={utility} />
  return <p className="text-sm text-muted-foreground">Nothing selected</p>
}

function WarningsList() {
  const machines = usePlanner((s) => s.machines)
  const utilities = usePlanner((s) => s.utilities)
  const floorplan = usePlanner((s) => s.floorplan)
  const selectedId = usePlanner((s) => s.selectedId)
  const select = usePlanner((s) => s.select)

  const issues = useMemo(
    () => (floorplan ? findLayoutIssues(machines, utilities, floorplan) : []),
    [machines, utilities, floorplan],
  )

  if (issues.length === 0) {
    return (
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <span className="size-2 rounded-full" style={{ backgroundColor: CANVAS.valid }} />
        No problems
      </p>
    )
  }

  return (
    <ul className="space-y-1.5">
      {issues.map((issue) => {
        const active = selectedId !== null && issue.ids.includes(selectedId)
        return (
          <li key={issue.key}>
            <button
              type="button"
              disabled={issue.ids.length === 0}
              onClick={() => select(issue.ids[0])}
              className={cn(
                'flex w-full items-start gap-2 rounded-md border border-transparent p-2 text-left text-sm transition-colors enabled:hover:border-border',
                active && 'border-destructive/60 bg-destructive/10',
              )}
            >
              {/* Red: machines clash. Orange: a utility is missing or overloaded. */}
              <span
                className="mt-1.5 size-2 shrink-0 rounded-full"
                style={{ backgroundColor: issue.category === 'space' ? CANVAS.error : CANVAS.warning }}
              />
              {issue.message}
            </button>
          </li>
        )
      })}
    </ul>
  )
}

function MachineProperties({ machine }: { machine: MachineInstance }) {
  const moveMachine = usePlanner((s) => s.moveMachine)
  const rotateMachine = usePlanner((s) => s.rotateMachine)
  const removeMachine = usePlanner((s) => s.removeMachine)

  const type = getMachineType(machine.typeId)
  if (!type) return null
  const size = footprint(type, machine.rotation)

  return (
    <div className="space-y-4">
      <div>
        <div className="text-sm font-medium">{type.name}</div>
        <div className="mt-1 text-xs text-muted-foreground">
          {size.width / 1000} × {size.depth / 1000} m · rotated {machine.rotation}° ·{' '}
          {type.powerKw} kW
        </div>
      </div>

      <PositionFields
        id={machine.id}
        x={machine.x}
        y={machine.y}
        onMove={(x, y) => moveMachine(machine.id, x, y)}
      />
      <p className="text-xs text-muted-foreground">Position is the machine's centre.</p>

      <div className="flex gap-2">
        <Button variant="secondary" className="flex-1" onClick={() => rotateMachine(machine.id)}>
          Rotate 90°
        </Button>
        <Button
          variant="destructive"
          className="flex-1"
          onClick={() => animateNodeOut(machine.id, () => removeMachine(machine.id))}
        >
          Delete
        </Button>
      </div>
    </div>
  )
}

function UtilityProperties({ utility }: { utility: Utility }) {
  const moveUtility = usePlanner((s) => s.moveUtility)
  const updateUtility = usePlanner((s) => s.updateUtility)
  const removeUtility = usePlanner((s) => s.removeUtility)
  const machines = usePlanner((s) => s.machines)
  const utilities = usePlanner((s) => s.utilities)

  const info = UTILITY_KINDS[utility.kind]
  const Icon = UTILITY_ICONS[utility.kind]
  const load = useMemo(
    () =>
      utility.kind === 'power' ? (powerAssignments(machines, utilities).loads.get(utility.id) ?? 0) : 0,
    [utility.kind, utility.id, machines, utilities],
  )
  const overloaded = utility.capacityKw !== undefined && load > utility.capacityKw

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <span
          className="flex size-7 shrink-0 items-center justify-center rounded-full text-white"
          style={{ backgroundColor: info.colour }}
        >
          <Icon className="size-4" />
        </span>
        <div className="text-sm font-medium">{info.name}</div>
      </div>

      <PositionFields
        id={utility.id}
        x={utility.x}
        y={utility.y}
        onMove={(x, y) => moveUtility(utility.id, x, y)}
      />
      {utility.kind === 'exit' && (
        <p className="text-xs text-muted-foreground">
          Exits stay on the wall. Machines should be within {EXIT_MAX_DISTANCE / 1000} m.
        </p>
      )}

      {utility.kind !== 'exit' && (
        <div className="grid grid-cols-2 gap-3">
          <Field id="utility-radius" label="Reach (m)">
            <CommitInput
              id="utility-radius"
              className="h-8"
              min={0}
              step={0.5}
              value={utilityRadius(utility) / 1000}
              isValid={(m) => m > 0}
              onCommit={(m) => updateUtility(utility.id, { radius: Math.round(m * 1000) })}
            />
          </Field>
          {utility.kind === 'power' && (
            <Field id="utility-capacity" label="Capacity (kW)">
              <CommitInput
                id="utility-capacity"
                className="h-8"
                min={0}
                value={utility.capacityKw ?? 0}
                isValid={(kw) => kw > 0}
                onCommit={(kw) => updateUtility(utility.id, { capacityKw: kw })}
              />
            </Field>
          )}
        </div>
      )}

      {utility.kind === 'power' && (
        <p className={cn('text-xs', overloaded ? 'text-destructive' : 'text-muted-foreground')}>
          Load: {load} of {utility.capacityKw ?? 0} kW
          {overloaded && ' (overloaded)'}
        </p>
      )}

      <Button
        variant="destructive"
        className="w-full"
        onClick={() => animateNodeOut(utility.id, () => removeUtility(utility.id))}
      >
        Delete
      </Button>
    </div>
  )
}

function PositionFields({
  id,
  x,
  y,
  onMove,
}: {
  id: string
  x: number
  y: number
  onMove: (x: number, y: number) => void
}) {
  // key by item so switching selection resets the fields
  return (
    <div key={id} className="grid grid-cols-2 gap-3">
      <Field id="pos-x" label="X (mm)">
        <CommitInput id="pos-x" className="h-8" value={x} onCommit={(v) => onMove(Math.round(v), y)} />
      </Field>
      <Field id="pos-y" label="Y (mm)">
        <CommitInput id="pos-y" className="h-8" value={y} onCommit={(v) => onMove(x, Math.round(v))} />
      </Field>
    </div>
  )
}

function Field({ id, label, children }: { id: string; label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-xs text-muted-foreground">
        {label}
      </Label>
      {children}
    </div>
  )
}
