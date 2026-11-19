import { PanelHeading } from '@/components/PanelHeading'
import { Badge } from '@/components/ui/badge'
import { CATALOG } from '@/data/catalog'
import type { MachineType } from '@/types'

const metres = (mm: number) => `${mm / 1000}`

export function CatalogPanel() {
  return (
    <aside className="theme-dark overflow-y-auto border-r p-4">
      <PanelHeading>Catalog</PanelHeading>
      <ul className="space-y-2">
        {CATALOG.map((type) => (
          <li key={type.id}>
            <CatalogItem type={type} />
          </li>
        ))}
      </ul>
    </aside>
  )
}

function CatalogItem({ type }: { type: MachineType }) {
  return (
    <button
      type="button"
      className="w-full rounded-md border bg-card p-3 text-left transition-colors hover:border-accent focus-visible:border-ring focus-visible:outline-none"
    >
      <div className="text-sm font-medium">{type.name}</div>
      <div className="mt-1 text-xs text-muted-foreground">
        {metres(type.width)} × {metres(type.depth)} m · {type.powerKw} kW
      </div>
      {(type.needsWater || type.needsFireSuppression) && (
        <div className="mt-2 flex gap-1">
          {type.needsWater && <Badge variant="secondary">Water</Badge>}
          {type.needsFireSuppression && <Badge variant="secondary">Fire suppression</Badge>}
        </div>
      )}
    </button>
  )
}
