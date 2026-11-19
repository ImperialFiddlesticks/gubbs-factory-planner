import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { DEFAULT_FLOORPLAN } from '@/data/defaults'
import { usePlanner } from '@/store'

interface NewFloorDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** First run: there is no floor yet, so the dialog cannot be dismissed. */
  required: boolean
}

export function NewFloorDialog({ open, onOpenChange, required }: NewFloorDialogProps) {
  const newFloorplan = usePlanner((s) => s.newFloorplan)
  const machineCount = usePlanner((s) => s.machines.length)

  const [name, setName] = useState(DEFAULT_FLOORPLAN.name)
  const [widthM, setWidthM] = useState(String(DEFAULT_FLOORPLAN.width / 1000))
  const [depthM, setDepthM] = useState(String(DEFAULT_FLOORPLAN.depth / 1000))
  const [gridMm, setGridMm] = useState(String(DEFAULT_FLOORPLAN.gridSize))

  const width = Number(widthM) * 1000
  const depth = Number(depthM) * 1000
  const gridSize = Number(gridMm)
  const error =
    !name.trim()
      ? 'Give the floor a name.'
      : !(width > 0 && depth > 0)
        ? 'Width and depth must be greater than 0.'
        : !(gridSize > 0)
          ? 'Grid size must be greater than 0.'
          : gridSize > Math.min(width, depth)
            ? 'Grid size must be smaller than the floor.'
            : null

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (error) return
    newFloorplan({ name: name.trim(), width, depth, gridSize })
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={required ? undefined : onOpenChange}>
      <DialogContent
        showCloseButton={!required}
        onEscapeKeyDown={(e) => required && e.preventDefault()}
        onInteractOutside={(e) => required && e.preventDefault()}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>New factory floor</DialogTitle>
            <DialogDescription>
              Enter the size of the floor you are planning.
            </DialogDescription>
          </DialogHeader>

          <Field id="floor-name" label="Name">
            <Input id="floor-name" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          </Field>
          <div className="grid grid-cols-3 gap-3">
            <Field id="floor-width-new" label="Width (m)">
              <Input id="floor-width-new" type="number" min={0} step={0.5} value={widthM} onChange={(e) => setWidthM(e.target.value)} />
            </Field>
            <Field id="floor-depth-new" label="Depth (m)">
              <Input id="floor-depth-new" type="number" min={0} step={0.5} value={depthM} onChange={(e) => setDepthM(e.target.value)} />
            </Field>
            <Field id="floor-grid-new" label="Grid (mm)">
              <Input id="floor-grid-new" type="number" min={0} step={50} value={gridMm} onChange={(e) => setGridMm(e.target.value)} />
            </Field>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
          {!required && machineCount > 0 && (
            <p className="text-sm text-muted-foreground">
              This replaces the current floor and removes its {machineCount}{' '}
              {machineCount === 1 ? 'machine' : 'machines'}.
            </p>
          )}

          <DialogFooter>
            {!required && (
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
            )}
            <Button type="submit" disabled={!!error}>
              Create floor
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function Field({ id, label, children }: { id: string; label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  )
}
