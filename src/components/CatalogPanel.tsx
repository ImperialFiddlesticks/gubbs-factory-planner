import { useState } from 'react'
import { ChevronRight } from 'lucide-react'
import { CommitInput } from '@/components/CommitInput'
import { PanelHeading } from '@/components/PanelHeading'
import { UTILITY_ICONS } from '@/components/utilityIcons'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { CATALOG, getMachineType } from '@/data/catalog'
import { EQUIPMENT_CATEGORIES, type EquipmentCategoryId } from '@/data/categories'
import { isValidConveyorLength } from '@/data/conveyors'
import { DEFAULT_PILLAR_SIZE, DEFAULT_WALL_THICKNESS } from '@/data/structures'
import { ZONE_KIND_LIST, type ZoneKindInfo } from '@/data/zones'
import { EXIT_MAX_DISTANCE, UTILITY_LIST, type UtilityKindInfo } from '@/data/utilities'
import { cn } from '@/lib/utils'
import { usePlanner } from '@/store'
import type { MachineType } from '@/types'

const metres = (mm: number) => `${mm / 1000}`

const cardClass =
  'w-full rounded-md border bg-card p-3 text-left transition-colors hover:border-accent focus-visible:border-ring focus-visible:outline-none'
const activeClass = 'border-accent ring-2 ring-accent/40'

