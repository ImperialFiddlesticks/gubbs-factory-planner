import { ChevronRight } from 'lucide-react'
import { PanelHeading } from '@/components/PanelHeading'
import { UTILITY_ICONS } from '@/components/utilityIcons'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { CATALOG } from '@/data/catalog'
import { DEFAULT_PILLAR_SIZE, DEFAULT_WALL_THICKNESS } from '@/data/structures'
import { EXIT_MAX_DISTANCE, UTILITY_LIST, type UtilityKindInfo } from '@/data/utilities'
import { cn } from '@/lib/utils'
import { usePlanner } from '@/store'
import type { MachineType } from '@/types'

const metres = (mm: number) => `${mm / 1000}`

const cardClass =
  'w-full rounded-md border bg-card p-3 text-left transition-colors hover:border-accent focus-visible:border-ring focus-visible:outline-none'
const activeClass = 'border-accent ring-2 ring-accent/40'

export function CatalogPanel() {
  const categories = usePlanner((s) => s.setup.categories)
  // Machines from the categories picked in the wizard come first; the rest are tucked away.
  // With no categories picked, everything is shown as one list.
  const mine = categories.length
    ? CATALOG.filter((t) => categories.includes(t.category))
    : CATALOG
  const other = CATALOG.filter((t) => !mine.includes(t))

  return (
    <aside className="theme-dark overflow-y-auto border-r p-4">
      <PanelHeading>{categories.length ? 'Your equipment' : 'Machines'}</PanelHeading>
      <p className="mb-3 text-xs text-muted-foreground">
        Pick an item, then click the floor to place it.
      </p>
      <MachineList types={mine} />

      {other.length > 0 && (
        <details className="group mt-4">
          <summary className="flex cursor-pointer list-none items-center gap-1 text-xs font-semibold tracking-widest text-muted-foreground uppercase hover:text-foreground [&::-webkit-details-marker]:hidden">
            <ChevronRight className="size-4 transition-transform group-open:rotate-90" aria-hidden />
            Other equipment ({other.length})
          </summary>
          <div className="mt-3">
            <MachineList types={other} />
          </div>
        </details>
      )}

      <Separator className="my-5" />

      <PanelHeading>Structures</PanelHeading>
      <div className="space-y-2">
        <PillarItem />
        <WallItem />
      </div>

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

function MachineList({ types }: { types: MachineType[] }) {
  return (
    <ul className="space-y-2">
      {types.map((type) => (
        <li key={type.id}>
          <MachineItem type={type} />
        </li>
      ))}
    </ul>
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

function PillarItem() {
  const startPlacing = usePlanner((s) => s.startPlacingPillar)
  const active = usePlanner((s) => s.placing?.kind === 'pillar')
  const size = metres(DEFAULT_PILLAR_SIZE)

  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={startPlacing}
      className={cn(cardClass, 'flex items-center gap-3 py-2', active && activeClass)}
    >
      {/* Mini hatched block, matching the pillar on the canvas. */}
      <span
        className="size-7 shrink-0 rounded-[2px] border border-(--saab-charcoal-900)"
        style={{
          backgroundColor: 'var(--saab-charcoal-500)',
          backgroundImage:
            'repeating-linear-gradient(135deg, var(--saab-charcoal-900) 0 1px, transparent 1px 5px)',
        }}
        aria-hidden
      />
      <span>
        <span className="block text-sm font-medium">Pillar</span>
        <span className="block text-xs text-muted-foreground">
          {size} × {size} m · size editable
        </span>
      </span>
    </button>
  )
}

function WallItem() {
  const startPlacing = usePlanner((s) => s.startPlacingWall)
  const active = usePlanner((s) => s.placing?.kind === 'wall')

  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={startPlacing}
      className={cn(cardClass, 'flex items-center gap-3 py-2', active && activeClass)}
    >
      {/* Mini wall bar, matching the wall on the canvas. */}
      <span className="flex size-7 shrink-0 items-center" aria-hidden>
        <span className="h-1.5 w-full rounded-[1px] bg-(--saab-charcoal) ring-1 ring-(--saab-grey-500)" />
      </span>
      <span>
        <span className="block text-sm font-medium">Wall</span>
        <span className="block text-xs text-muted-foreground">
          Click start and end · {metres(DEFAULT_WALL_THICKNESS)} m thick
        </span>
      </span>
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
      : info.kind === 'extinguisher'
        ? `Machines within ${metres(info.defaultRadius ?? 0)} m walk`
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
