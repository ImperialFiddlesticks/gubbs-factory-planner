import { useMemo, useState } from 'react'
import { Clock, Factory, Hammer, TriangleAlert } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { EQUIPMENT_CATEGORIES, type EquipmentCategoryId } from '@/data/categories'
import { estimateBuild, estimateProduction } from '@/lib/timeEstimates'
import { usePlanner } from '@/store'
import { cn } from '@/lib/utils'

const categoryName = (id: EquipmentCategoryId) => EQUIPMENT_CATEGORIES.find((c) => c.id === id)?.name ?? id

function formatMinutes(min: number) {
  if (min < 60) return `${Math.round(min)} min`
  const h = Math.floor(min / 60)
  const m = Math.round(min % 60)
  return m ? `${h} h ${m} min` : `${h} h`
}

export function TimeEstimatesDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const floorplan = usePlanner((s) => s.floorplan)
  const machines = usePlanner((s) => s.machines)
  const walls = usePlanner((s) => s.walls)
  const utilities = usePlanner((s) => s.utilities)
  const [tab, setTab] = useState<'build' | 'production'>('build')
  const [crews, setCrews] = useState(2)
  const [product, setProduct] = useState('Wing spar bracket')
  const [quantity, setQuantity] = useState(50)

  const build = useMemo(
    () =>
      estimateBuild({
        floorAreaM2: floorplan ? (floorplan.width * floorplan.depth) / 1e6 : 0,
        machines,
        walls,
        utilities,
        crews,
      }),
    [floorplan, machines, walls, utilities, crews],
  )
  const production = useMemo(() => estimateProduction(machines, quantity), [machines, quantity])
  const maxPhase = Math.max(1, ...build.phases.map((p) => p.days))

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="size-5 text-primary" /> Time estimates
          </DialogTitle>
          <DialogDescription>
            Updates live as you change the layout. Concept preview based on mock data.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-1 rounded-md bg-muted p-1" role="tablist">
          {([
            ['build', 'Build the factory', Hammer],
            ['production', 'Produce a product', Factory],
          ] as const).map(([id, label, Icon]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={tab === id}
              onClick={() => setTab(id)}
              className={cn(
                'flex items-center justify-center gap-2 rounded px-3 py-2 text-sm font-medium transition-colors',
                tab === id ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <Icon className="size-4" /> {label}
            </button>
          ))}
        </div>

        {tab === 'build' ? (
          <div className="space-y-4">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Ready in about</p>
                <p className="text-3xl font-semibold">
                  {build.weeks} weeks <span className="text-base font-normal text-muted-foreground">({build.totalDays} work days)</span>
                </p>
              </div>
              <div className="w-28">
                <Label htmlFor="crews">Install crews</Label>
                <Input id="crews" type="number" min={1} max={10} value={crews} onChange={(e) => setCrews(Math.max(1, Number(e.target.value) || 1))} />
              </div>
            </div>
            <ul className="space-y-2">
              {build.phases.map((p) => (
                <li key={p.name} className="text-sm">
                  <div className="flex justify-between">
                    <span>{p.name}</span>
                    <span className="text-muted-foreground">{p.days} days</span>
                  </div>
                  <div className="mt-1 h-2 rounded bg-muted">
                    <div className="h-2 rounded bg-primary" style={{ width: `${(p.days / maxPhase) * 100}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-[minmax(0,1fr)_7rem] gap-3">
              <div>
                <Label htmlFor="product">Product</Label>
                <Input id="product" value={product} onChange={(e) => setProduct(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="quantity">Quantity</Label>
                <Input id="quantity" type="number" min={1} value={quantity} onChange={(e) => setQuantity(Math.max(1, Number(e.target.value) || 1))} />
              </div>
            </div>
            {production.steps.length === 0 ? (
              <p className="rounded-md bg-muted p-3 text-sm text-muted-foreground">
                Place some machining, forming, welding or assembly stations to see a production estimate.
              </p>
            ) : (
              <>
                <div>
                  <p className="text-sm text-muted-foreground">{quantity} × {product || 'product'} takes about</p>
                  <p className="text-3xl font-semibold">
                    {formatMinutes(production.totalMinutes)}{' '}
                    <span className="text-base font-normal text-muted-foreground">({production.workDays.toFixed(1)} work days)</span>
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    First one done after {formatMinutes(production.leadMinutes)} · then one every {formatMinutes(production.bottleneckMinutes)} · parts travel {production.totalTransportM.toFixed(0)} m each
                  </p>
                </div>
                <ol className="space-y-1 text-sm">
                  {production.steps.map((s, i) => (
                    <li key={s.category} className={cn('flex justify-between rounded px-2 py-1', s.category === production.bottleneck && 'bg-accent/30')}>
                      <span>
                        {i + 1}. {categoryName(s.category)} <span className="text-muted-foreground">({s.stations} station{s.stations > 1 ? 's' : ''})</span>
                        {s.category === production.bottleneck && <span className="ml-2 text-xs font-semibold">Bottleneck</span>}
                      </span>
                      <span className="text-muted-foreground">
                        {s.processMinutes} min work{s.distanceM > 0 && ` + ${s.distanceM.toFixed(0)} m move`}
                      </span>
                    </li>
                  ))}
                </ol>
                <p className="text-xs text-muted-foreground">Tip: move stations closer together, or add a second station at the bottleneck, and watch the time drop.</p>
              </>
            )}
            {production.missing.length > 0 && production.steps.length > 0 && (
              <p className="flex items-center gap-2 text-xs text-muted-foreground">
                <TriangleAlert className="size-3.5" /> Skipped (no station placed): {production.missing.map(categoryName).join(', ')}
              </p>
            )}
          </div>
        )}
        <p className="border-t pt-3 text-xs text-muted-foreground">
          Mock figures for the concept demo. Future versions would use real install times and cycle times.
        </p>
      </DialogContent>
    </Dialog>
  )
}
