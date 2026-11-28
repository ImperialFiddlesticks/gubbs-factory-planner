import { useMemo } from 'react'
import { Footprints, ShieldAlert, Truck } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { findTruckLogisticsIssues } from '@/lib/truckLogistics'
import { layoutObstacles } from '@/lib/workerObstacles'
import { workerRisks } from '@/lib/workerSafety'
import { usePlanner } from '@/store'

interface Row { key: string; severity: 'high' | 'medium'; source: string; message: string }

const BADGE = { high: 'bg-rose-500', medium: 'bg-amber-500' }

export function RiskOverviewDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const s = usePlanner()
  const walkRows = useMemo<Row[]>(() => {
    if (!open) return []
    const obstacles = layoutObstacles(s.machines, s.walls, s.pillars)
    return s.pedestrianRoutes.flatMap((route, i) =>
      workerRisks(route, obstacles, s.truckRoutes).map((r, j) => ({
        key: `${route.id}-${j}`, severity: r.severity, source: route.name ?? `Pedestrian route ${i + 1}`,
        message: `${(r.at / 1000).toFixed(1)} m along: ${r.message}`,
      })),
    ).sort((a, b) => (a.severity === b.severity ? 0 : a.severity === 'high' ? -1 : 1))
  }, [open, s.machines, s.walls, s.pillars, s.pedestrianRoutes, s.truckRoutes])
  const routeRows = useMemo(() => (open ? findTruckLogisticsIssues({
    truckTypes: s.truckTypes, utilities: s.utilities, parkingSpots: s.truckParkingSpots, serviceStations: s.truckServiceStations,
    truckRoutes: s.truckRoutes, pedestrianRoutes: s.pedestrianRoutes, pedestrianCrossings: s.pedestrianCrossings,
    safetyBarriers: s.safetyBarriers, machines: s.machines, pillars: s.pillars, walls: s.walls,
    loadingBays: s.loadingBays, loadingDocks: s.loadingDocks, floorplan: s.floorplan,
  }) : []), [open, s])
  const high = walkRows.filter((r) => r.severity === 'high').length

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><ShieldAlert className="size-5" /> Risk overview</DialogTitle>
          <DialogDescription>
            {walkRows.length + routeRows.length === 0
              ? 'No risks found in this layout.'
              : `${walkRows.length + routeRows.length} risks · ${high} high on walkways · ${routeRows.length} route warnings`}
          </DialogDescription>
        </DialogHeader>

        <section>
          <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold"><Footprints className="size-4" /> Walkways (Worker view)</h3>
          {s.pedestrianRoutes.length === 0 ? (
            <p className="text-sm text-muted-foreground">No pedestrian routes drawn yet.</p>
          ) : walkRows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No risks along the walkways.</p>
          ) : (
            <ul className="divide-y rounded-md border">
              {walkRows.map((r) => (
                <li key={r.key} className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-3 px-3 py-2 text-sm">
                  <span className={`rounded px-1.5 py-0.5 text-[11px] font-bold text-white uppercase ${BADGE[r.severity]}`}>{r.severity}</span>
                  <span className="min-w-0"><span className="font-medium">{r.source}</span> · {r.message}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold"><Truck className="size-4" /> Forklift, access and pedestrian routes</h3>
          {routeRows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No route warnings.</p>
          ) : (
            <ul className="divide-y rounded-md border">
              {routeRows.map((r) => (
                <li key={r.key} className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-3 px-3 py-2 text-sm">
                  <span className="rounded bg-amber-500 px-1.5 py-0.5 text-[11px] font-bold text-white uppercase">warning</span>
                  <span className="min-w-0">{r.message}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
        <p className="text-xs text-muted-foreground">Concept: distance limits are example values, not Saab safety standards.</p>
      </DialogContent>
    </Dialog>
  )
}