export function CatalogPanel({
  collapsed,
  onToggle,
}: {
  collapsed: boolean
  onToggle: () => void
}) {
  const [query, setQuery] = useState('')
  const picked = usePlanner((s) => s.setup.categories)
  /** Categories opened or closed by hand; otherwise the ones picked in the wizard start open. */
  const [openState, setOpenState] = useState<Partial<Record<EquipmentCategoryId, boolean>>>({})
  const normalizedQuery = query.trim().toLowerCase()
  const matches = (...terms: string[]) =>
    !normalizedQuery || terms.some((term) => term.toLowerCase().includes(normalizedQuery))
  // One group per category: the ones picked in the wizard first, then the rest in their usual order.
  const groups = [
    ...EQUIPMENT_CATEGORIES.filter((c) => picked.includes(c.id)),
    ...EQUIPMENT_CATEGORIES.filter((c) => !picked.includes(c.id)),
  ]
    .map((category) => ({
      category,
      types: CATALOG.filter(
        (t) =>
          t.category === category.id &&
          matches(t.name, t.shortName, category.name, t.id, `${t.width} ${t.depth} ${t.powerKw}`),
      ),
    }))
    .filter((g) => g.types.length > 0)
  const isOpen = (id: EquipmentCategoryId) => Boolean(normalizedQuery) || (openState[id] ?? picked.includes(id))
  const machineCount = groups.reduce((sum, g) => sum + g.types.length, 0)
  const visibleUtilities = UTILITY_LIST.filter((info) => matches(info.name, info.kind))
  const showPillar = matches('pillar', 'structure')
  const showWall = matches('wall', 'structure')
  const visibleZones = ZONE_KIND_LIST.filter((info) => matches(info.name, 'zone', 'area', info.description))
  const showStructures = showPillar || showWall || visibleZones.length > 0

  if (collapsed) {
    return (
      <aside className="theme-dark flex flex-col items-center border-r py-2">
        <button
          type="button"
          onClick={onToggle}
          aria-label="Expand equipment library"
          title="Expand equipment library"
          className="flex size-9 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <ChevronRight className="size-4" aria-hidden />
        </button>
      </aside>
    )
  }

  return (
    <aside className="theme-dark overflow-y-auto border-r p-4">
      <div className="flex items-center justify-between gap-2">
        <PanelHeading>Equipment library</PanelHeading>
        <button
          type="button"
          onClick={onToggle}
          aria-label="Collapse equipment library"
          title="Collapse equipment library"
          className="flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <ChevronRight className="size-4 rotate-180" aria-hidden />
        </button>
      </div>
      <label className="sr-only" htmlFor="equipment-search">Search equipment</label>
      <Input
        id="equipment-search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search equipment…"
        className="mt-2 mb-3 h-8"
      />
      <p className="mb-3 text-xs text-muted-foreground">
        Pick an item, then click the floor. The cursor preview shows its working clearance.
      </p>
      {groups.length > 0 && <PanelHeading>{normalizedQuery ? `Equipment (${machineCount})` : 'Equipment'}</PanelHeading>}
      <div className="space-y-1">
        {groups.map(({ category, types }) => {
          const open = isOpen(category.id)
          return (
            <section key={category.id}>
              <button
                type="button"
                aria-expanded={open}
                onClick={() => setOpenState((prev) => ({ ...prev, [category.id]: !open }))}
                disabled={Boolean(normalizedQuery)}
                className="flex w-full items-center gap-1.5 rounded-sm py-1.5 text-left text-sm font-medium hover:text-foreground disabled:cursor-default"
              >
                <ChevronRight
                  className={cn('size-4 shrink-0 text-muted-foreground transition-transform', open && 'rotate-90')}
                  aria-hidden
                />
                <span className="flex-1">{category.name}</span>
                <span className="text-xs text-muted-foreground tabular-nums">{types.length}</span>
              </button>
              {open && (
                <div className="mt-1 mb-3">
                  <MachineList types={types} />
                </div>
              )}
            </section>
          )
        })}
      </div>

      {showStructures ? <Separator className="my-5" /> : null}

      {showStructures && (
        <>
          <PanelHeading>Structures</PanelHeading>
          <div className="space-y-2">
            {showPillar && <PillarItem />}
            {showWall && <WallItem />}
            {visibleZones.map((info) => (
              <ZoneItem key={info.kind} info={info} />
            ))}
          </div>
        </>
      )}

      {visibleUtilities.length > 0 ? <Separator className="my-5" /> : null}

      {visibleUtilities.length > 0 && (
        <>
          <PanelHeading>Utilities</PanelHeading>
          <ul className="space-y-2">
            {visibleUtilities.map((info) => (
              <li key={info.kind}>
                <UtilityItem info={info} />
              </li>
            ))}
          </ul>
        </>
      )}
      {groups.length === 0 && !showStructures && visibleUtilities.length === 0 && (
        <p className="text-xs text-muted-foreground">No equipment matches “{query}”.</p>
      )}
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

  if (getMachineType(type.id)?.conveyor === 'straight') return <BeltItem type={type} active={active} />

  return (
    <button
      type="button"
      aria-pressed={active}
      title={type.name}
      onClick={() => startPlacing(type.id)}
      className={cn(cardClass, active && activeClass)}
    >
      <div className="flex items-start gap-2">
        <MachineGlyph typeId={type.id} />
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium">{shortCatalogName(type.id)}</span>
          <span className="mt-1 block text-xs text-muted-foreground">
            {metres(type.width)} × {metres(type.depth)} m · {type.powerKw} kW
          </span>
          {active && <Badge className="mt-2">Placing</Badge>}
        </span>
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

/**
 * Straight belt: the card places it, and the length field below sets the length of the next
 * belt (and of the one being placed). The field sits outside the button, so typing doesn't place.
 */
function BeltItem({ type, active }: { type: MachineType; active: boolean }) {
  const startPlacing = usePlanner((s) => s.startPlacingMachine)
  const length = usePlanner((s) => s.conveyorLength)
  const setLength = usePlanner((s) => s.setConveyorLength)

  return (
    <div className={cn(cardClass, 'p-0', active && activeClass)}>
      <button
        type="button"
        aria-pressed={active}
        title={type.name}
        onClick={() => startPlacing(type.id)}
        className="flex w-full items-start gap-2 px-3 pt-2 pb-1 text-left"
      >
        <MachineGlyph typeId={type.id} />
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium">{shortCatalogName(type.id)}</span>
          <span className="mt-1 block text-xs text-muted-foreground">
            {metres(type.depth)} m wide · 0.25 kW per m
          </span>
          {active && <Badge className="mt-2">Placing</Badge>}
        </span>
      </button>
      <div className="flex items-center gap-2 px-3 pt-1 pb-2">
        <label htmlFor="belt-length" className="text-xs text-muted-foreground">
          Length
        </label>
        <CommitInput
          id="belt-length"
          className="h-7 w-16 text-xs"
          min={1}
          max={30}
          step={0.5}
          value={length / 1000}
          isValid={(m) => isValidConveyorLength(m * 1000)}
          onCommit={(m) => setLength(Math.round(m * 1000))}
        />
        <span className="text-xs text-muted-foreground">m</span>
      </div>
    </div>
  )
}

/** The catalog list's name for a type: its short name (the full name is the tooltip). */
function shortCatalogName(typeId: string) {
  const type = getMachineType(typeId)
  return type?.shortName ?? type?.name ?? typeId
}

function MachineGlyph({ typeId }: { typeId: string }) {
  return (
    <svg viewBox="0 0 32 32" className="size-9 shrink-0" aria-hidden>
      {typeId.startsWith('conveyor') ? (
        <>
          <rect x="2" y="9" width="28" height="14" rx="2" fill="var(--saab-grey-500)" stroke="var(--saab-blue-dark)" />
          <path d="M5 11h22v10H5z" fill="var(--saab-charcoal-600)" />
          <path d="M10 12v8M16 12v8M22 12v8" stroke="white" opacity="0.6" />
        </>
      ) : (
        <>
          <rect x="3" y="3" width="26" height="26" rx="3" fill="var(--saab-blue)" stroke="var(--saab-blue-dark)" />
          {typeId === 'cnc-mill' || typeId === 'cnc-lathe' ? (
            <>
              <circle cx="18" cy="15" r="5" fill="none" stroke="white" strokeWidth="1.5" />
              <rect x="6" y="7" width="4" height="8" fill="white" opacity="0.8" />
              <path d="M6 24h20" stroke="white" strokeWidth="1.5" />
            </>
          ) : typeId === 'hydraulic-press' ? (
            <>
              <path d="M8 9h16M11 9v13h10V9M8 23h16" fill="none" stroke="white" strokeWidth="1.5" />
            </>
          ) : typeId === 'air-compressor' ? (
            <>
              <circle cx="12" cy="14" r="4" fill="none" stroke="white" strokeWidth="1.5" />
              <circle cx="21" cy="14" r="4" fill="none" stroke="white" strokeWidth="1.5" />
              <path d="M8 23h16" stroke="white" strokeWidth="1.5" />
            </>
          ) : (
            <>
              <rect x="7" y="8" width="18" height="15" fill="none" stroke="white" strokeWidth="1.5" />
              <path d="M7 18h18" stroke="white" strokeWidth="1.5" />
            </>
          )}
        </>
      )}
    </svg>
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
        {active && <Badge className="mt-1">Placing</Badge>}
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
        {active && <Badge className="mt-1">Drawing</Badge>}
      </span>
    </button>
  )
}

/** A zone type to draw: press and drag on the floor. */
function ZoneItem({ info }: { info: ZoneKindInfo }) {
  const startPlacing = usePlanner((s) => s.startPlacingZone)
  const active = usePlanner((s) => s.placing?.kind === 'zone' && s.placing.zoneKind === info.kind)

  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={() => startPlacing(info.kind)}
      className={cn(cardClass, 'flex items-center gap-3 py-2', active && activeClass)}
    >
      {/* Mini zone: tinted square with its border style (aisles hatched). */}
      <span
        className="size-7 shrink-0 rounded-[3px] border-2"
        style={{
          borderColor: info.colour,
          borderStyle: info.kind === 'area' ? 'solid' : 'dashed',
          backgroundColor: `${info.colour}26`,
          backgroundImage:
            info.kind === 'aisle'
              ? `repeating-linear-gradient(135deg, ${info.colour}99 0 1px, transparent 1px 5px)`
              : undefined,
        }}
        aria-hidden
      />
      <span>
        <span className="block text-sm font-medium">{info.kind === 'area' ? 'Zone' : info.name}</span>
        <span className="block text-xs text-muted-foreground">{info.description} · drag to draw</span>
        {active && <Badge className="mt-1">Drawing</Badge>}
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
        {active && <Badge className="mt-1">Placing</Badge>}
      </span>
    </button>
  )
}
