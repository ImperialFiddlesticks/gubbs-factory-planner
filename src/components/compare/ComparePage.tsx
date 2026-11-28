import { useMemo, useRef, useState } from 'react'
import { ArrowLeft, Check, Eye, EyeOff, Plus, Trash2 } from 'lucide-react'
import { CompareOverlay, type OverlayContent, type OverlayPlan } from '@/components/compare/CompareOverlay'
import { FloorPreview } from '@/components/compare/FloorPreview'
import { Button } from '@/components/ui/button'
import { projectFigures, type ProjectFigures } from '@/lib/compare'
import { useElementSize } from '@/lib/useElementSize'
import { cn } from '@/lib/utils'
import { currentProject, usePlanner, type Project } from '@/store'
import { CANVAS } from '@/theme'
import { useShallow } from 'zustand/react/shallow'

const PREVIEW_PADDING = 24
const BASE_COLORS = ['#2563eb', '#dc2626', '#059669', '#9333ea', '#ea580c', '#0891b2', '#be185d', '#4d7c0f', '#7c3aed', '#b45309', '#0f766e', '#c026d3', '#1d4ed8', '#b91c1c', '#15803d', '#a21caf']
const CONTENT_LABELS: { key: OverlayContent; label: string }[] = [
  { key: 'machines', label: 'Machines' },
  { key: 'utilities', label: 'Utilities' },
  { key: 'structures', label: 'Walls, pillars & zones' },
  { key: 'loading', label: 'Loading bays & docks' },
  { key: 'logistics', label: 'Forklifts & logistics' },
]

function generatedColor(index: number) {
  if (index < BASE_COLORS.length) return BASE_COLORS[index]
  const hue = (index * 137.508) % 360
  const chroma = 0.72
  const x = chroma * (1 - Math.abs((hue / 60) % 2 - 1))
  const m = 0.5 - chroma / 2
  const [r, g, b] = hue < 60 ? [chroma, x, 0] : hue < 120 ? [x, chroma, 0] : hue < 180 ? [0, chroma, x] : hue < 240 ? [0, x, chroma] : hue < 300 ? [x, 0, chroma] : [chroma, 0, x]
  return `#${[r, g, b].map((value) => Math.round((value + m) * 255).toString(16).padStart(2, '0')).join('')}`
}

