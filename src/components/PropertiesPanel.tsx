import { useMemo, useState, type ReactNode } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { CommitInput } from '@/components/CommitInput'
import { CommitText } from '@/components/CommitText'
import { UTILITY_ICONS } from '@/components/utilityIcons'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { DEFAULT_FACTORY_HEIGHT_MM } from '@/data/defaults'
import { getMachineType, machineHeight, machinePeople, machineTypeFor } from '@/data/catalog'
import { MACHINE_COLOURS, stationColour } from '@/data/machineColours'
import { MIN_ZONE_SIZE, ZONE_KIND_LIST, ZONE_KINDS, machinesInZone, zoneArea } from '@/data/zones'
import { isValidConveyorLength } from '@/data/conveyors'
import { MIN_WALL_LENGTH } from '@/data/structures'
import { EXIT_MAX_DISTANCE, UTILITY_KINDS, utilityRadius } from '@/data/utilities'
import { animateNodeOut } from '@/lib/animations'
import { conveyorRuns } from '@/lib/conveyors'
import { footprint, wallLength } from '@/lib/geometry'
import { checkPlacement } from '@/lib/api/placementChecks'
import { cn } from '@/lib/utils'
import { loadingDockIssue, loadingDockPointAt } from '@/lib/loadingDocks'
import { loadingBayIssue } from '@/lib/loadingBays'
import { TruckLogisticsProperties } from '@/components/canvas/TruckLogisticsProperties'
import { findLayoutIssues, powerAssignments, type LayoutIssue } from '@/lib/validation'
import { findTruckLogisticsIssues } from '@/lib/truckLogistics'
import { commentTargetName, formatCommentTime } from '@/lib/comments'
import { machineAutoName, machineName } from '@/lib/machineLabels'
import { usePlanner } from '@/store'
import { CANVAS } from '@/theme'
import type { LoadingBay, LoadingDock, MachineInstance, Pillar, Utility, Wall, Zone, ZoneKind } from '@/types'

export function PropertiesPanel({
  showFactoryProperties,
  collapsed,
  onToggle,
}: {
  showFactoryProperties: boolean
  collapsed: boolean
  onToggle: () => void
}) {
  const machines = usePlanner((s) => s.machines)
  const utilities = usePlanner((s) => s.utilities)
  const pillars = usePlanner((s) => s.pillars)
  const walls = usePlanner((s) => s.walls)
  const zones = usePlanner((s) => s.zones)
  const floorplan = usePlanner((s) => s.floorplan)
  const comments = usePlanner((s) => s.comments)
  const commentDraft = usePlanner((s) => s.commentDraft)
  const truckTypes = usePlanner((s) => s.truckTypes)
  const parkingSpots = usePlanner((s) => s.truckParkingSpots)
  const serviceStations = usePlanner((s) => s.truckServiceStations)
  const truckRoutes = usePlanner((s) => s.truckRoutes)
  const pedestrianRoutes = usePlanner((s) => s.pedestrianRoutes)
  const pedestrianCrossings = usePlanner((s) => s.pedestrianCrossings)
  const safetyBarriers = usePlanner((s) => s.safetyBarriers)
  const loadingBays = usePlanner((s) => s.loadingBays)
  const selectedCount = usePlanner((s) => s.selectedIds.length)
  const selectedMachine = usePlanner((s) =>
    s.selectedIds.length === 1 ? s.machines.find((machine) => machine.id === s.selectedId) : undefined,
  )
  const logisticsIssues = useMemo(() => findTruckLogisticsIssues({ truckTypes, utilities, parkingSpots, serviceStations, truckRoutes, pedestrianRoutes, pedestrianCrossings, safetyBarriers, machines, pillars, walls, loadingBays, floorplan }), [truckTypes, utilities, parkingSpots, serviceStations, truckRoutes, pedestrianRoutes, pedestrianCrossings, safetyBarriers, machines, pillars, walls, loadingBays, floorplan])
  const issues = useMemo(
    () => (floorplan ? findLayoutIssues(machines, utilities, floorplan, { pillars, walls, zones }, serviceStations, truckTypes) : []),
    [machines, utilities, floorplan, pillars, walls, zones, serviceStations, truckTypes],
  )
  const discussionAndLayout = (
    <>
      <Separator className="my-6" />

      <section>
        <details className="rounded-md border">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-2.5 py-2 text-sm font-medium [&::-webkit-details-marker]:hidden">
            <span>Discussion{commentDraft ? ' · Pinning comment' : ''}</span>
            <span className="text-xs text-muted-foreground">
              {comments.filter((comment) => comment.status === 'open').length} open · {comments.length}
            </span>
          </summary>
          <div className="px-2.5 pb-2.5">
            <CommentsSection />
          </div>
        </details>
      </section>

      <Separator className="my-6" />

      <section>
        <details data-guide-target="layout-checks" className="space-y-3">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-2 text-sm font-medium [&::-webkit-details-marker]:hidden">
            <span>Layout checks</span>
            <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
              {issues.length + logisticsIssues.length}
            </span>
          </summary>
          <div>
            <WarningsList issues={issues} />
            <div className="mt-3 space-y-1">
              <div className="text-xs font-medium">Forklift and pedestrian checks · {logisticsIssues.length}</div>
              {logisticsIssues.map((issue) => <button key={issue.key} type="button" onClick={() => usePlanner.getState().selectMany(issue.ids)} className="block w-full rounded-sm px-1.5 py-1 text-left text-xs text-amber-700 hover:bg-amber-50">{issue.message}</button>)}
            </div>
            <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
              Checks cover configured layout geometry and utilities; they are not certified safety validation.
            </p>
          </div>
        </details>
      </section>
    </>
  )

  if (collapsed) {
    return (
      <aside data-guide-target="properties" className="theme-chrome properties-sidebar planner-properties is-collapsed flex flex-col items-center border-l py-2">
        <button
          type="button"
          onClick={onToggle}
          aria-label="Expand properties"
          title="Expand properties"
          aria-expanded={false}
          className="flex size-9 items-center justify-center rounded-md border bg-card text-foreground shadow-soft transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ChevronLeft className="size-4" aria-hidden />
        </button>
      </aside>
    )
  }

  return (
    <aside data-guide-target="properties" className="theme-chrome properties-sidebar planner-properties flex min-h-0 flex-col overflow-y-auto border-l p-4">
      <section>
        <div className="mb-3 flex h-8 items-center gap-2">
          <button
            type="button"
            onClick={onToggle}
            aria-label="Collapse properties"
            title="Collapse properties"
            aria-expanded={true}
            className="flex size-8 shrink-0 items-center justify-center rounded-md border bg-card text-foreground shadow-soft transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <ChevronRight className="size-4" aria-hidden />
          </button>
          <h2 className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">Properties</h2>
        </div>
        {selectedMachine ? (
          <MachineProperties
            key={selectedMachine.id}
            machine={selectedMachine}
            sectionsAfterPosition={discussionAndLayout}
          />
        ) : selectedCount === 0 ? (
          showFactoryProperties ? (
            <FactoryProperties />
          ) : (
            <details open className="space-y-2">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-2 text-sm font-medium [&::-webkit-details-marker]:hidden">
                Factory Information
              </summary>
              <Selection />
            </details>
          )
        ) : (
          <Selection />
        )}
      </section>

      {!selectedMachine && discussionAndLayout}
    </aside>
  )
}

