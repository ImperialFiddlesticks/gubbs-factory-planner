import { useEffect, useRef, useState, type ComponentType, type CSSProperties, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import {
  Archive,
  ArrowRightLeft,
  BatteryCharging,
  BrickWall,
  ChevronDown,
  ChevronRight,
  Cog,
  Droplet,
  Factory,
  Flame,
  Footprints,
  Gauge,
  Hammer,
  LandPlot,
  ParkingSquare,
  PlugZap,
  Route,
  Shield,
  Signpost,
  SlidersHorizontal,
  Truck,
  Waves,
  Wrench,
  X,
} from 'lucide-react'
import { CommitInput } from '@/components/CommitInput'
import { PanelHeading } from '@/components/PanelHeading'
import { UTILITY_ICONS } from '@/components/utilityIcons'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { CATALOG, getMachineType, isStation } from '@/data/catalog'
import { EQUIPMENT_CATEGORIES, type EquipmentCategoryId } from '@/data/categories'
import { FORKLIFT_CATEGORY_NAMES, FORKLIFT_PRESETS } from '@/data/forkliftCatalog'
import { CATEGORY_COLOURS } from '@/data/machineColours'
import type { ForkliftCategory } from '@/types'
import { isValidConveyorLength } from '@/data/conveyors'
import { DEFAULT_PILLAR_SIZE, DEFAULT_WALL_THICKNESS } from '@/data/structures'
import { DEFAULT_LOADING_DOCK_WIDTH_MM } from '@/lib/loadingDocks'
import { ZONE_KIND_LIST, type ZoneKindInfo } from '@/data/zones'
import { EXIT_MAX_DISTANCE, UTILITY_LIST, type UtilityKindInfo } from '@/data/utilities'
import { playSound } from '@/lib/sound'
import { cn } from '@/lib/utils'
import { usePlanner } from '@/store'
import { CANVAS, COLORS, mixColours } from '@/theme'
import type { MachineType } from '@/types'

const metres = (mm: number) => `${mm / 1000}`

/** A list item: a white card that lifts on hover, like a build-mode item. */
const cardClass =
  'w-full rounded-xl border bg-card p-3 text-left shadow-soft transition-[translate,box-shadow,border-color] duration-150 hover:-translate-y-0.5 hover:border-(--warm-400) hover:shadow-lift focus-visible:border-ring focus-visible:outline-none active:translate-y-0'
const activeClass = 'border-accent ring-2 ring-accent/60 hover:border-accent'

type CatalogTab = 'machines' | 'structures' | 'zones' | 'forklifts' | 'utilities'

/** The build-mode tabs along the top of the library. */
const TABS: { id: CatalogTab; label: string; icon: ComponentType<{ className?: string }> }[] = [
  { id: 'machines', label: 'Machines', icon: Factory },
  { id: 'structures', label: 'Building', icon: BrickWall },
  { id: 'zones', label: 'Zones', icon: LandPlot },
  { id: 'forklifts', label: 'Forklifts', icon: Truck },
  { id: 'utilities', label: 'Utilities', icon: PlugZap },
]

/** One icon per equipment category, shown on the category's tiles. */
const CATEGORY_ICONS: Record<EquipmentCategoryId, ComponentType<{ className?: string; style?: CSSProperties }>> = {
  machining: Cog,
  forming: Hammer,
  welding: Flame,
  'material-handling': ArrowRightLeft,
  'assembly-packing': Wrench,
  storage: Archive,
  support: Gauge,
}

export function CatalogPanel({
  collapsed,
  highlighted = false,
  onToggle,
}: {
  collapsed: boolean
  highlighted?: boolean
  onToggle: () => void
}) {
  const [query, setQuery] = useState('')
  const [tab, setTab] = useState<CatalogTab>('machines')
  /** The machine category chip; 'all' shows every category, grouped. */
  const [category, setCategory] = useState<EquipmentCategoryId | 'all'>('all')
  const picked = usePlanner((s) => s.setup.categories)
  /**
   * Categories opened or closed by hand; otherwise the ones picked in the wizard start open
   * (all of them when none were picked). Searching opens every category with a match.
   */
  const [openState, setOpenState] = useState<Partial<Record<EquipmentCategoryId, boolean>>>({})
  const normalizedQuery = query.trim().toLowerCase()
  /** While searching, every tab's matches are shown together. */
  const searching = Boolean(normalizedQuery)
  const show = (id: CatalogTab) => searching || tab === id
  const matches = (...terms: string[]) =>
    !normalizedQuery || terms.some((term) => term.toLowerCase().includes(normalizedQuery))
  // One group per category: the ones picked in the wizard first, then the rest in their usual order.
  const allGroups = [
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
  const groups = searching || category === 'all' ? allGroups : allGroups.filter((g) => g.category.id === category)
  const machineCount = groups.reduce((sum, g) => sum + g.types.length, 0)
  const isOpen = (id: EquipmentCategoryId) => searching || (openState[id] ?? (picked.length === 0 || picked.includes(id)))
  const visibleUtilities = UTILITY_LIST.filter((info) => matches(info.name, info.kind))
  const showPillar = matches('pillar', 'structure')
  const showWall = matches('wall', 'structure')
  const showLoadingDock = matches('loading dock', 'dock', 'structure')
  const showLoadingBay = matches('loading bay', 'bay', 'staging area', 'structure')
  const visibleZones = ZONE_KIND_LIST.filter((info) => matches(info.name, 'zone', 'area', info.description))
  const showStructures = showPillar || showWall || showLoadingDock || showLoadingBay
  const showFloorPlanning = visibleZones.length > 0 || matches('forklift route', 'truck route', 'pedestrian route', 'crossing', 'barrier')
  const showLogistics = matches('forklift', 'truck', 'parking', 'charging', 'battery', 'pedestrian', 'crossing', 'barrier', 'route')
  // Sections shown, in order; separators go between them while searching.
  const sections = [
    show('machines') && groups.length > 0,
    show('structures') && showStructures,
    show('zones') && showFloorPlanning,
    show('forklifts') && showLogistics,
    show('utilities') && visibleUtilities.length > 0,
  ]
  const nothingFound = searching && !sections.some(Boolean)

  if (collapsed) {
    return (
      <aside data-guide-target="equipment-library" className={cn(
        'theme-chrome planner-catalog is-collapsed flex flex-col items-center border-r py-2',
        highlighted && 'ring-2 ring-accent ring-offset-2 ring-offset-background',
      )}>
        <button
          type="button"
          onClick={onToggle}
          aria-label="Expand equipment library"
          title="Expand equipment library"
          aria-expanded={false}
          className="flex size-9 items-center justify-center rounded-md border bg-card text-foreground shadow-soft transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ChevronRight className="size-4" aria-hidden />
        </button>
      </aside>
    )
  }

  return (
    <aside data-guide-target="equipment-library" className={cn(
      'theme-chrome planner-catalog flex min-h-0 flex-col border-r',
      highlighted && 'ring-2 ring-accent ring-offset-2 ring-offset-background',
    )}>
      {/* Fixed head: title, search and the build-mode tabs. */}
      <div className="border-b px-4 pt-4 pb-3">
        <div className="flex items-center justify-between gap-2">
          <PanelHeading>Equipment library</PanelHeading>
          <button
            type="button"
            onClick={onToggle}
            aria-label="Collapse equipment library"
            title="Collapse equipment library"
            aria-expanded={true}
            className="flex size-8 shrink-0 items-center justify-center rounded-md border bg-card text-foreground shadow-soft transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <ChevronRight className="size-4 rotate-180" aria-hidden />
          </button>
        </div>
        <label className="sr-only" htmlFor="equipment-search">Search equipment</label>
        <Input
          id="equipment-search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search everything…"
          className="mt-2 h-8 rounded-full bg-card px-3.5"
        />
        <div role="tablist" aria-label="Library sections" className="mt-3 grid grid-cols-5 gap-1">
          {TABS.map(({ id, label, icon: Icon }) => {
            const selected = !searching && tab === id
            return (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => {
                  setTab(id)
                  setQuery('')
                }}
                className="group flex flex-col items-center gap-1 rounded-lg py-0.5 focus-visible:outline-none"
              >
                <span
                  className={cn(
                    'grid size-10 place-items-center rounded-full border-2 shadow-soft transition-[translate,background-color,border-color,box-shadow] duration-150 group-hover:-translate-y-0.5 group-hover:shadow-lift group-focus-visible:ring-2 group-focus-visible:ring-ring',
                    selected
                      ? 'border-(--saab-yellow-dark) bg-accent text-accent-foreground'
                      : 'border-card bg-card text-muted-foreground group-hover:text-foreground',
                  )}
                >
                  <Icon className="size-5" aria-hidden />
                </span>
                <span className={cn('text-[10px] leading-none font-bold', selected ? 'text-foreground' : 'text-muted-foreground')}>
                  {label}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {show('machines') && !searching && (
          <MachineFilter
            category={category}
            categories={allGroups.map((g) => g.category)}
            onChange={setCategory}
          />
        )}
        {sections[0] && (
          <>
            {searching && <PanelHeading>{`Machines (${machineCount})`}</PanelHeading>}
            <p className="mb-3 text-xs text-muted-foreground">Pick an item, then click the floor to place it.</p>
            <div className="space-y-4">
              {groups.map(({ category: c, types }) => {
                // A single filtered category has no header and is always shown.
                const grouped = searching || category === 'all'
                const open = !grouped || isOpen(c.id)
                return (
                  <section key={c.id} aria-label={c.name}>
                    {grouped && (
                      <h3>
                        <button
                          type="button"
                          aria-expanded={open}
                          onClick={() => setOpenState((prev) => ({ ...prev, [c.id]: !open }))}
                          disabled={searching}
                          title={open ? `Hide ${c.name}` : `Show ${c.name}`}
                          className={cn(
                            'flex w-full items-center gap-1.5 rounded-md py-1 text-left text-xs font-bold transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-default',
                            open ? 'mb-2' : 'text-muted-foreground',
                          )}
                        >
                          <ChevronRight
                            className={cn('size-3.5 shrink-0 text-muted-foreground transition-transform', open && 'rotate-90')}
                            aria-hidden
                          />
                          <span className="size-2.5 rounded-full" style={{ backgroundColor: CATEGORY_COLOURS[c.id] }} aria-hidden />
                          <span className="flex-1">{c.name}</span>
                          <span className="font-semibold text-muted-foreground tabular-nums">{types.length}</span>
                        </button>
                      </h3>
                    )}
                    {open && <MachineList types={types} />}
                  </section>
                )
              })}
            </div>
          </>
        )}

        {sections[1] && (
          <>
            {searching && sections.slice(0, 1).some(Boolean) && <Separator className="my-5" />}
            <PanelHeading>Structures</PanelHeading>
            <div className="space-y-2">
              {showPillar && <PillarItem />}
              {showWall && <WallItem />}
              {showLoadingDock && <LoadingDockItem />}
              {showLoadingBay && <LoadingBayItem />}
            </div>
          </>
        )}

        {sections[2] && (
          <>
            {searching && sections.slice(0, 2).some(Boolean) && <Separator className="my-5" />}
            <PanelHeading>Floor planning</PanelHeading>
            <div className="space-y-2">
              {visibleZones.map((info) => <ZoneItem key={info.kind} info={info} />)}
              <FloorPlanningTools />
            </div>
          </>
        )}

        {sections[3] && (
          <>
            {searching && sections.slice(0, 3).some(Boolean) && <Separator className="my-5" />}
            <TruckInfrastructure />
          </>
        )}

        {sections[4] && (
          <>
            {searching && sections.slice(0, 4).some(Boolean) && <Separator className="my-5" />}
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
        {nothingFound && (
          <p className="text-xs text-muted-foreground">No equipment matches “{query}”.</p>
        )}
      </div>
    </aside>
  )
}

/**
 * The machine category filter, folded behind one "Filter" button. The button shows the
 * active category (with a clear button) so a filtered list is never a surprise.
 */
function MachineFilter({
  category,
  categories,
  onChange,
}: {
  category: EquipmentCategoryId | 'all'
  categories: { id: EquipmentCategoryId; name: string }[]
  onChange: (category: EquipmentCategoryId | 'all') => void
}) {
  const [open, setOpen] = useState(false)
  const active = categories.find((c) => c.id === category)
  const pick = (next: EquipmentCategoryId | 'all') => {
    onChange(next)
    setOpen(false)
  }

  return (
    <div className="mb-3">
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          aria-expanded={open}
          aria-controls="machine-filter-options"
          onClick={() => setOpen((o) => !o)}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs leading-none font-bold shadow-soft transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            open || active ? 'border-foreground bg-foreground text-background' : 'bg-card text-foreground hover:bg-muted',
          )}
        >
          <SlidersHorizontal className="size-3.5" aria-hidden />
          Filter
          {active && <span className="size-2 rounded-full" style={{ backgroundColor: CATEGORY_COLOURS[active.id] }} aria-hidden />}
          <ChevronDown className={cn('size-3.5 transition-transform', open && 'rotate-180')} aria-hidden />
        </button>
        {active && (
          <span className="inline-flex min-w-0 items-center gap-1 rounded-full border bg-card py-1 pr-1 pl-2.5 text-[11px] leading-none font-bold">
            <span className="truncate">{active.name}</span>
            <button
              type="button"
              onClick={() => pick('all')}
              aria-label={`Clear filter ${active.name}`}
              title="Show all categories"
              className="grid size-4 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <X className="size-3" aria-hidden />
            </button>
          </span>
        )}
      </div>
      {open && (
        <div
          id="machine-filter-options"
          className="mt-2 flex flex-wrap gap-1.5 rounded-xl border bg-card p-2 shadow-soft animate-in fade-in-0 slide-in-from-top-1"
          role="radiogroup"
          aria-label="Machine category"
        >
          <CategoryChip label="All" selected={category === 'all'} onClick={() => pick('all')} />
          {categories.map((c) => (
            <CategoryChip
              key={c.id}
              label={c.name}
              colour={CATEGORY_COLOURS[c.id]}
              selected={category === c.id}
              onClick={() => pick(c.id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

/** A round filter pill for one machine category, with its colour dot. */
function CategoryChip({ label, colour, selected, onClick }: { label: string; colour?: string; selected: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] leading-none font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        selected ? 'border-foreground bg-foreground text-background' : 'bg-card text-foreground hover:bg-muted',
      )}
    >
      {colour && <span className="size-2 rounded-full" style={{ backgroundColor: colour }} aria-hidden />}
      {label}
    </button>
  )
}

/** Machines as a grid of build-mode tiles; a straight belt takes the full width for its length field. */
function MachineList({ types }: { types: MachineType[] }) {
  return (
    <ul className="grid grid-cols-2 gap-2">
      {types.map((type) => (
        <li key={type.id} className={cn(getMachineType(type.id)?.conveyor === 'straight' && 'col-span-2')}>
          <MachineItem type={type} />
        </li>
      ))}
    </ul>
  )
}

/** Base tile look: a white card with a tinted thumbnail on top. */
const tileClass =
  'group relative flex h-full w-full flex-col rounded-xl border bg-card p-1.5 text-left shadow-soft transition-[translate,box-shadow,border-color] duration-150 hover:-translate-y-0.5 hover:border-(--warm-400) hover:shadow-lift focus-visible:border-ring focus-visible:outline-none active:translate-y-0'

function MachineItem({ type }: { type: MachineType }) {
  const startPlacing = usePlanner((s) => s.startPlacingMachine)
  const active = usePlanner((s) => s.placing?.kind === 'machine' && s.placing.typeId === type.id)

  if (getMachineType(type.id)?.conveyor === 'straight') return <BeltItem type={type} active={active} />

  return (
    <InfoCardAnchor typeId={type.id}>
    <button
      type="button"
      aria-pressed={active}
      aria-label={`${type.name}, ${metres(type.width)} × ${metres(type.depth)} m`}
      onClick={() => {
        playSound('pick')
        startPlacing(type.id)
      }}
      className={cn(tileClass, active && activeClass)}
    >
      <TileThumbnail typeId={type.id} />
      <span className="mt-1.5 block truncate px-1 text-[13px] leading-tight font-bold">{shortCatalogName(type.id)}</span>
      <span className="mb-0.5 block px-1 text-[11px] text-muted-foreground">
        {metres(type.width)} × {metres(type.depth)} m
      </span>
      {active && <PlacingRibbon />}
    </button>
    </InfoCardAnchor>
  )
}

/** A small "Placing" ribbon on the tile being placed. */
function PlacingRibbon({ label = 'Placing' }: { label?: string }) {
  return (
    <span className="absolute top-2.5 left-2.5 rounded-full bg-accent px-2 py-0.5 text-[10px] font-extrabold text-accent-foreground shadow-soft">
      {label}
    </span>
  )
}

/**
 * The tile's picture: a mini top view of the card on the floor, in the item's own proportions and
 * category colour, with the category icon and the front strip. Water and fire needs sit in a corner.
 */
function TileThumbnail({ typeId, large = false }: { typeId: string; large?: boolean }) {
  const type = getMachineType(typeId)
  if (!type) return null
  const colour = CATEGORY_COLOURS[type.category]
  const Icon = CATEGORY_ICONS[type.category]
  // Fit the footprint in the thumbnail box, keeping its shape.
  const box = large ? { w: 200, h: 92 } : { w: 84, h: 46 }
  const scale = Math.min(box.w / type.width, box.h / type.depth)
  const w = Math.max(large ? 40 : 20, type.width * scale)
  const h = Math.max(large ? 30 : 16, type.depth * scale)
  const isBelt = Boolean(type.conveyor)

  return (
    <span
      className={cn('relative grid place-items-center rounded-lg transition-transform duration-200', large ? 'h-32' : 'h-16 group-hover:scale-[1.03]')}
      style={{ backgroundColor: mixColours(colour, COLORS.white, 0.9) }}
      aria-hidden
    >
      <span
        className="relative grid place-items-center rounded-md border-2 shadow-soft"
        style={{
          width: w,
          height: h,
          borderColor: colour,
          backgroundColor: mixColours(colour, COLORS.white, 0.78),
          backgroundImage: isBelt
            ? `repeating-linear-gradient(90deg, ${mixColours(colour, COLORS.white, 0.45)} 0 2px, transparent 2px 7px)`
            : undefined,
        }}
      >
        {!isBelt && <Icon className={large ? 'size-7' : 'size-4'} style={{ color: mixColours(colour, COLORS.charcoal900, 0.3) }} />}
        {/* Front strip, as on the floor card. */}
        <span className="absolute inset-x-1 bottom-0.5 h-0.75 rounded-full" style={{ backgroundColor: colour }} />
      </span>
      {(type.needsWater || type.needsFireSuppression) && (
        <span className="absolute top-1 right-1 flex gap-0.5">
          {type.needsWater && (
            <span className="grid size-4 place-items-center rounded-full bg-card shadow-soft" title="Needs water">
              <Droplet className="size-2.5 text-(--saab-blue)" />
            </span>
          )}
          {type.needsFireSuppression && (
            <span className="grid size-4 place-items-center rounded-full bg-card shadow-soft" title="Needs fire suppression">
              <Flame className="size-2.5 text-(--saab-red)" />
            </span>
          )}
        </span>
      )}
    </span>
  )
}

/** How long the pointer rests on a tile before its info card opens, ms. */
const INFO_DELAY_MS = 350

/**
 * Wraps a tile: resting the pointer on it opens a Planet Zoo-style info card beside the library,
 * with a big preview and the item's numbers. Clicking or leaving closes it.
 */
function InfoCardAnchor({ typeId, children }: { typeId: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  const timer = useRef<number | undefined>(undefined)
  const [rect, setRect] = useState<DOMRect | null>(null)
  useEffect(() => () => window.clearTimeout(timer.current), [])
  const close = () => {
    window.clearTimeout(timer.current)
    setRect(null)
  }

  return (
    <div
      ref={ref}
      className="h-full"
      onPointerEnter={(e) => {
        if (e.pointerType !== 'mouse') return
        window.clearTimeout(timer.current)
        timer.current = window.setTimeout(() => setRect(ref.current?.getBoundingClientRect() ?? null), INFO_DELAY_MS)
      }}
      onPointerLeave={close}
      onPointerDown={close}
    >
      {children}
      {rect && createPortal(<InfoCard typeId={typeId} anchor={rect} />, document.body)}
    </div>
  )
}

function InfoCard({ typeId, anchor }: { typeId: string; anchor: DOMRect }) {
  const type = getMachineType(typeId)
  if (!type) return null
  const category = EQUIPMENT_CATEGORIES.find((c) => c.id === type.category)
  const width = 256
  // Beside the library, level with the tile, kept inside the window.
  const left = Math.min(anchor.right + 14, window.innerWidth - width - 12)
  const top = Math.max(64, Math.min(anchor.top - 12, window.innerHeight - 380))
  const { front, back, left: sideL, right: sideR } = type.clearance
  const stats: [string, string][] = [
    ['Size', `${metres(type.width)} × ${metres(type.depth)} m`],
    ['Height', type.height !== undefined ? `${metres(type.height)} m` : '—'],
    ['Power', `${type.powerKw} kW`],
    ['People', type.people !== undefined ? String(type.people) : '—'],
    ['Clearance', `front ${metres(front)} · back ${metres(back)} · sides ${metres(Math.max(sideL, sideR))} m`],
  ]
  const needs = [type.needsWater && 'Water', type.needsFireSuppression && 'Fire suppression'].filter(Boolean) as string[]

  return (
    <div
      role="tooltip"
      className="pointer-events-none fixed z-50 animate-in fade-in-0 zoom-in-95 slide-in-from-left-2 rounded-2xl border bg-card p-3 text-card-foreground shadow-lift"
      style={{ left, top, width }}
    >
      <TileThumbnail typeId={typeId} large />
      <div className="mt-2.5 flex items-center gap-1.5 text-[10px] font-bold tracking-wide text-muted-foreground uppercase">
        <span className="size-2 rounded-full" style={{ backgroundColor: CATEGORY_COLOURS[type.category] }} aria-hidden />
        {category?.name}
      </div>
      <p className="mt-0.5 text-sm leading-snug font-extrabold">{type.name}</p>
      <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
        {stats.map(([label, value]) => (
          <div key={label} className="contents">
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="font-semibold">{value}</dd>
          </div>
        ))}
      </dl>
      <div className="mt-2.5 flex flex-wrap gap-1">
        {needs.map((n) => (
          <span key={n} className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold">Needs {n.toLowerCase()}</span>
        ))}
        {isStation(type.id) && (
          <span className="rounded-full bg-(--feedback-green)/15 px-2 py-0.5 text-[10px] font-bold text-(--feedback-green)">Counts toward goal</span>
        )}
      </div>
      <p className="mt-2.5 border-t pt-2 text-[11px] text-muted-foreground">Click to place · R to rotate</p>
    </div>
  )
}

/**
 * Straight belt: the tile places it, and the length field beside it sets the length of the next
 * belt (and of the one being placed). The field sits outside the button, so typing doesn't place.
 */
function BeltItem({ type, active }: { type: MachineType; active: boolean }) {
  const startPlacing = usePlanner((s) => s.startPlacingMachine)
  const length = usePlanner((s) => s.conveyorLength)
  const setLength = usePlanner((s) => s.setConveyorLength)

  return (
    <div className={cn(tileClass, 'flex-row items-center gap-2 hover:translate-y-0', active && activeClass)}>
      <button
        type="button"
        aria-pressed={active}
        title={type.name}
        onClick={() => {
          playSound('pick')
          startPlacing(type.id)
        }}
        className="flex min-w-0 flex-1 items-center gap-2 text-left focus-visible:outline-none"
      >
        <span className="w-24 shrink-0">
          <TileThumbnail typeId={type.id} />
        </span>
        <span className="min-w-0">
          <span className="block truncate text-[13px] leading-tight font-bold">{shortCatalogName(type.id)}</span>
          <span className="block text-[11px] text-muted-foreground">{metres(type.depth)} m wide</span>
        </span>
      </button>
      <div className="flex shrink-0 flex-col items-start gap-0.5 pr-1">
        <label htmlFor="belt-length" className="text-[10px] font-bold text-muted-foreground">
          Length (m)
        </label>
        <CommitInput
          id="belt-length"
          className="h-7 w-14 text-xs"
          min={1}
          max={30}
          step={0.5}
          value={length / 1000}
          isValid={(m) => isValidConveyorLength(m * 1000)}
          onCommit={(m) => setLength(Math.round(m * 1000))}
        />
      </div>
      {active && <PlacingRibbon />}
    </div>
  )
}

/** The catalog list's name for a type: its short name (the full name is the tooltip). */
function shortCatalogName(typeId: string) {
  const type = getMachineType(typeId)
  return type?.shortName ?? type?.name ?? typeId
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
        <span className="h-1.5 w-full rounded-xs" style={{ backgroundColor: CANVAS.wallFill, boxShadow: `0 0 0 1px ${CANVAS.wallStroke}` }} />
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

/** A loading dock tool, placed by clicking near the outer boundary. */
function LoadingDockItem() {
  const startPlacing = usePlanner((s) => s.startPlacingLoadingDock)
  const active = usePlanner((s) => s.placing?.kind === 'loadingDock')

  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={startPlacing}
      className={cn(cardClass, 'flex items-center gap-3 py-2', active && activeClass)}
    >
      <span className="flex size-7 shrink-0 items-center justify-center rounded-sm border-y-2 border-emerald-500 bg-background" aria-hidden>
        <Truck className="size-4 text-emerald-600" />
      </span>
      <span>
        <span className="block text-sm font-medium">Loading dock</span>
        <span className="block text-xs text-muted-foreground">Outer boundary · {metres(DEFAULT_LOADING_DOCK_WIDTH_MM)} m opening</span>
        {active && <Badge className="mt-1">Placing</Badge>}
      </span>
    </button>
  )
}

function LoadingBayItem() {
  const docks = usePlanner((s) => s.loadingDocks)
  const placing = usePlanner((s) => s.placing)
  const startPlacing = usePlanner((s) => s.startPlacingLoadingBay)
  const [dockId, setDockId] = useState('')
  const selectedDockId = docks.some((dock) => dock.id === dockId) ? dockId : ''
  const [drawMode, setDrawMode] = useState<'rectangle' | 'polygon'>('rectangle')
  const active = placing?.kind === 'loadingBay' && placing.loadingDockId === (selectedDockId || undefined) && placing.drawMode === drawMode

  return (
    <div className={cn(cardClass, 'space-y-2', active && activeClass)}>
      <div className="flex items-center gap-2">
        <Truck className="size-5 shrink-0 text-emerald-600" aria-hidden />
        <span className="text-sm font-medium">Loading bay</span>
      </div>
      <div className="grid grid-cols-2 gap-1 rounded-md bg-muted p-1">
        {(['rectangle', 'polygon'] as const).map((mode) => (
          <button key={mode} type="button" aria-pressed={drawMode === mode} onClick={() => setDrawMode(mode)} className={cn('rounded px-2 py-1 text-xs capitalize', drawMode === mode ? 'bg-background font-medium shadow-sm' : 'text-muted-foreground')}>
            {mode === 'polygon' ? 'Custom shape' : mode}
          </button>
        ))}
      </div>
      <label className="sr-only" htmlFor="loading-bay-dock">Optional connected loading dock</label>
      <select
        id="loading-bay-dock"
        value={selectedDockId}
        onChange={(event) => setDockId(event.target.value)}
        className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs"
      >
        <option value="">No connected dock</option>
        {docks.map((dock) => <option key={dock.id} value={dock.id}>{dock.name}</option>)}
      </select>
      <button type="button" aria-pressed={active} onClick={() => startPlacing(selectedDockId || undefined, drawMode)} className={cn(cardClass, 'py-2')}>
        <span className="block text-xs text-muted-foreground">{drawMode === 'rectangle' ? 'Press and drag to draw an outdoor rectangle.' : 'Click outline corners, then press Enter to finish.'}</span>
        {active && <Badge className="mt-1">Drawing bay</Badge>}
      </button>
    </div>
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

function FloorPlanningTools() {
  const start = usePlanner((s) => s.startPlacingLogistics)
  const placing = usePlanner((s) => s.placing)
  const items = [
    ['truck-route', 'Forklift route', 'Draw a connected centreline; set its corridor width and assigned forklifts in properties.', Route, '#e87924'],
    ['pedestrian-route', 'Pedestrian route', 'Draw a standalone walking path or create one parallel to a forklift route.', Footprints, '#8b5cf6'],
    ['crossing', 'Pedestrian crossing', 'Click a forklift route intersection to mark the crossing.', Signpost, '#dc2626'],
    ['barrier', 'Safety barrier', 'Draw an editable physical barrier segment or path.', Shield, '#374151'],
  ] as const
  return <div className="space-y-2">{items.map(([kind, label, description, Icon, colour]) => {
    const active = placing?.kind === 'logistics-path' && placing.logisticsKind === kind || placing?.kind === 'logistics-point' && placing.logisticsKind === kind
    return <button key={kind} type="button" aria-pressed={active} onClick={() => start(kind)} className={cn(cardClass, 'flex items-center gap-3 py-2', active && activeClass)}>
      <span className="flex size-7 shrink-0 items-center justify-center rounded-[3px] border-2" style={{ borderColor: colour, color: colour, backgroundColor: `${colour}26` }}><Icon className="size-4" aria-hidden /></span>
      <span className="text-left">
        <span className="block text-sm font-medium">{label}</span>
        <span className="block text-xs text-muted-foreground">{description}</span>
        {active && <Badge className="mt-1">Placing</Badge>}
      </span>
    </button>
  })}</div>
}

function TruckInfrastructure() {
  const start = usePlanner((s) => s.startPlacingLogistics)
  const addTruckType = usePlanner((s) => s.addTruckType)
  const truckTypes = usePlanner((s) => s.truckTypes)
  const forkliftInstances = usePlanner((s) => s.forkliftInstances)
  const startPlacingForklift = usePlanner((s) => s.startPlacingForklift)
  const placing = usePlanner((s) => s.placing)
  const instanceCounts = new Map<string, number>()
  for (const instance of forkliftInstances) instanceCounts.set(instance.typeId, (instanceCounts.get(instance.typeId) ?? 0) + 1)
  const placedModels = truckTypes.flatMap((type) => {
    const count = instanceCounts.get(type.id) ?? 0
    return count > 0 ? [{ type, count }] : []
  })
  const presetIds = new Set(FORKLIFT_PRESETS.map((preset) => preset.presetId))
  const customTypes = truckTypes.filter((type) => !presetIds.has(type.id) && (instanceCounts.get(type.id) ?? 0) === 0)
  const items = [
    ['parking', 'Forklift parking spot', 'Drag to draw an editable rectangle; outdoor placement is allowed.'],
    ['charging', 'Charging station', 'Automatically routed to a reachable power point.'],
    ['battery-watering', 'Battery-watering station', 'Automatically routed to a reachable water point.'],
  ] as const
  return <details open className="rounded-xl border bg-card shadow-soft">
    <summary className="cursor-pointer list-none px-2.5 py-2 text-sm font-bold [&::-webkit-details-marker]:hidden">Forklift catalogue & infrastructure</summary>
    <div className="space-y-3 px-2.5 pb-3">
      <div>
        <button type="button" className={cn(cardClass, 'py-2')} onClick={() => addTruckType()}>Create custom forklift</button>
        <p className="mt-1 text-[11px] text-muted-foreground">Presets are model-specific and sourced; unknown specifications are left blank.</p>
      </div>
      {customTypes.length > 0 && <details className="rounded-sm border">
        <summary className="cursor-pointer px-2 py-1.5 text-xs font-medium">Custom forklift models · {customTypes.length}</summary>
        <div className="space-y-1 px-2 pb-2">
          {customTypes.map((type) => {
            const placeable = type.widthMm !== null && type.widthMm > 0 && type.lengthMm !== null && type.lengthMm > 0
            return <button key={type.id} type="button" disabled={!placeable} aria-pressed={placing?.kind === 'forklift' && placing.typeId === type.id} onClick={() => startPlacingForklift(type.id)} className={cn(cardClass, 'flex items-center gap-2 py-2 text-left disabled:opacity-50', placing?.kind === 'forklift' && placing.typeId === type.id && activeClass)}>
              <Truck className="size-4 shrink-0 text-blue-700" aria-hidden />
              <span className="min-w-0 flex-1 truncate text-xs font-medium">{type.name}</span>
              <span className="text-[10px] text-muted-foreground">{placeable ? 'Place' : 'Set dimensions'}</span>
            </button>
          })}
        </div>
      </details>}
      {placedModels.length > 0 && <div className="space-y-1">
        <div className="px-1 text-xs font-medium text-muted-foreground">Models in this project</div>
        {placedModels.map(({ type, count }) => <button key={type.id} type="button" aria-pressed={placing?.kind === 'forklift' && placing.typeId === type.id} onClick={() => startPlacingForklift(type.id)} className={cn(cardClass, 'flex items-center gap-2 py-2 text-left', placing?.kind === 'forklift' && placing.typeId === type.id && activeClass)}>
          <span className="flex size-7 shrink-0 items-center justify-center rounded-[3px] border-2 border-blue-600 bg-blue-600/10 text-blue-700"><Truck className="size-4" aria-hidden /></span>
          <span className="min-w-0 flex-1 truncate text-xs font-medium">{type.name} ×{count}</span>
          <span className="text-[10px] text-muted-foreground">Place</span>
        </button>)}
      </div>}
      {(Object.entries(FORKLIFT_CATEGORY_NAMES) as [ForkliftCategory, string][]).map(([category, label]) => {
        const presets = FORKLIFT_PRESETS.filter((preset) => preset.category === category).slice(0, 1)
        return <details key={category} className="rounded-sm border">
          <summary className="cursor-pointer px-2 py-1.5 text-xs font-medium">{label} · {presets.length} sourced</summary>
          <div className="space-y-1 px-2 pb-2">
            {presets.length === 0 ? <p className="text-[11px] text-muted-foreground">No verified preset is available yet.</p> : presets.map((preset) => {
              const { presetId, ...type } = preset
              const active = placing?.kind === 'forklift' && (placing.typeId === presetId || truckTypes.some((item) => item.id === placing.typeId && item.sourceUrl === preset.sourceUrl))
              return <div key={presetId} className={cn(cardClass, 'py-2', active && activeClass)}>
                <button type="button" aria-pressed={active} className="w-full text-left" onClick={() => startPlacingForklift(presetId, type)}>
                  <span className="block text-xs font-medium">{preset.name} · place</span>
                  <span className="block text-[11px] text-muted-foreground">{preset.widthMm ?? '—'} × {preset.lengthMm ?? '—'} mm · {preset.loadCapacityKg ?? '—'} kg</span>
                  <span className="block text-[11px] text-muted-foreground">Turning {preset.turningRadiusMm ?? 'not listed'} mm · aisle {preset.minimumAisleWidthMm ?? 'not listed'} mm</span>
                  {active && <Badge className="mt-1">Placing · click multiple locations</Badge>}
                </button>
                <div className="mt-1 flex items-center justify-between">
                  <a className="text-[11px] text-blue-700 underline" href={preset.sourceUrl} target="_blank" rel="noreferrer">Specification source</a>
                  <button type="button" className="text-[11px] text-muted-foreground underline" onClick={() => addTruckType(type)}>Create editable copy</button>
                </div>
              </div>
            })}
          </div>
        </details>
      })}
      <PanelHeading>Forklift infrastructure</PanelHeading>
      {items.map(([kind, label, description]) => {
        const active = placing?.kind === 'logistics-rectangle' && placing.logisticsKind === kind || placing?.kind === 'logistics-point' && placing.logisticsKind === kind
        const Icon = kind === 'parking' ? ParkingSquare : kind === 'charging' ? BatteryCharging : Waves
        const colour = kind === 'parking' ? '#ca8a04' : kind === 'charging' ? '#2563eb' : '#0f766e'
        return <button key={kind} type="button" aria-pressed={active} onClick={() => start(kind)} className={cn(cardClass, 'flex items-center gap-3 py-2', active && activeClass)}>
          <span className="flex size-7 shrink-0 items-center justify-center rounded-[3px] border-2" style={{ borderColor: colour, color: colour, backgroundColor: `${colour}26` }}><Icon className="size-4" aria-hidden /></span>
          <span className="text-left">
            <span className="block text-sm font-medium">{label}</span>
            <span className="block text-xs text-muted-foreground">{description}</span>
            {active && <Badge className="mt-1">Placing</Badge>}
          </span>
        </button>
      })}
      <p className="text-[11px] text-muted-foreground">Planning checks only; these results do not certify workplace safety.</p>
    </div>
  </details>
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
