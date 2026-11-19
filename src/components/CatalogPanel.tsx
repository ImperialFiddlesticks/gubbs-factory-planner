import { PanelHeading } from '@/components/PanelHeading'
import { UTILITY_ICONS } from '@/components/utilityIcons'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { CATALOG } from '@/data/catalog'
import { EXIT_MAX_DISTANCE, UTILITY_LIST, type UtilityKindInfo } from '@/data/utilities'
import { cn } from '@/lib/utils'
import { usePlanner } from '@/store'
import type { MachineType } from '@/types'

const metres = (mm: number) => `${mm / 1000}`

const cardClass =
  'w-full rounded-md border bg-card p-3 text-left transition-colors hover:border-accent focus-visible:border-ring focus-visible:outline-none'
const activeClass = 'border-accent ring-2 ring-accent/40'

export function CatalogPanel() {
  return (
    <aside className="theme-dark overflow-y-auto border-r p-4">
      <PanelHeading>Machines</PanelHeading>
      <p className="mb-3 text-xs text-muted-foreground">
        Pick an item, then click the floor to place it.
      </p>
      <ul className="space-y-2">
        {CATALOG.map((type) => (
          <li key={type.id}>
            <MachineItem type={type} />
          </li>
        ))}
      </ul>

      <Separator className="my-5" />

      <PanelHeading>Utilities</PanelHeading>
      <ul className="space-y-2">
        {UTILITY_LIST.map((info) => (
          <li key={info.kind}>
            <UtilityItem info={info} />
          </li>
        ))}
      </ul>
    </aside>
  )
}

function MachineItem({ type }: { type: MachineType }) {
  const startPlacing = usePlanner((s) => s.startPlacingMachine)
  const active = usePlanner((s) => s.placing?.kind === 'machine' && s.placing.typeId === type.id)

  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={() => startPlacing(type.id)}
      className={cn(cardClass, active && activeClass)}
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

function UtilityItem({ info }: { info: UtilityKindInfo }) {
  const startPlacing = usePlanner((s) => s.startPlacingUtility)
  const active = usePlanner((s) => s.placing?.kind === 'utility' && s.placing.utilityKind === info.kind)
  const Icon = UTILITY_ICONS[info.kind]

  const detail =
    info.kind === 'exit'
      ? `On a wall · machines within ${EXIT_MAX_DISTANCE / 1000} m`
      : [
          `Reach ${metres(info.defaultRadius ?? 0)} m`,
          info.defaultCapacityKw !== undefined && `${info.defaultCapacityKw} kW`,
        ]
          .filter(Boolean)
          .join(' · ')

  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={() => startPlacing(info.kind)}
      className={cn(cardClass, 'flex items-center gap-3 py-2', active && activeClass)}
    >
      <span
        className="flex size-7 shrink-0 items-center justify-center rounded-full text-white"
        style={{ backgroundColor: info.colour }}
      >
        <Icon className="size-4" />
      </span>
      <span>
        <span className="block text-sm font-medium">{info.name}</span>
        <span className="block text-xs text-muted-foreground">{detail}</span>
      </span>
    </button>
  )
}