function FactoryProperties() {
  const floorplan = usePlanner((s) => s.floorplan)
  const setFloorplan = usePlanner((s) => s.setFloorplan)
  const setFloorplanHeight = usePlanner((s) => s.setFloorplanHeight)
  if (!floorplan) return null

  return (
    <div className="mt-3 space-y-3 rounded-md border p-3">
      <div className="text-sm font-medium">Factory Properties</div>
      <Field id="factory-width" label="Width">
        <DimensionInput
          id="factory-width"
          mm={floorplan.width}
          onCommit={(mm) => setFloorplan(mm, floorplan.depth)}
        />
      </Field>
      <Field id="factory-depth" label="Depth">
        <DimensionInput
          id="factory-depth"
          mm={floorplan.depth}
          onCommit={(mm) => setFloorplan(floorplan.width, mm)}
        />
      </Field>
      <Field id="factory-height" label="Height">
        <DimensionInput
          id="factory-height"
          mm={floorplan.height ?? DEFAULT_FACTORY_HEIGHT_MM}
          onCommit={setFloorplanHeight}
        />
      </Field>
    </div>
  )
}

function DimensionInput({ id, mm, onCommit }: { id: string; mm: number; onCommit: (mm: number) => void }) {
  return (
    <div className="flex items-center gap-2">
      <CommitInput
        id={id}
        min={0}
        step={0.5}
        value={mm / 1000}
        isValid={(metres) => metres > 0}
        onCommit={(metres) => onCommit(Math.round(metres * 1000))}
        className="h-8 w-24"
      />
      <span className="text-sm text-muted-foreground">m</span>
    </div>
  )
}

function CommentsSection() {
  const selectedId = usePlanner((s) => s.selectedId)
  const selectedCount = usePlanner((s) => s.selectedIds.length)
  const machines = usePlanner((s) => s.machines)
  const utilities = usePlanner((s) => s.utilities)
  const pillars = usePlanner((s) => s.pillars)
  const walls = usePlanner((s) => s.walls)
  const comments = usePlanner((s) => s.comments)
  const selectedCommentId = usePlanner((s) => s.selectedCommentId)
  const addComment = usePlanner((s) => s.addComment)
  const startCommentPlacement = usePlanner((s) => s.startCommentPlacement)
  const selectComment = usePlanner((s) => s.selectComment)
  const setCommentStatus = usePlanner((s) => s.setCommentStatus)
  const deleteComment = usePlanner((s) => s.deleteComment)
  const select = usePlanner((s) => s.select)
  const [message, setMessage] = useState('')
  const [author, setAuthor] = useState('You')

  const machine = machines.find((item) => item.id === selectedId)
  const utility = utilities.find((item) => item.id === selectedId)
  const pillar = pillars.find((item) => item.id === selectedId)
  const wall = walls.find((item) => item.id === selectedId)
  const target = machine ?? utility ?? pillar
  const targetId = target?.id ?? wall?.id
  const anchor = target
    ? { x: target.x, y: target.y }
    : wall
      ? { x: (wall.start.x + wall.end.x) / 2, y: (wall.start.y + wall.end.y) / 2 }
      : null
  const targetLabel = machine
    ? machineName(machine, machines)
    : utility
      ? UTILITY_KINDS[utility.kind].name
      : pillar
        ? 'Pillar'
        : wall
          ? 'Wall'
          : null
  const visibleComments = selectedId
    ? comments.filter((comment) => comment.targetId === selectedId)
    : comments

  function submitComment(e: React.FormEvent) {
    e.preventDefault()
    const text = message.trim()
    if (!text) return
    if (selectedId && targetId && anchor) {
      addComment({ message: text, author: author.trim() || 'You', targetId, ...anchor })
    } else {
      startCommentPlacement({ message: text, author: author.trim() || 'You' })
    }
    setMessage('')
  }

  return (
    <div className="space-y-3">
      <p className="text-[11px] leading-relaxed text-muted-foreground">
        Notes are saved with this project in this browser. They are not live shared discussions.
      </p>
      <form onSubmit={submitComment} className="space-y-2">
        <Input
          aria-label="Comment author"
          value={author}
          onChange={(e) => setAuthor(e.target.value)}
          placeholder="Your name"
          className="h-8"
        />
        <textarea
          aria-label={targetLabel ? `Comment on ${targetLabel}` : 'Comment at a floor location'}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder={targetLabel ? `Discuss ${targetLabel}…` : 'Add a floor note…'}
          rows={3}
          className="w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        />
        <Button type="submit" size="sm" className="w-full" disabled={!message.trim()}>
          {targetLabel ? 'Add comment to selection' : 'Pin comment on floor'}
        </Button>
      </form>

      {selectedCount > 1 && <p className="text-[11px] text-muted-foreground">Select one item to attach a comment to it.</p>}

      <div className="space-y-2">
        {visibleComments.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            {targetLabel ? 'No comments on this item yet.' : 'No comments yet.'}
          </p>
        ) : (
          visibleComments.map((comment) => (
            <article
              key={comment.id}
              className={cn(
                'rounded-md border bg-muted/20 p-2.5',
                selectedCommentId === comment.id && 'border-accent ring-1 ring-accent/40',
                comment.status === 'resolved' && 'opacity-70',
              )}
            >
              <button
                type="button"
                onClick={() => {
                  selectComment(comment.id)
                  if (comment.targetId) select(comment.targetId)
                }}
                className="block w-full text-left"
              >
                <span className="flex items-center justify-between gap-2 text-[11px]">
                  <span className="font-medium">{comment.author}</span>
                  <time dateTime={comment.createdAt} className="text-muted-foreground">
                    {formatCommentTime(comment.createdAt)}
                  </time>
                </span>
                {comment.targetId && !selectedId && (
                  <span className="mt-1 block text-[10px] text-muted-foreground">
                    {commentTargetName(comment.targetId, { machines, utilities, pillars, walls })}
                  </span>
                )}
                <span className="mt-1 block whitespace-pre-wrap text-xs">{comment.message}</span>
              </button>
              <div className="mt-1.5 flex items-center justify-between">
                <span className="text-[10px] text-muted-foreground">
                  {comment.status === 'open' ? 'Open' : 'Resolved'}
                </span>
                <span className="flex gap-1">
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2 text-[10px]"
                    onClick={() => setCommentStatus(comment.id, comment.status === 'open' ? 'resolved' : 'open')}
                  >
                    {comment.status === 'open' ? 'Resolve' : 'Reopen'}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2 text-[10px] text-muted-foreground hover:text-destructive"
                    onClick={() => deleteComment(comment.id)}
                  >
                    Delete
                  </Button>
                </span>
              </div>
            </article>
          ))
        )}
      </div>
    </div>
  )
}

