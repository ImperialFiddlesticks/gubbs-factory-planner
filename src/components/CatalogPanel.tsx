import { useState } from 'react'
import { BatteryCharging, ChevronRight, Footprints, ParkingSquare, Route, Shield, Signpost, Truck, Waves } from 'lucide-react'
import { CommitInput } from '@/components/CommitInput'
import { PanelHeading } from '@/components/PanelHeading'
import { UTILITY_ICONS } from '@/components/utilityIcons'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { CATALOG, getMachineType } from '@/data/catalog'
import { EQUIPMENT_CATEGORIES, type EquipmentCategoryId } from '@/data/categories'
import { FORKLIFT_CATEGORY_NAMES, FORKLIFT_PRESETS } from '@/data/forkliftCatalog'
import type { ForkliftCategory } from '@/types'
import { isValidConveyorLength } from '@/data/conveyors'
import { DEFAULT_PILLAR_SIZE, DEFAULT_WALL_THICKNESS } from '@/data/structures'
import { DEFAULT_LOADING_DOCK_WIDTH_MM } from '@/lib/loadingDocks'
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
  highlighted = false,
  onToggle,
}: {
  collapsed: boolean
  highlighted?: boolean
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
  const showLoadingDock = matches('loading dock', 'dock', 'structure')
  const showLoadingBay = matches('loading bay', 'bay', 'staging area', 'structure')
  const visibleZones = ZONE_KIND_LIST.filter((info) => matches(info.name, 'zone', 'area', info.description))
  const showStructures = showPillar || showWall || showLoadingDock || showLoadingBay
  const showFloorPlanning = visibleZones.length > 0 || matches('forklift route', 'truck route', 'pedestrian route', 'crossing', 'barrier')
  const showLogistics = matches('forklift', 'truck', 'parking', 'charging', 'battery', 'pedestrian', 'crossing', 'barrier', 'route')

  if (collapsed) {
    return (
      <aside className={cn(
        'theme-dark planner-catalog is-collapsed flex flex-col items-center border-r py-2',
        highlighted && 'ring-2 ring-accent ring-offset-2 ring-offset-background',
      )}>
        <button
          type="button"
          onClick={onToggle}
          aria-label="Expand equipment library"
          title="Expand equipment library"
          aria-expanded={false}
          className="flex size-9 items-center justify-center rounded-md border border-white/15 bg-white/5 text-foreground transition-colors hover:border-white/30 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ChevronRight className="size-4" aria-hidden />
        </button>
      </aside>
    )
  }

  return (
    <aside className={cn(
      'theme-dark planner-catalog flex min-h-0 flex-col overflow-y-auto border-r p-4',
      highlighted && 'ring-2 ring-accent ring-offset-2 ring-offset-background',
    )}>
      <div className="flex items-center justify-between gap-2">
        <PanelHeading>Equipment library</PanelHeading>
        <button
          type="button"
          onClick={onToggle}
          aria-label="Collapse equipment library"
          title="Collapse equipment library"
          aria-expanded={true}
          className="flex size-8 shrink-0 items-center justify-center rounded-md border border-white/15 bg-white/5 text-foreground transition-colors hover:border-white/30 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
            {showLoadingDock && <LoadingDockItem />}
            {showLoadingBay && <LoadingBayItem />}
          </div>
        </>
      )}

      {showFloorPlanning && (
        <>
          <Separator className="my-5" />
          <PanelHeading>Floor planning</PanelHeading>
          <div className="space-y-2">
            {visibleZones.map((info) => <ZoneItem key={info.kind} info={info} />)}
            <FloorPlanningTools />
          </div>
        </>
      )}

      {showLogistics && <Separator className="my-5" />}
      {showLogistics && <TruckInfrastructure />}

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
      {groups.length === 0 && !showStructures && !showLogistics && visibleUtilities.length === 0 && (
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
  const [dockId, setDockId] = useState(docks[0]?.id ?? '')
  const selectedDockId = docks.some((dock) => dock.id === dockId) ? dockId : (docks[0]?.id ?? '')
  const active = placing?.kind === 'loadingBay' && placing.loadingDockId === selectedDockId

  return (
    <div className={cn(cardClass, 'space-y-2', active && activeClass)}>
      <div className="flex items-center gap-2">
        <Truck className="size-5 shrink-0 text-emerald-600" aria-hidden />
        <span className="text-sm font-medium">Loading bay</span>
      </div>
      {docks.length === 0 ? (
        <p className="text-xs text-muted-foreground">Add a loading dock before creating its outdoor bay.</p>
      ) : (
        <>
          <label className="sr-only" htmlFor="loading-bay-dock">Connected loading dock</label>
          <select
            id="loading-bay-dock"
            value={selectedDockId}
            onChange={(event) => setDockId(event.target.value)}
            className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs"
          >
            {docks.map((dock) => <option key={dock.id} value={dock.id}>{dock.name}</option>)}
          </select>
          <button type="button" aria-pressed={active} onClick={() => startPlacing(selectedDockId)} className={cn(cardClass, 'py-2')}>
            <span className="block text-xs text-muted-foreground">Click outline vertices; click the first point to finish.</span>
            {active && <Badge className="mt-1">Drawing bay</Badge>}
          </button>
        </>
      )}
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
  return <details className="rounded-md border">
    <summary className="cursor-pointer list-none px-2.5 py-2 text-sm font-medium [&::-webkit-details-marker]:hidden">Forklift catalogue & infrastructure</summary>
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