export function ComparePage() {
  const current = usePlanner(useShallow(currentProject))
  const saved = usePlanner((s) => s.projects)
  const openProject = usePlanner((s) => s.openProject)
  const closeCompare = usePlanner((s) => s.closeCompare)
  const all = useMemo(() => {
    const unique = new Map<string, Project>()
    for (const project of (current ? [current, ...saved] : saved)) unique.set(project.floorplan.id, project)
    return [...unique.values()]
  }, [current, saved])
  const [ids, setIds] = useState<string[]>(() => all.slice(0, 2).map((project) => project.floorplan.id))
  const [referenceId, setReferenceId] = useState(() => all[0]?.floorplan.id ?? '')
  const [colors, setColors] = useState<Record<string, string>>(() => Object.fromEntries(all.map((project, index) => [project.floorplan.id, generatedColor(index)])))
  const [visible, setVisible] = useState<Record<string, boolean>>({})
  const [view, setView] = useState<'overlay' | 'side-by-side'>('side-by-side')
  const [overlayScope, setOverlayScope] = useState<'all' | 'reference'>('all')
  const [focusId, setFocusId] = useState('')
  const [opacity, setOpacity] = useState(20)
  const [content, setContent] = useState<Record<OverlayContent, boolean>>({ machines: true, utilities: true, structures: true, logistics: true, loading: true })
  const picked = useMemo(() => ids.flatMap((id) => {
    const project = all.find((item) => item.floorplan.id === id)
    return project ? [project] : []
  }), [ids, all])
  const effectiveReferenceId = picked.some((project) => project.floorplan.id === referenceId) ? referenceId : picked[0]?.floorplan.id ?? ''
  const focusOptions = picked.filter((project) => project.floorplan.id !== effectiveReferenceId)
  const effectiveFocusId = focusOptions.some((project) => project.floorplan.id === focusId) ? focusId : focusOptions[0]?.floorplan.id ?? ''
  const figures = useMemo(() => picked.map((project) => projectFigures(project)), [picked])
  const summaryRows = useMemo(() => metricRowsFor(figures), [figures])

  const previewRef = useRef<HTMLDivElement>(null)
  const previewSize = useElementSize(previewRef, view === 'side-by-side')
  const overlayRef = useRef<HTMLDivElement>(null)
  const overlaySize = useElementSize(overlayRef, view === 'overlay')
  const maxW = Math.max(1, ...picked.map((project) => project.floorplan.width))
  const maxD = Math.max(1, ...picked.map((project) => project.floorplan.depth))
  const pxPerMm = Math.max(0, Math.min((previewSize.width - PREVIEW_PADDING * 2) / maxW, (previewSize.height - PREVIEW_PADDING * 2) / maxD))
  const displayProjects = overlayScope === 'all'
    ? picked
    : picked.filter((project) => [effectiveReferenceId, effectiveFocusId].includes(project.floorplan.id))
  const overlayPlans: OverlayPlan[] = displayProjects.map((project) => ({
    project,
    color: colors[project.floorplan.id] ?? generatedColor(all.findIndex((item) => item.floorplan.id === project.floorplan.id)),
    visible: visible[project.floorplan.id] !== false,
  }))

  function addPlan(id: string) {
    if (!id || ids.includes(id)) return
    const index = all.findIndex((project) => project.floorplan.id === id)
    const usedColors = new Set(picked.map((project) => colors[project.floorplan.id]))
    const newColor = Array.from({ length: all.length + 1 }, (_, colorIndex) => generatedColor(colorIndex)).find((candidate) => !usedColors.has(candidate)) ?? generatedColor(index)
    setIds((previous) => [...previous, id])
    setColors((previous) => ({ ...previous, [id]: previous[id] ?? newColor }))
    if (!effectiveFocusId) setFocusId(id)
  }

  function removePlan(id: string) {
    if (ids.length <= 1) return
    const remaining = ids.filter((item) => item !== id)
    setIds(remaining)
    if (effectiveReferenceId === id) setReferenceId(remaining[0])
    if (effectiveFocusId === id) setFocusId(remaining.find((item) => item !== (effectiveReferenceId === id ? remaining[0] : effectiveReferenceId)) ?? '')
  }

  function open(project: Project) {
    if (project.floorplan.id === current?.floorplan.id) closeCompare()
    else openProject(project.floorplan.id)
  }

  return (
    <div className="flex h-screen flex-col bg-background">
      <header className="relative z-10 border-b bg-card shadow-soft">
        <div className="flex h-14 items-center gap-3 px-4">
          <span className="h-6 w-1 bg-accent" aria-hidden />
          <span className="text-sm font-semibold tracking-widest uppercase">Factory Planner</span>
          <span className="text-sm text-muted-foreground">Compare projects</span>
          <Button variant="ghost" size="sm" className="ml-auto" onClick={closeCompare}><ArrowLeft /> Back to planner</Button>
        </div>
      </header>

      <main className="mx-auto flex min-h-0 w-full max-w-[1600px] flex-1 flex-col gap-5 overflow-y-auto p-4 md:p-6">
        <section className="space-y-4 rounded-lg border bg-card p-4 shadow-sm" aria-label="Plans in comparison">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-base font-semibold">Compare plans <span className="font-normal text-muted-foreground">({picked.length})</span></h1>
              <p className="mt-1 text-xs text-muted-foreground">Choose a reference and show or hide layers to focus the comparison.</p>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <span className="font-medium">Add plan</span>
              <select aria-label="Add plan to comparison" value="" onChange={(event) => addPlan(event.target.value)} className="h-9 max-w-64 rounded-md border bg-background px-2">
                <option value="">Choose a saved plan</option>
                {all.filter((project) => !ids.includes(project.floorplan.id)).map((project) => <option key={project.floorplan.id} value={project.floorplan.id}>{project.floorplan.name}{project.floorplan.id === current?.floorplan.id ? ' (open)' : ''}</option>)}
              </select>
              <Plus className="size-4 text-muted-foreground" aria-hidden />
            </label>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
            {picked.map((project) => {
              const id = project.floorplan.id
              const isVisible = visible[id] !== false
              const isReference = effectiveReferenceId === id
              return <div key={id} className={cn('flex min-w-0 items-center gap-2 rounded-md border bg-background p-2 transition-colors', !isVisible && 'opacity-60')}>
                <input type="color" aria-label={`Color for ${project.floorplan.name}`} value={colors[id] ?? generatedColor(all.indexOf(project))} onChange={(event) => setColors((previous) => ({ ...previous, [id]: event.target.value }))} className="size-8 shrink-0 cursor-pointer rounded border-0 bg-transparent p-0.5" />
                <span className="min-w-0 flex-1 truncate text-sm font-medium" title={project.floorplan.name}>{project.floorplan.name}</span>
                <Button variant={isReference ? 'secondary' : 'outline'} size="xs" aria-pressed={isReference} aria-label={`Use ${project.floorplan.name} as reference`} onClick={() => setReferenceId(id)} className="gap-1">
                  {isReference && <Check className="size-3" aria-hidden />}{isReference ? 'Reference' : 'Set ref'}
                </Button>
                <span className="mx-0.5 h-5 border-l" aria-hidden />
                <Button variant="ghost" size="icon-xs" aria-label={`${isVisible ? 'Hide' : 'Show'} ${project.floorplan.name}`} aria-pressed={isVisible} onClick={() => setVisible((previous) => ({ ...previous, [id]: !isVisible }))}>
                  {isVisible ? <Eye className="size-3.5" /> : <EyeOff className="size-3.5" />}
                </Button>
                <Button variant="ghost" size="icon-xs" aria-label={`Remove ${project.floorplan.name}`} disabled={ids.length <= 1} onClick={() => removePlan(id)}><Trash2 className="size-3.5" /></Button>
              </div>
            })}
          </div>
        </section>

        <div className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card/95 p-3 shadow-sm backdrop-blur" aria-label="Comparison view">
          <div>
            <h2 className="text-sm font-semibold">Layout view</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">Compare factory drawings side by side or aligned on top of each other.</p>
          </div>
          <ViewSwitch view={view} onChange={setView} />
        </div>

        {view === 'overlay' && <section className="shrink-0 overflow-hidden rounded-lg border bg-card shadow-sm" aria-label="Plan overlay">
          <div className="border-b p-3 sm:p-4">
            <h2 className="text-sm font-semibold">Layout overlay</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">Plans share one coordinate system and scale.</p>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b px-3 py-3 sm:px-4">
            <label className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">Show</span>
              <select value={overlayScope} onChange={(event) => setOverlayScope(event.target.value as 'all' | 'reference')} className="h-8 rounded-md border bg-background px-2">
                <option value="all">All selected plans</option>
                <option value="reference">One plan vs reference</option>
              </select>
            </label>
            {overlayScope === 'reference' && <label className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">Compare</span>
              <select aria-label="Plan compared with reference" value={effectiveFocusId} onChange={(event) => setFocusId(event.target.value)} className="h-8 max-w-52 rounded-md border bg-background px-2">
                {focusOptions.map((project) => <option key={project.floorplan.id} value={project.floorplan.id}>{project.floorplan.name}</option>)}
              </select>
            </label>}
            <label className="flex items-center gap-2 text-sm sm:ml-auto">
              <span className="text-muted-foreground">Fill opacity</span>
              <input aria-label="Overlay fill opacity" type="range" min="6" max="38" value={opacity} onChange={(event) => setOpacity(Number(event.target.value))} className="w-24 accent-primary" />
              <span className="w-9 text-right text-xs tabular-nums text-muted-foreground">{opacity}%</span>
            </label>
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-2 border-b px-3 py-3 sm:px-4" aria-label="Overlay content">
            {CONTENT_LABELS.map(({ key, label }) => <label key={key} className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
              <input type="checkbox" checked={content[key]} onChange={(event) => setContent((previous) => ({ ...previous, [key]: event.target.checked }))} className="accent-primary" />{label}
            </label>)}
          </div>
          <div className="flex flex-wrap gap-2 border-b bg-muted/20 px-3 py-3 sm:px-4" aria-label="Visible plan legend">
            {overlayPlans.map(({ project, color, visible: isVisible }) => <div key={project.floorplan.id} className={cn('flex min-w-0 max-w-full items-center gap-2 rounded-md border bg-background px-2.5 py-1.5 text-xs', !isVisible && 'opacity-45')} title={project.floorplan.name}>
              <span className="size-3 shrink-0 rounded-sm border" style={{ backgroundColor: color }} aria-hidden />
              <span className="max-w-56 truncate font-medium">{project.floorplan.name}</span>
              {project.floorplan.id === effectiveReferenceId && <span className="shrink-0 rounded bg-secondary px-1.5 py-0.5 text-[10px] font-medium text-secondary-foreground">Ref</span>}
            </div>)}
          </div>
          <div ref={overlayRef} className="h-[58vh] min-h-[300px] max-h-[680px] w-full overflow-hidden" style={{ backgroundColor: CANVAS.background }}>
            {overlaySize.width > 0 && overlaySize.height > 0 && overlayPlans.some((plan) => plan.visible)
              ? <CompareOverlay plans={overlayPlans} width={overlaySize.width} height={overlaySize.height} opacity={opacity / 100} content={content} referenceId={effectiveReferenceId} />
              : <div className="flex h-full items-center justify-center px-6 text-center text-sm text-muted-foreground">Show a plan layer to display its hall and layout.</div>}
          </div>
          <p className="border-t px-3 py-2 text-xs text-muted-foreground sm:px-4">Overlay is planning support, not certified safety validation.</p>
        </section>}

        {view === 'overlay' && <FactorySummaries projects={picked} rows={summaryRows} colors={colors} all={all} />}

        {view === 'side-by-side' && <section className="space-y-3" aria-label="Side-by-side plans">
          <div className="rounded-lg border bg-card px-4 py-3 shadow-sm">
            <h2 className="text-sm font-semibold">Side-by-side layouts</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">Each preview uses the same scale for direct size comparison.</p>
          </div>
          <div className="grid min-h-[320px] grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {picked.map((project, index) => <article key={project.floorplan.id} className="flex min-h-[320px] min-w-0 flex-col overflow-hidden rounded-lg border bg-card shadow-sm">
              <div className="flex items-center gap-2 border-b p-3">
                <span className="size-3 shrink-0 rounded-sm border" style={{ backgroundColor: colors[project.floorplan.id] ?? generatedColor(all.indexOf(project)) }} aria-hidden />
                <span className="min-w-0 flex-1 truncate text-sm font-medium" title={project.floorplan.name}>{project.floorplan.name}{project.floorplan.id === effectiveReferenceId ? ' · reference' : ''}</span>
                <Button size="sm" onClick={() => open(project)}>Open</Button>
              </div>
              <div ref={index === 0 ? previewRef : undefined} className="h-[38vh] min-h-[300px] max-h-[460px] shrink-0" style={{ backgroundColor: CANVAS.background }}>
                {previewSize.width > 0 && pxPerMm > 0 && <FloorPreview project={project} pxPerMm={pxPerMm} width={previewSize.width} height={previewSize.height} />}
              </div>
              <div className="border-t p-3 sm:p-4">
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Factory summary</h3>
                <PlanMetricList rows={summaryRows} planIndex={index} />
              </div>
            </article>)}
          </div>
        </section>}


      </main>
    </div>
  )
}