function Selection() {
  const utility = usePlanner((s) => s.utilities.find((u) => u.id === s.selectedId))
  const pillar = usePlanner((s) => s.pillars.find((p) => p.id === s.selectedId))
  const wall = usePlanner((s) => s.walls.find((w) => w.id === s.selectedId))
  const zone = usePlanner((s) => s.zones.find((z) => z.id === s.selectedId))
  const loadingDock = usePlanner((s) => s.loadingDocks.find((dock) => dock.id === s.selectedId))
  const loadingBay = usePlanner((s) => s.loadingBays.find((bay) => bay.id === s.selectedId))
  const logisticsSelectedId = usePlanner((s) => {
    const id = s.selectedId
    return id && [...s.truckTypes, ...s.forkliftInstances, ...s.truckParkingSpots, ...s.truckServiceStations, ...s.truckRoutes, ...s.pedestrianRoutes, ...s.pedestrianCrossings, ...s.safetyBarriers].some((item) => item.id === id) ? id : null
  })
  const count = usePlanner((s) => s.selectedIds.length)
  const floorplan = usePlanner((s) => s.floorplan)
  const machines = usePlanner((s) => s.machines)
  const utilities = usePlanner((s) => s.utilities)
  const pillars = usePlanner((s) => s.pillars)
  const walls = usePlanner((s) => s.walls)
  const loadingBays = usePlanner((s) => s.loadingBays)
  const stationTarget = usePlanner((s) => s.setup.stationTarget)
  const loadingDockCount = usePlanner((s) => s.loadingDocks.length)
  const loadingBayCount = loadingBays.length
  if (count > 1) return <MultiProperties />
  if (utility) return <UtilityProperties utility={utility} />
  if (pillar) return <PillarProperties pillar={pillar} />
  if (wall) return <WallProperties wall={wall} />
  if (zone) return <ZoneProperties key={zone.id} zone={zone} />
  if (loadingDock) return <LoadingDockProperties key={loadingDock.id} dock={loadingDock} />
  if (loadingBay) return <LoadingBayProperties key={loadingBay.id} bay={loadingBay} />
  if (logisticsSelectedId) return <TruckLogisticsProperties key={logisticsSelectedId} id={logisticsSelectedId} />
  return (
    <div className="space-y-3">
      {floorplan && (
        <div className="properties-highlight rounded-md border p-3">
          <div className="text-sm font-medium">{floorplan.name}</div>
          <div className="mt-1 text-xs text-muted-foreground">
            {formatMetres(floorplan.width)} × {formatMetres(floorplan.depth)} × {formatMetres(floorplan.height ?? DEFAULT_FACTORY_HEIGHT_MM)} m
          </div>
          <div className="mt-2 text-xs">
            {machines.length} / {stationTarget} machines · {utilities.length} utilities · {pillars.length + walls.length} structures · {loadingDockCount} loading docks · {loadingBayCount} loading bays
          </div>
        </div>
      )}
      <p className="text-xs leading-relaxed text-muted-foreground">
        Select an item to inspect it. Drag on empty floor to select several; Shift-click adds or removes items.
      </p>
    </div>
  )
}

/** Several items selected: what's in the selection, how to move it, and delete. */
function MultiProperties() {
  const selectedIds = usePlanner((s) => s.selectedIds)
  const machines = usePlanner((s) => s.machines)
  const utilities = usePlanner((s) => s.utilities)
  const pillars = usePlanner((s) => s.pillars)
  const walls = usePlanner((s) => s.walls)
  const loadingDocks = usePlanner((s) => s.loadingDocks)
  const loadingBays = usePlanner((s) => s.loadingBays)
  const removeItems = usePlanner((s) => s.removeItems)
  const groupMachines = usePlanner((s) => s.groupMachines)
  const ungroupMachines = usePlanner((s) => s.ungroupMachines)
  const select = usePlanner((s) => s.select)

  const ids = new Set(selectedIds)
  const selectedMachines = machines.filter((machine) => ids.has(machine.id))
  const hasSavedMachineGroup = selectedMachines.some((machine) => machine.groupId)
  const count = (list: { id: string }[]) => list.filter((x) => ids.has(x.id)).length
  const parts = [
    [count(machines), 'machine', 'machines'],
    [count(utilities), 'utility', 'utilities'],
    [count(pillars), 'pillar', 'pillars'],
    [count(walls), 'wall', 'walls'],
    [count(loadingDocks), 'loading dock', 'loading docks'],
    [count(loadingBays), 'loading bay', 'loading bays'],
  ] as const

  return (
    <div className="space-y-4">
      <div>
        <div className="text-sm font-medium">{selectedIds.length} items selected</div>
        <div className="mt-1 text-xs text-muted-foreground">
          {parts
            .filter(([n]) => n > 0)
            .map(([n, one, many]) => `${n} ${n === 1 ? one : many}`)
            .join(' · ')}
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        Drag any of them to move them all. Shift-click adds or removes an item. Esc clears the selection.
      </p>
      {(selectedMachines.length > 1 || hasSavedMachineGroup) && (
        <div className="flex gap-2">
          {selectedMachines.length > 1 && !hasSavedMachineGroup && (
            <Button variant="secondary" className="flex-1" onClick={() => groupMachines(selectedMachines.map((machine) => machine.id))}>
              Group objects
            </Button>
          )}
          {hasSavedMachineGroup && (
            <Button variant="secondary" className="flex-1" onClick={() => ungroupMachines(selectedMachines.map((machine) => machine.id))}>
              Ungroup
            </Button>
          )}
        </div>
      )}
      <div className="flex gap-2">
        <Button variant="secondary" className="flex-1" onClick={() => select(null)}>
          Clear
        </Button>
        <Button variant="ghost" className="flex-1 text-destructive hover:bg-destructive/10" onClick={() => removeItems(selectedIds)}>
          Delete all
        </Button>
      </div>
    </div>
  )
}

type WarningGroupId = 'building' | 'requirements' | 'review'

const WARNING_GROUPS: { id: WarningGroupId; title: string }[] = [
  { id: 'building', title: 'Building and spacing' },
  { id: 'requirements', title: 'Equipment requirements' },
  { id: 'review', title: 'Items to review' },
]

function warningGroup(issue: LayoutIssue): WarningGroupId {
  if (issue.category === 'space') return 'building'
  if (issue.ids.length === 0 || issue.key.startsWith('overload:')) return 'review'
  return 'requirements'
}

function warningGuidance(issue: LayoutIssue) {
  if (issue.key.startsWith('aisle:')) return 'Move the machine out of the aisle, or move or shrink the aisle.'
  if (issue.key.startsWith('height:')) return 'Move the machine out from under the height limit, or check its height.'
  if (issue.key.startsWith('overlap:') || issue.key.includes('-on:')) {
    return 'Move the affected equipment or structure so their footprints no longer overlap.'
  }
  if (issue.category === 'space') return 'Move the affected item, or review the required working space around the machine.'
  if (issue.key.startsWith('overload:')) return 'Reduce connected loads or update the power point capacity.'
  if (issue.key === 'no-exit') return 'Add an exit to the floor plan.'
  if (issue.key === 'no-extinguisher') return 'Place a fire extinguisher and check its configured reach.'
  if (issue.need === 'water') return 'Place or move a water point within reach of this machine.'
  if (issue.need === 'power') return 'Place or move a power point within reach, and check its capacity.'
  if (issue.need === 'sprinkler') return 'Place or move a sprinkler so its configured coverage reaches this machine.'
  if (issue.need === 'exit') return 'Add an exit or review the walking route and configured distance.'
  if (issue.need === 'extinguisher') return 'Place or move a fire extinguisher, and check the walking route.'
  return 'Review the affected layout items and their configured requirements.'
}

