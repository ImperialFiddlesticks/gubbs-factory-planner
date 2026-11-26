import { useMemo, useRef, useState } from 'react'
import { ArrowLeft, Check } from 'lucide-react'
import { FloorPreview } from '@/components/compare/FloorPreview'
import { Button } from '@/components/ui/button'
import { projectFigures, type ProjectFigures } from '@/lib/compare'
import { useElementSize } from '@/lib/useElementSize'
import { cn } from '@/lib/utils'
import { currentProject, usePlanner, type Project } from '@/store'
import { CANVAS } from '@/theme'
import { useShallow } from 'zustand/react/shallow'

/** Space around the floors in each preview box, px. */
const PREVIEW_PADDING = 24

/**
 * Two projects side by side: both floors at the same scale, and a table of key figures with
 * the better value highlighted where "better" is clear.
 */
export function ComparePage() {
  // Shallow: currentProject builds a new object each time from unchanged parts.
  const current = usePlanner(useShallow(currentProject))
  const saved = usePlanner((s) => s.projects)
  const openProject = usePlanner((s) => s.openProject)
  const closeCompare = usePlanner((s) => s.closeCompare)

  const all = useMemo(() => (current ? [current, ...saved] : saved), [current, saved])
  const [ids, setIds] = useState<[string, string]>(() => [
    all[0]?.floorplan.id ?? '',
    all[1]?.floorplan.id ?? all[0]?.floorplan.id ?? '',
  ])
  const picked = useMemo(() => ids.map((id) => all.find((p) => p.floorplan.id === id) ?? all[0]), [ids, all])
  const figures = useMemo(() => picked.map((p) => (p ? projectFigures(p) : null)), [picked])

  // Both previews share one scale, set by the larger floor.
  const boxRef = useRef<HTMLDivElement>(null)
  const box = useElementSize(boxRef)
  const maxW = Math.max(...picked.map((p) => p?.floorplan.width ?? 1))
  const maxD = Math.max(...picked.map((p) => p?.floorplan.depth ?? 1))
  const pxPerMm = Math.max(0, Math.min((box.width - 2 * PREVIEW_PADDING) / maxW, (box.height - 2 * PREVIEW_PADDING) / maxD))

  function open(p: Project) {
    if (p.floorplan.id === current?.floorplan.id) closeCompare()
    else openProject(p.floorplan.id)
  }

  return (
    <div className="flex h-screen flex-col bg-background">
      <header className="theme-dark border-b">
        <div className="flex h-14 items-center gap-3 px-4">
          <span className="h-6 w-1 bg-accent" aria-hidden />
          <span className="text-sm font-semibold tracking-widest uppercase">Factory Planner</span>
          <span className="text-sm text-muted-foreground">Compare projects</span>
          <Button variant="ghost" size="sm" className="ml-auto" onClick={closeCompare}>
            <ArrowLeft /> Back to planner
          </Button>
        </div>
      </header>

      <main className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto p-6">
        <div className="grid min-h-[320px] flex-1 grid-cols-2 gap-6">
          {picked.map((p, i) => (
            <section key={i} className="flex min-h-0 flex-col rounded-lg border bg-card">
              <div className="flex items-center gap-2 border-b p-3">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-foreground text-xs font-semibold text-background">
                  {i === 0 ? 'A' : 'B'}
                </span>
                <select
                  aria-label={`Project ${i === 0 ? 'A' : 'B'}`}
                  value={p?.floorplan.id}
                  onChange={(e) => setIds((prev) => (i === 0 ? [e.target.value, prev[1]] : [prev[0], e.target.value]))}
                  className="h-8 min-w-0 flex-1 rounded-md border bg-background px-2 text-sm"
                >
                  {all.map((option) => (
                    <option key={option.floorplan.id} value={option.floorplan.id}>
                      {option.floorplan.name}
                      {option.floorplan.id === current?.floorplan.id ? ' (open)' : ''}
                    </option>
                  ))}
                </select>
                {p && (
                  <Button size="sm" onClick={() => open(p)}>
                    Open
                  </Button>
                )}
              </div>
              {/* Both boxes are the same size, so measuring the first is enough. */}
              <div ref={i === 0 ? boxRef : undefined} className="min-h-0 flex-1" style={{ backgroundColor: CANVAS.background }}>
                {p && box.width > 0 && pxPerMm > 0 && (
                  <FloorPreview project={p} pxPerMm={pxPerMm} width={box.width} height={box.height} />
                )}
              </div>
            </section>
          ))}
        </div>

        {figures[0] && figures[1] && <FiguresTable a={figures[0]} b={figures[1]} />}
      </main>
    </div>
  )
}

/** Which side is better for a row, if one clearly is. */
type Better = 'a' | 'b' | null

const lower = (a: number, b: number): Better => (a < b ? 'a' : b < a ? 'b' : null)
const higher = (a: number, b: number): Better => (a > b ? 'a' : b > a ? 'b' : null)

const metres = (mm: number) => `${Math.round(mm / 100) / 10} m`

function FiguresTable({ a, b }: { a: ProjectFigures; b: ProjectFigures }) {
  const walk = (f: ProjectFigures) => (f.longestWalk === null ? '—' : f.longestWalk === Infinity ? 'no route' : metres(f.longestWalk))
  const walkValue = (f: ProjectFigures) => f.longestWalk ?? Infinity

  const rows: { label: string; a: string; b: string; better: Better }[] = [
    {
      label: 'Stations',
      a: `${a.stations} / ${a.stationTarget}`,
      b: `${b.stations} / ${b.stationTarget}`,
      better: higher(a.stations / Math.max(1, a.stationTarget), b.stations / Math.max(1, b.stationTarget)),
    },
    { label: 'Warnings', a: String(a.warnings), b: String(b.warnings), better: lower(a.warnings, b.warnings) },
    {
      label: 'Longest walk to an exit',
      a: walk(a),
      b: walk(b),
      better: a.longestWalk === null || b.longestWalk === null ? null : lower(walkValue(a), walkValue(b)),
    },
    {
      label: 'Floor used by machines',
      a: `${Math.round(a.floorUsed * 100)} % of ${Math.round(a.floorArea)} m²`,
      b: `${Math.round(b.floorUsed * 100)} % of ${Math.round(b.floorArea)} m²`,
      better: null,
    },
    { label: 'Total power', a: `${a.powerKw} kW`, b: `${b.powerKw} kW`, better: null },
    { label: 'Conveyor length', a: metres(a.conveyorLength), b: metres(b.conveyorLength), better: null },
  ]

  return (
    <table className="w-full max-w-3xl self-center text-sm">
      <thead>
        <tr className="border-b text-left text-xs text-muted-foreground">
          <th className="py-2 font-medium" />
          <th className="w-1/3 py-2 font-medium">A</th>
          <th className="w-1/3 py-2 font-medium">B</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.label} className="border-b last:border-0">
            <th scope="row" className="py-2 pr-4 text-left font-medium">
              {r.label}
            </th>
            <Cell value={r.a} best={r.better === 'a'} />
            <Cell value={r.b} best={r.better === 'b'} />
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function Cell({ value, best }: { value: string; best: boolean }) {
  return (
    <td className={cn('py-2', best && 'font-semibold text-(--feedback-green)')}>
      <span className="inline-flex items-center gap-1">
        {value}
        {best && <Check className="size-4" aria-label="better" />}
      </span>
    </td>
  )
}
