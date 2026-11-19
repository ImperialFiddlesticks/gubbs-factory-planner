import { PanelHeading } from '@/components/PanelHeading'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'

// Static for now: fields are disabled until the store is wired up.
export function PropertiesPanel() {
  return (
    <aside className="theme-dark flex flex-col overflow-y-auto border-l p-4">
      <section>
        <PanelHeading>Properties</PanelHeading>
        <p className="mb-4 text-sm text-muted-foreground">No machine selected</p>

        <div className="grid grid-cols-2 gap-3">
          <Field id="machine-x" label="X (mm)" />
          <Field id="machine-y" label="Y (mm)" />
        </div>

        <div className="mt-4 flex gap-2">
          <Button variant="secondary" className="flex-1" disabled>
            Rotate 90°
          </Button>
          <Button variant="destructive" className="flex-1" disabled>
            Delete
          </Button>
        </div>
      </section>

      <Separator className="my-6" />

      <section>
        <PanelHeading>Warnings</PanelHeading>
        <p className="text-sm text-muted-foreground">None yet</p>
      </section>
    </aside>
  )
}

function Field({ id, label }: { id: string; label: string }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-xs text-muted-foreground">
        {label}
      </Label>
      <Input id={id} type="number" disabled className="h-8" />
    </div>
  )
}