function WarningsList({ issues }: { issues: LayoutIssue[] }) {
  const selectedIds = usePlanner((s) => s.selectedIds)
  const selectMany = usePlanner((s) => s.selectMany)

  if (issues.length === 0) {
    return (
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <span className="size-2 rounded-full" style={{ backgroundColor: CANVAS.valid }} />
        No detected layout issues
      </p>
    )
  }

  const grouped = WARNING_GROUPS.map((group) => ({
    ...group,
    issues: issues.filter((issue) => warningGroup(issue) === group.id),
  })).filter((group) => group.issues.length > 0)

  return (
    <div className="space-y-1.5">
      {grouped.map((group) => (
        <details key={group.id} className="group rounded-md border">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-2.5 py-2 text-xs font-medium [&::-webkit-details-marker]:hidden">
            <span>{group.title}</span>
            <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">{group.issues.length}</span>
          </summary>
          <ul className="space-y-1 px-1.5 pb-1.5">
            {group.issues.map((issue) => {
              const active = issue.ids.some((id) => selectedIds.includes(id))
              return (
                <li key={issue.key}>
                  <button
                    type="button"
                    disabled={issue.ids.length === 0}
                    onClick={() => selectMany(issue.ids)}
                    className={cn(
                      'flex w-full items-start gap-2 rounded-md border border-transparent p-2 text-left transition-colors enabled:hover:border-border',
                      active && 'border-destructive/60 bg-destructive/10',
                      issue.ids.length === 0 && 'cursor-default',
                    )}
                  >
                    <span
                      className="mt-1 size-2 shrink-0 rounded-full"
                      style={{ backgroundColor: issue.category === 'space' ? CANVAS.error : CANVAS.warning }}
                    />
                    <span className="min-w-0">
                      <span className="block text-xs">{issue.message}</span>
                      <span className="mt-1 block text-[11px] leading-relaxed text-muted-foreground">{warningGuidance(issue)}</span>
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        </details>
      ))}
    </div>
  )
}

function LoadingDockProperties({ dock }: { dock: LoadingDock }) {
  const floorplan = usePlanner((s) => s.floorplan)
  const docks = usePlanner((s) => s.loadingDocks)
  const update = usePlanner((s) => s.updateLoadingDock)
  const remove = usePlanner((s) => s.removeLoadingDock)
  if (!floorplan) return null

  const point = loadingDockPointAt(floorplan, dock.boundaryOffsetMm)
  const issue = loadingDockIssue(dock, floorplan, docks)
  const candidateIsValid = (patch: Partial<LoadingDock>) =>
    loadingDockIssue({ ...dock, ...patch }, floorplan, docks) === null
  const directions = [
    { value: 'inbound', label: 'Inbound' },
    { value: 'outbound', label: 'Outbound' },
    { value: 'two-way', label: 'Two-way' },
  ] as const

  return (
    <div className="space-y-3">
      <div>
        <div className="text-sm font-semibold">{dock.name}</div>
        <div className="text-xs text-muted-foreground">
          Outer boundary · {point ? `${formatMetres(point.x)}, ${formatMetres(point.y)} m` : 'position invalid'}
        </div>
      </div>
      <Field id="loading-dock-name" label="Name">
        <CommitText id="loading-dock-name" className="h-8" value={dock.name} onCommit={(name) => update(dock.id, { name: name.trim() || dock.name })} />
      </Field>
      <Field id="loading-dock-width" label="Opening width (m)">
        <CommitInput
          id="loading-dock-width"
          className="h-8"
          min={0.001}
          step={0.1}
          value={dock.widthMm / 1000}
          isValid={(metres) => candidateIsValid({ widthMm: Math.round(metres * 1000) })}
          onCommit={(metres) => update(dock.id, { widthMm: Math.round(metres * 1000) })}
        />
        <p className="mt-1 text-[11px] text-muted-foreground">The full opening must fit on the boundary without overlapping another dock.</p>
      </Field>
      <Field id="loading-dock-height" label="Door height (m)">
        <CommitInput
          id="loading-dock-height"
          className="h-8"
          min={0.001}
          step={0.1}
          value={dock.heightMm / 1000}
          isValid={(metres) => candidateIsValid({ heightMm: Math.round(metres * 1000) })}
          onCommit={(metres) => update(dock.id, { heightMm: Math.round(metres * 1000) })}
        />
      </Field>
      <Field id="loading-dock-depth" label="Door depth, each side (m)">
        <CommitInput
          id="loading-dock-depth"
          className="h-8"
          min={0.001}
          step={0.1}
          value={dock.depthMm / 1000}
          isValid={(metres) => candidateIsValid({ depthMm: Math.round(metres * 1000) })}
          onCommit={(metres) => update(dock.id, { depthMm: Math.round(metres * 1000) })}
        />
        <p className="mt-1 text-[11px] text-muted-foreground">Extends this distance both into and out of the hall.</p>
      </Field>
      <Field id="loading-dock-offset" label="Boundary offset (m)">
        <CommitInput
          id="loading-dock-offset"
          className="h-8"
          min={0}
          step={0.1}
          value={dock.boundaryOffsetMm / 1000}
          isValid={(metres) => candidateIsValid({ boundaryOffsetMm: Math.round(metres * 1000) })}
          onCommit={(metres) => update(dock.id, { boundaryOffsetMm: Math.round(metres * 1000) })}
        />
        <p className="mt-1 text-[11px] text-muted-foreground">Measured along the ordered outer outline from its first corner.</p>
      </Field>
      <div className="space-y-1.5">
        <span className="text-xs text-muted-foreground">Material flow</span>
        <div className="grid grid-cols-3 gap-1" role="radiogroup" aria-label="Material flow direction">
          {directions.map((direction) => (
            <button
              key={direction.value}
              type="button"
              role="radio"
              aria-checked={dock.flowDirection === direction.value}
              onClick={() => update(dock.id, { flowDirection: direction.value })}
              className={cn(
                'rounded-md border px-1.5 py-1 text-xs transition-colors hover:bg-muted',
                dock.flowDirection === direction.value && 'border-accent bg-accent/15 font-medium',
              )}
            >
              {direction.label}
            </button>
          ))}
        </div>
      </div>
      {issue && <p className="rounded-md border border-destructive/40 bg-destructive/10 p-2 text-xs text-destructive">{issue}</p>}
      <Button variant="ghost" className="w-full text-muted-foreground hover:text-destructive" onClick={() => remove(dock.id)}>
        Delete loading dock
      </Button>
    </div>
  )
}

function LoadingBayProperties({ bay }: { bay: LoadingBay }) {
  const floorplan = usePlanner((s) => s.floorplan)
  const docks = usePlanner((s) => s.loadingDocks)
  const bays = usePlanner((s) => s.loadingBays)
  const update = usePlanner((s) => s.updateLoadingBay)
  const remove = usePlanner((s) => s.removeItems)
  if (!floorplan) return null

  const issue = loadingBayIssue(bay, floorplan, docks, bays)
  const candidateIsValid = (outline: LoadingBay['outline']) =>
    loadingBayIssue({ ...bay, outline }, floorplan, docks, bays) === null

  return (
    <div className="space-y-3">
      <div>
        <div className="text-sm font-semibold">{bay.name}</div>
        <div className="text-xs text-muted-foreground">Outdoor vehicle staging area</div>
      </div>
      <Field id="loading-bay-name" label="Name">
        <CommitText id="loading-bay-name" className="h-8" value={bay.name} onCommit={(name) => update(bay.id, { name: name.trim() || bay.name })} />
      </Field>
      <Field id="loading-bay-dock" label="Connected loading dock (optional)">
        <select
          id="loading-bay-dock"
          value={bay.loadingDockId ?? ''}
          onChange={(event) => update(bay.id, { loadingDockId: event.target.value || undefined })}
          className="h-8 w-full rounded-md border border-input bg-background px-2 text-sm"
        >
          <option value="">No connected dock</option>
          {docks.map((dock) => <option key={dock.id} value={dock.id}>{dock.name}</option>)}
        </select>
      </Field>
      <div className="space-y-2">
        <span className="text-xs text-muted-foreground">Outline points (m)</span>
        {bay.outline.map((point, index) => (
          <div key={index} className="grid grid-cols-2 gap-2">
            {(['x', 'y'] as const).map((axis) => (
              <Field key={axis} id={`loading-bay-${index}-${axis}`} label={`P${index + 1} ${axis.toUpperCase()}`}>
                <CommitInput
                  id={`loading-bay-${index}-${axis}`}
                  className="h-8"
                  step={0.1}
                  value={point[axis] / 1000}
                  isValid={(metres) => {
                    const outline = bay.outline.map((item, itemIndex) => itemIndex === index
                      ? { ...item, [axis]: Math.round(metres * 1000) }
                      : item)
                    return candidateIsValid(outline)
                  }}
                  onCommit={(metres) => {
                    const outline = bay.outline.map((item, itemIndex) => itemIndex === index
                      ? { ...item, [axis]: Math.round(metres * 1000) }
                      : item)
                    update(bay.id, { outline })
                  }}
                />
              </Field>
            ))}
          </div>
        ))}
      </div>
      <p className="text-[11px] text-muted-foreground">Bay outlines may extend outside the hall. Drag to move; choose Custom shape when drawing, drag vertices to reshape, or click an edge handle to add a corner.</p>
      {issue && <p className="rounded-md border border-destructive/40 bg-destructive/10 p-2 text-xs text-destructive">{issue}</p>}
      <Button variant="ghost" className="w-full text-muted-foreground hover:text-destructive" onClick={() => remove([bay.id])}>
        Delete loading bay
      </Button>
    </div>
  )
}

function MachineProperties({
  machine,
  sectionsAfterPosition,
}: {
  machine: MachineInstance
  sectionsAfterPosition: ReactNode
}) {
  const moveMachine = usePlanner((s) => s.moveMachine)
  const rotateMachine = usePlanner((s) => s.rotateMachine)
  const removeMachine = usePlanner((s) => s.removeMachine)
  const setBeltLength = usePlanner((s) => s.setBeltLength)
  const updateDimensions = usePlanner((s) => s.updateMachineDimensions)
  const updateClearance = usePlanner((s) => s.updateMachineClearance)
  const updateDetails = usePlanner((s) => s.updateMachineDetails)
  const machines = usePlanner((s) => s.machines)
  const floorplan = usePlanner((s) => s.floorplan)
  const singlePieceId = usePlanner((s) => s.singlePieceId)
  const run = useMemo(() => conveyorRuns(machines).runOf.get(machine.id), [machines, machine.id])
  const [serverCheck, setServerCheck] = useState<{
    state: 'checking' | 'passed' | 'blocked' | 'error'
    message: string
    snapshotKey: string
  } | null>(null)
  const snapshotKey = JSON.stringify({ floorplan, machines, selectedMachineId: machine.id })
  const visibleServerCheck = serverCheck?.snapshotKey === snapshotKey ? serverCheck : null

  const type = machineTypeFor(machine)
  if (!type) return null

  async function checkWithBackend() {
    if (!floorplan) return
    const checkedSnapshotKey = snapshotKey
    setServerCheck({
      state: 'checking',
      message: 'Checking this placement with the backend…',
      snapshotKey: checkedSnapshotKey,
    })
    try {
      const otherMachines = machines.flatMap((other) => {
        if (other.id === machine.id) return []
        const otherType = machineTypeFor(other)
        return otherType ? [{ machine: other, machineType: otherType }] : []
      })
      const result = await checkPlacement(floorplan, machine, type!, otherMachines)
      if (result.canPlace) {
        setServerCheck({
          state: 'passed',
          message: 'Backend check passed: this machine fits.',
          snapshotKey: checkedSnapshotKey,
        })
        return
      }

      const reasons: Record<string, string> = {
        OUTSIDE_HALL: 'The machine footprint is outside the hall.',
        OUTSIDE_CLEARANCE: 'The required working clearance is outside the hall.',
        MACHINE_OVERLAP: 'The machine overlaps another machine.',
        CLEARANCE_BLOCKED: 'The machine or its working clearance conflicts with another machine.',
        INVALID_INPUT: 'The backend could not validate this layout data.',
      }
      setServerCheck({
        state: 'blocked',
        message: reasons[result.code ?? ''] ?? `Backend check found a placement issue${result.code ? ` (${result.code})` : ''}.`,
        snapshotKey: checkedSnapshotKey,
      })
    } catch (error) {
      setServerCheck({
        state: 'error',
        message: error instanceof TypeError
          ? 'Could not reach the backend. Make sure it is running, then try again.'
          : error instanceof Error ? error.message : 'The backend placement check failed.',
        snapshotKey: checkedSnapshotKey,
      })
    }
  }

  const size = footprint(type, machine.rotation)
  const clearance = machine.clearance ?? type.clearance
  const height = machineHeight(machine)
  const shortName = machineAutoName(machine, machines)

  return (
    <div className="space-y-3">
      <div>
        <div className="text-sm font-semibold">{machine.name ?? shortName}</div>
        <div className="text-xs text-muted-foreground">{type.name}</div>
        <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
          <PropertyValue label="Width × depth" value={`${formatMetres(size.width)} × ${formatMetres(size.depth)} m`} />
          <PropertyValue label="Height" value={height === undefined ? 'Not specified' : `${formatMetres(height)} m`} />
          <PropertyValue label="Rotation" value={`${machine.rotation}°`} />
          <PropertyValue label="Power" value={type.powerKw > 0 ? `${type.powerKw} kW` : 'Not required'} />
        </div>
        <div className="mt-1 text-xs text-muted-foreground">Water: {type.needsWater ? 'Required' : 'Not required'}</div>
        {type.needsFireSuppression && <div className="text-xs text-muted-foreground">Sprinkler: Required</div>}
      </div>

      <StationDetails
        key={machine.id}
        machine={machine}
        autoName={shortName}
        onChange={(patch) => updateDetails(machine.id, patch)}
      />

      <details open className="properties-highlight rounded-md border">
        <summary className="cursor-pointer list-none px-2.5 py-2 text-xs font-medium [&::-webkit-details-marker]:hidden">
          Working clearance
        </summary>
        <div className="grid grid-cols-2 gap-2 px-2.5 pb-2.5">
          {(['front', 'back', 'left', 'right'] as const).map((side) => (
            <Field key={side} id={`clearance-${side}`} label={`${side[0].toUpperCase()}${side.slice(1)} (m)`}>
              <CommitInput
                id={`clearance-${side}`}
                className="h-8"
                min={0}
                step={0.1}
                value={clearance[side] / 1000}
                isValid={(m) => Number.isFinite(m) && m >= 0}
                onCommit={(m) => updateClearance(machine.id, { [side]: Math.round(m * 1000) })}
              />
            </Field>
          ))}
        </div>
      </details>

      <details className="rounded-md border">
        <summary className="cursor-pointer px-2.5 py-2 text-xs font-medium">Position and dimensions</summary>
        <div className="space-y-3 px-2.5 pb-2.5">
          <PositionFields
            id={machine.id}
            x={machine.x}
            y={machine.y}
            onMove={(x, y) => moveMachine(machine.id, x, y)}
          />
          <p className="text-[11px] text-muted-foreground">Position is the machine's centre.</p>
          {machine.length !== undefined ? (
            <Field id="belt-length-prop" label="Length (m)">
              <CommitInput
                key={machine.id}
                id="belt-length-prop"
                className="h-8"
                min={1}
                max={30}
                step={0.5}
                value={machine.length / 1000}
                isValid={(m) => isValidConveyorLength(m * 1000)}
                onCommit={(m) => setBeltLength(machine.id, Math.round(m * 1000))}
              />
            </Field>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <Field id="machine-width" label="Base width (m)">
                <CommitInput
                  id="machine-width"
                  className="h-8"
                  min={0.1}
                  step={0.1}
                  value={(machine.width ?? type.width) / 1000}
                  isValid={(m) => Number.isFinite(m) && m > 0}
                  onCommit={(m) => updateDimensions(machine.id, { width: Math.round(m * 1000) })}
                />
              </Field>
              <Field id="machine-depth" label="Base depth (m)">
                <CommitInput
                  id="machine-depth"
                  className="h-8"
                  min={0.1}
                  step={0.1}
                  value={(machine.depth ?? type.depth) / 1000}
                  isValid={(m) => Number.isFinite(m) && m > 0}
                  onCommit={(m) => updateDimensions(machine.id, { depth: Math.round(m * 1000) })}
                />
              </Field>
            </div>
          )}
          <Field id="machine-height" label="Height (m, checked under height limits)">
            <OptionalDimensionInput
              id="machine-height"
              className="h-8"
              placeholder={type.height === undefined ? 'Not specified' : `${formatMetres(type.height)} (typical)`}
              value={machine.height}
              onCommit={(m) => updateDimensions(machine.id, { height: m === undefined ? undefined : Math.round(m * 1000) })}
            />
          </Field>
        </div>
      </details>

      {sectionsAfterPosition}

      <details className="rounded-md border">
        <summary className="cursor-pointer px-2.5 py-2 text-xs font-medium">Advanced settings</summary>
        <div className="space-y-3 px-2.5 pb-2.5">
          {run && (
            <div className="rounded-md border bg-muted/40 px-3 py-2 text-xs">
              <div className="font-medium">
                {run.pieceIds.length > 1 ? 'Conveyor run' : 'Conveyor (not joined)'}
              </div>
              <div className="mt-0.5 text-muted-foreground">
                {run.pieceIds.length} {run.pieceIds.length === 1 ? 'piece' : 'pieces'} ·{' '}
                {Math.round(run.length / 100) / 10} m · {run.powerKw} kW, one drive
              </div>
              {run.pieceIds.length > 1 && (
                <div className="mt-1.5 text-muted-foreground">
                  {singlePieceId === machine.id
                    ? 'Moving this piece on its own. Click elsewhere to move the whole run again.'
                    : 'Dragging moves the whole run. Double-click a piece to move it on its own.'}
                </div>
              )}
            </div>
          )}

          <div className="space-y-1.5">
            <Button variant="outline" className="w-full" onClick={checkWithBackend} disabled={!floorplan || visibleServerCheck?.state === 'checking'}>
              {visibleServerCheck?.state === 'checking' ? 'Checking with backend…' : 'Check placement with backend'}
            </Button>
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              Checks the selected machine against the hall and other machines using the backend placement endpoint.
            </p>
            {visibleServerCheck && visibleServerCheck.state !== 'checking' && (
              <p
                role="status"
                className={cn(
                  'rounded-md border p-2 text-xs',
                  visibleServerCheck.state === 'passed' && 'border-emerald-500/30 bg-emerald-500/5 text-emerald-700 dark:text-emerald-300',
                  visibleServerCheck.state === 'blocked' && 'border-warning/40 bg-warning/5 text-foreground',
                  visibleServerCheck.state === 'error' && 'border-destructive/40 bg-destructive/10 text-destructive',
                )}
              >
                {visibleServerCheck.message}
              </p>
            )}
          </div>
        </div>
      </details>

      <div className="flex gap-2">
        <Button variant="secondary" className="flex-1" onClick={() => rotateMachine(machine.id)}>
          Rotate 15°
        </Button>
        <Button
          variant="ghost"
          className="flex-1 text-muted-foreground hover:text-destructive"
          onClick={() => animateNodeOut(machine.id, () => removeMachine(machine.id))}
        >
          Delete
        </Button>
      </div>
    </div>
  )
}

/** A station's own name, the work done there, how many people work there, and its colour. */
function StationDetails({
  machine,
  autoName,
  onChange,
}: {
  machine: MachineInstance
  /** The automatic name ("CNC 01"), shown as the placeholder. */
  autoName: string
  onChange: (patch: Partial<Pick<MachineInstance, 'name' | 'work' | 'people' | 'colour'>>) => void
}) {
  const autoColour = stationColour(undefined, getMachineType(machine.typeId)?.category)
  return (
    <details open className="rounded-md border bg-muted/20">
      <summary className="cursor-pointer list-none px-2.5 py-2 text-xs font-medium [&::-webkit-details-marker]:hidden">
        Station
      </summary>
      <div className="space-y-2.5 px-2.5 pb-2.5">
        <Field id="station-name" label="Name">
          <CommitText id="station-name" className="h-8" value={machine.name ?? ''} placeholder={autoName} onCommit={(name) => onChange({ name })} />
        </Field>
        <Field id="station-work" label="Work done here">
          <CommitText
            id="station-work"
            multiline
            value={machine.work ?? ''}
            placeholder="e.g. Drill and rivet the wing spar"
            onCommit={(work) => onChange({ work })}
          />
        </Field>
        <div className="grid grid-cols-2 gap-2">
          <Field id="station-people" label="People">
            <CommitInput
              id="station-people"
              className="h-8"
              min={0}
              step={1}
              value={machinePeople(machine) ?? 0}
              isValid={(n) => Number.isInteger(n) && n >= 0 && n <= 99}
              onCommit={(n) => onChange({ people: n })}
            />
          </Field>
          <ColourSwatches
            value={machine.colour}
            auto={{ colour: autoColour, onPick: () => onChange({ colour: undefined }) }}
            onChange={(colour) => onChange({ colour })}
          />
        </div>
      </div>
    </details>
  )
}

/**
 * A row of colour swatches to pick from (MACHINE_COLOURS). With `auto`, it is led by an
 * "Auto" swatch: the category's colour, stored as no colour so the station follows its category.
 */
function ColourSwatches({
  value,
  auto,
  onChange,
}: {
  value: string | undefined
  auto?: { colour: string; onPick: () => void }
  onChange: (hex: string) => void
}) {
  return (
    <div className="space-y-1.5">
      <span className="text-xs text-muted-foreground">Colour</span>
      <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Colour">
        {auto && (
          <button
            type="button"
            role="radio"
            aria-checked={value === undefined}
            title="Auto (by category)"
            aria-label="Auto (by category)"
            onClick={auto.onPick}
            className={cn(
              'grid size-5 place-items-center rounded-full border border-black/15 text-[9px] font-bold text-white transition-transform hover:scale-110',
              value === undefined && 'ring-2 ring-accent ring-offset-1 ring-offset-background',
            )}
            style={{ backgroundColor: auto.colour }}
          >
            A
          </button>
        )}
        {MACHINE_COLOURS.map((c) => (
          <button
            key={c.hex}
            type="button"
            role="radio"
            aria-checked={value === c.hex}
            title={c.name}
            aria-label={c.name}
            onClick={() => onChange(c.hex)}
            className={cn(
              'size-5 rounded-full border border-black/15 transition-transform hover:scale-110',
              value === c.hex && 'ring-2 ring-accent ring-offset-1 ring-offset-background',
            )}
            style={{ backgroundColor: c.hex }}
          />
        ))}
      </div>
    </div>
  )
}

/** A zone: name, type, colour, max height (height limits), position, size and what stands in it. */
function ZoneProperties({ zone }: { zone: Zone }) {
  const updateZone = usePlanner((s) => s.updateZone)
  const removeZone = usePlanner((s) => s.removeZone)
  const machines = usePlanner((s) => s.machines)
  const inside = useMemo(() => machinesInZone(zone, machines), [zone, machines])
  const info = ZONE_KINDS[zone.kind]

  function setKind(kind: ZoneKind) {
    // A zone still in its type's default colour takes the new type's colour.
    const colour = zone.colour === info.colour ? ZONE_KINDS[kind].colour : zone.colour
    updateZone(zone.id, { kind, colour })
  }

  return (
    <div className="space-y-3">
      <div>
        <div className="text-sm font-semibold">{zone.name}</div>
        <div className="text-xs text-muted-foreground">
          {info.name === 'Area' ? 'Zone' : info.name} · {formatMetres(zone.width)} × {formatMetres(zone.depth)} m ·{' '}
          {zoneArea(zone)} m²
        </div>
      </div>

      <Field id="zone-name" label="Name">
        <CommitText id="zone-name" className="h-8" value={zone.name} placeholder={info.name} onCommit={(name) => name.trim() && updateZone(zone.id, { name: name.trim() })} />
      </Field>

      <div className="space-y-1.5">
        <span className="text-xs text-muted-foreground">Type</span>
        <div className="grid grid-cols-3 gap-1" role="radiogroup" aria-label="Zone type">
          {ZONE_KIND_LIST.map((k) => (
            <button
              key={k.kind}
              type="button"
              role="radio"
              aria-checked={zone.kind === k.kind}
              onClick={() => setKind(k.kind)}
              title={k.description}
              className={cn(
                'rounded-md border px-1.5 py-1 text-xs transition-colors hover:bg-muted',
                zone.kind === k.kind && 'border-accent bg-accent/15 font-medium',
              )}
            >
              {k.kind === 'area' ? 'Zone' : k.name}
            </button>
          ))}
        </div>
        <p className="text-[11px] text-muted-foreground">
          {zone.kind === 'area' && 'A labelled area; no rules.'}
          {zone.kind === 'aisle' && 'Keep clear: a machine standing in it gets a warning.'}
          {zone.kind === 'height' && 'Machines under it may be no taller than its max height.'}
        </p>
      </div>

      {zone.kind === 'height' && (
        <Field id="zone-max-height" label="Max height (m)">
          <CommitInput
            id="zone-max-height"
            className="h-8"
            min={0.5}
            step={0.1}
            value={(zone.maxHeight ?? 0) / 1000}
            isValid={(m) => m > 0}
            onCommit={(m) => updateZone(zone.id, { maxHeight: Math.round(m * 1000) })}
          />
        </Field>
      )}

      <ColourSwatches value={zone.colour} onChange={(colour) => updateZone(zone.id, { colour })} />

      <div className="grid grid-cols-2 gap-2">
        <Field id="zone-width" label="Width (m)">
          <CommitInput
            id="zone-width"
            className="h-8"
            min={MIN_ZONE_SIZE / 1000}
            step={0.5}
            value={zone.width / 1000}
            isValid={(m) => m * 1000 >= MIN_ZONE_SIZE}
            onCommit={(m) => updateZone(zone.id, { width: Math.round(m * 1000) })}
          />
        </Field>
        <Field id="zone-depth" label="Depth (m)">
          <CommitInput
            id="zone-depth"
            className="h-8"
            min={MIN_ZONE_SIZE / 1000}
            step={0.5}
            value={zone.depth / 1000}
            isValid={(m) => m * 1000 >= MIN_ZONE_SIZE}
            onCommit={(m) => updateZone(zone.id, { depth: Math.round(m * 1000) })}
          />
        </Field>
      </div>
      <PositionFields id={zone.id} x={zone.x} y={zone.y} onMove={(x, y) => updateZone(zone.id, { x, y })} />
      <p className="text-[11px] text-muted-foreground">
        Position is the zone's centre. Drag the name tag to move it, or a corner to resize it.
      </p>

      <div className="rounded-md border bg-muted/20 p-2.5 text-xs">
        <div className="font-medium">In this zone</div>
        <div className="mt-0.5 text-muted-foreground">
          {inside.length === 0 ? 'No machines' : inside.map((m) => machineName(m, machines)).join(', ')}
        </div>
      </div>

      <Button variant="ghost" className="w-full text-muted-foreground hover:text-destructive" onClick={() => removeZone(zone.id)}>
        Delete
      </Button>
    </div>
  )
}

function UtilityProperties({ utility }: { utility: Utility }) {
  const moveUtility = usePlanner((s) => s.moveUtility)
  const updateUtility = usePlanner((s) => s.updateUtility)
  const removeUtility = usePlanner((s) => s.removeUtility)
  const machines = usePlanner((s) => s.machines)
  const utilities = usePlanner((s) => s.utilities)
  const walls = usePlanner((s) => s.walls)
  const serviceStations = usePlanner((s) => s.truckServiceStations)

  const info = UTILITY_KINDS[utility.kind]
  const Icon = UTILITY_ICONS[utility.kind]
  const load = useMemo(
    () =>
      utility.kind === 'power'
        ? (powerAssignments(machines, utilities, walls, serviceStations).loads.get(utility.id) ?? 0)
        : 0,
    [utility.kind, utility.id, machines, utilities, walls, serviceStations],
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
          <Field id="utility-radius" label={utility.kind === 'extinguisher' ? 'Walking distance (m)' : 'Reach (m)'}>
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
        variant="ghost"
        className="w-full text-muted-foreground hover:text-destructive"
        onClick={() => animateNodeOut(utility.id, () => removeUtility(utility.id))}
      >
        Delete
      </Button>
    </div>
  )
}

function PillarProperties({ pillar }: { pillar: Pillar }) {
  const movePillar = usePlanner((s) => s.movePillar)
  const resizePillar = usePlanner((s) => s.resizePillar)
  const removePillar = usePlanner((s) => s.removePillar)

  return (
    <div className="space-y-4">
      <div>
        <div className="text-sm font-medium">Pillar</div>
        <div className="mt-1 text-xs text-muted-foreground">Building element · not a station</div>
      </div>

      <PositionFields
        id={pillar.id}
        x={pillar.x}
        y={pillar.y}
        onMove={(x, y) => movePillar(pillar.id, x, y)}
      />

      {/* key by pillar so switching selection resets the fields */}
      <div key={pillar.id} className="grid grid-cols-2 gap-3">
        <Field id="pillar-width" label="Width (m)">
          <CommitInput
            id="pillar-width"
            className="h-8"
            min={0}
            step={0.1}
            value={pillar.width / 1000}
            isValid={(m) => m > 0}
            onCommit={(m) => resizePillar(pillar.id, Math.round(m * 1000), pillar.depth)}
          />
        </Field>
        <Field id="pillar-depth" label="Depth (m)">
          <CommitInput
            id="pillar-depth"
            className="h-8"
            min={0}
            step={0.1}
            value={pillar.depth / 1000}
            isValid={(m) => m > 0}
            onCommit={(m) => resizePillar(pillar.id, pillar.width, Math.round(m * 1000))}
          />
        </Field>
      </div>
      <p className="text-xs text-muted-foreground">Position is the pillar's centre.</p>

      <Button
        variant="ghost"
        className="w-full text-muted-foreground hover:text-destructive"
        onClick={() => animateNodeOut(pillar.id, () => removePillar(pillar.id))}
      >
        Delete
      </Button>
    </div>
  )
}

function WallProperties({ wall }: { wall: Wall }) {
  const updateWall = usePlanner((s) => s.updateWall)
  const removeWall = usePlanner((s) => s.removeWall)

  const horizontal = wall.start.y === wall.end.y
  const length = wallLength(wall)

  /** Keep the start and direction; move the end to the new length. */
  function setLength(mm: number) {
    const sx = Math.sign(wall.end.x - wall.start.x) || 1
    const sy = Math.sign(wall.end.y - wall.start.y) || 1
    const end = horizontal
      ? { x: wall.start.x + sx * mm, y: wall.start.y }
      : { x: wall.start.x, y: wall.start.y + sy * mm }
    updateWall(wall.id, { end })
  }

  /** Move the whole wall so its start lands on (x, y). */
  function moveStart(x: number, y: number) {
    const dx = x - wall.start.x
    const dy = y - wall.start.y
    updateWall(wall.id, {
      start: { x, y },
      end: { x: wall.end.x + dx, y: wall.end.y + dy },
    })
  }

  return (
    <div className="space-y-4">
      <div>
        <div className="text-sm font-medium">Wall</div>
        <div className="mt-1 text-xs text-muted-foreground">
          {horizontal ? 'Horizontal' : 'Vertical'} · building element
        </div>
      </div>

      <PositionFields id={wall.id} x={wall.start.x} y={wall.start.y} onMove={moveStart} />
      <p className="text-xs text-muted-foreground">Position is the wall's start point.</p>

      {/* key by wall so switching selection resets the fields */}
      <div key={wall.id} className="grid grid-cols-2 gap-3">
        <Field id="wall-length" label="Length (m)">
          <CommitInput
            id="wall-length"
            className="h-8"
            min={0}
            step={0.5}
            value={Number((length / 1000).toFixed(3))}
            isValid={(m) => m * 1000 >= MIN_WALL_LENGTH}
            onCommit={(m) => setLength(Math.round(m * 1000))}
          />
        </Field>
        <Field id="wall-thickness" label="Thickness (m)">
          <CommitInput
            id="wall-thickness"
            className="h-8"
            min={0}
            step={0.05}
            value={wall.thickness / 1000}
            isValid={(m) => m > 0}
            onCommit={(m) => updateWall(wall.id, { thickness: Math.round(m * 1000) })}
          />
        </Field>
      </div>

      <Button
        variant="ghost"
        className="w-full text-muted-foreground hover:text-destructive"
        onClick={() => animateNodeOut(wall.id, () => removeWall(wall.id))}
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
      <Field id="pos-x" label="X (m)">
        <CommitInput id="pos-x" className="h-8" step={0.01} value={x / 1000} onCommit={(v) => onMove(Math.round(v * 1000), y)} />
      </Field>
      <Field id="pos-y" label="Y (m)">
        <CommitInput id="pos-y" className="h-8" step={0.01} value={y / 1000} onCommit={(v) => onMove(x, Math.round(v * 1000))} />
      </Field>
    </div>
  )
}

function OptionalDimensionInput({
  value,
  onCommit,
  ...props
}: Omit<React.ComponentProps<typeof Input>, 'value' | 'onChange'> & {
  value: number | undefined
  onCommit: (value: number | undefined) => void
}) {
  const [text, setText] = useState(value === undefined ? '' : String(value / 1000))
  const [lastValue, setLastValue] = useState(value)
  if (value !== lastValue) {
    setLastValue(value)
    setText(value === undefined ? '' : String(value / 1000))
  }

  function commit() {
    if (text.trim() === '') {
      if (value !== undefined) onCommit(undefined)
      return
    }

    const next = Number(text)
    if (Number.isFinite(next) && next > 0) {
      if (Math.round(next * 1000) !== value) onCommit(next)
    } else {
      setText(value === undefined ? '' : String(value / 1000))
    }
  }

  return (
    <Input
      type="number"
      min={0.01}
      step={0.01}
      placeholder="Not specified"
      {...props}
      value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
    />
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

function PropertyValue({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div className="font-medium">{value}</div>
    </div>
  )
}

function formatMetres(mm: number) {
  return String(Number((mm / 1000).toFixed(2)))
}