function ViewSwitch({ view, onChange }: { view: 'overlay' | 'side-by-side'; onChange: (view: 'overlay' | 'side-by-side') => void }) {
  return <div className="inline-flex rounded-md border bg-muted/50 p-1" role="group" aria-label="Comparison view">
    <Button size="sm" variant={view === 'overlay' ? 'secondary' : 'ghost'} aria-pressed={view === 'overlay'} onClick={() => onChange('overlay')}>Overlay</Button>
    <Button size="sm" variant={view === 'side-by-side' ? 'secondary' : 'ghost'} aria-pressed={view === 'side-by-side'} onClick={() => onChange('side-by-side')}>Side by side</Button>
  </div>
}

interface MetricRow {
  label: string
  values: string[]
  bestIndex: number | null
}

function metricRowsFor(figures: ProjectFigures[]): MetricRow[] {
  const walk = (figure: ProjectFigures) => figure.longestWalk === null ? '—' : figure.longestWalk === Infinity ? 'no route' : metres(figure.longestWalk)
  const lowerIndex = (values: number[]) => {
    const lowest = Math.min(...values)
    return values.filter((value) => value === lowest).length === 1 ? values.indexOf(lowest) : null
  }
  const higherIndex = (values: number[]) => {
    const highest = Math.max(...values)
    return values.filter((value) => value === highest).length === 1 ? values.indexOf(highest) : null
  }

  return [
    { label: 'Stations', values: figures.map((f) => `${f.stations} / ${f.stationTarget}`), bestIndex: higherIndex(figures.map((f) => f.stations / Math.max(1, f.stationTarget))) },
    { label: 'Warnings', values: figures.map((f) => String(f.warnings)), bestIndex: lowerIndex(figures.map((f) => f.warnings)) },
    { label: 'Longest walk to an exit', values: figures.map(walk), bestIndex: figures.some((f) => f.longestWalk === null) ? null : lowerIndex(figures.map((f) => f.longestWalk ?? Infinity)) },
    { label: 'Floor used by machines', values: figures.map((f) => `${Math.round(f.floorUsed * 100)} % of ${Math.round(f.floorArea)} m²`), bestIndex: null },
    { label: 'Total power', values: figures.map((f) => `${f.powerKw} kW`), bestIndex: null },
    { label: 'Conveyor length', values: figures.map((f) => metres(f.conveyorLength)), bestIndex: null },
  ]
}

function PlanMetricList({ rows, planIndex }: { rows: MetricRow[]; planIndex: number }) {
  return <dl className="grid grid-cols-1 gap-x-4">
    {rows.map((row) => <div key={row.label} className="flex min-w-0 items-center justify-between gap-3 border-b py-2 last:border-0">
      <dt className="min-w-0 truncate text-xs text-muted-foreground" title={row.label}>{row.label}</dt>
      <dd className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap text-sm tabular-nums">
        {row.values[planIndex]}
        {row.bestIndex === planIndex && <Check className="size-3.5 text-(--feedback-green)" aria-label="Best among selected factories" />}
      </dd>
    </div>)}
  </dl>
}

function FactorySummaries({
  projects,
  rows,
  colors,
  all,
}: {
  projects: Project[]
  rows: MetricRow[]
  colors: Record<string, string>
  all: Project[]
}) {
  return <section className="space-y-3" aria-label="Factory summaries">
    <div>
      <h2 className="text-sm font-semibold">Factory summaries</h2>
      <p className="mt-0.5 text-xs text-muted-foreground">Each factory’s key figures are grouped with its name and color.</p>
    </div>
    <div className={cn(
      'grid w-full gap-3',
      projects.length === 2
        ? 'mx-auto grid-cols-1 md:grid-cols-2 xl:w-[calc(66.666667%_-_4px)]'
        : 'sm:grid-cols-2 xl:grid-cols-3',
    )}>
      {projects.map((project, index) => {
        const id = project.floorplan.id
        const color = colors[id] ?? generatedColor(all.findIndex((item) => item.floorplan.id === id))
        return <article key={id} className="min-w-0 rounded-lg border bg-card p-3 shadow-sm sm:p-4">
          <div className="mb-2 flex min-w-0 items-center gap-2">
            <span className="size-3 shrink-0 rounded-sm border" style={{ backgroundColor: color }} aria-hidden />
            <h3 className="min-w-0 truncate text-sm font-semibold" title={project.floorplan.name}>{project.floorplan.name}</h3>
          </div>
          <PlanMetricList rows={rows} planIndex={index} />
        </article>
      })}
    </div>
  </section>
}
const metres = (mm: number) => `${Math.round(mm / 100) / 10} m`
