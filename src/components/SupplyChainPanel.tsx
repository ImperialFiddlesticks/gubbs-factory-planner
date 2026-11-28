import { useMemo, useState } from 'react'
import { ArrowRight, ChevronDown, ChevronUp, RotateCcw, Truck, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { usePlanner } from '@/store'
import { machineTypeFor } from '@/data/catalog'
import { EQUIPMENT_CATEGORIES } from '@/data/categories'
import { useSupplyChain } from '@/lib/supplyChainStore'
import { ALTERNATIVE_CAPACITY, MATERIALS, MAX_DELAY_DAYS, getMaterial, simulate } from '@/lib/supplyChain'

export function SupplyChainPanel() {
  const { open, materialId, delayDays, useAlternative, setOpen, setMaterial, setDelay, setUseAlternative, reset } = useSupplyChain()
  const machines = usePlanner((s) => s.machines)
  const [collapsed, setCollapsed] = useState(false)
  const categories = useMemo(
    () => machines.flatMap((m) => {
      const type = machineTypeFor(m)
      return type && !type.conveyor ? [type.category] : []
    }),
    [machines],
  )
  if (!open) return null
  const material = getMaterial(materialId)
  const result = simulate(categories, material, delayDays, useAlternative)
  const short = result.shortageDays > 0
  const affected = categories.filter((category) => category && material.categories.includes(category)).length
  const baseline = simulate(categories, material, delayDays, false)
  const alternative = simulate(categories, material, delayDays, true)
  const categoryNames = EQUIPMENT_CATEGORIES.filter((category) => material.categories.includes(category.id)).map((category) => category.name).join(' & ')

  return (
    <aside aria-label="Supply Chain Simulator" className="fixed bottom-4 right-4 z-40 flex max-h-[calc(100dvh-88px)] w-[410px] max-w-[calc(100vw-32px)] flex-col overflow-hidden rounded-lg border bg-card text-card-foreground shadow-lift">
      <header className="flex items-center gap-2 border-b px-3 py-2">
        <Truck className="size-4 shrink-0" />
        <h2 className="min-w-0 flex-1 truncate text-sm font-bold">Supply Chain Simulator</h2>
        <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold uppercase text-muted-foreground">Mock demo</span>
        <Button size="icon" variant="ghost" className="size-7" aria-label={collapsed ? 'Expand' : 'Collapse'} onClick={() => setCollapsed((c) => !c)}>{collapsed ? <ChevronUp /> : <ChevronDown />}</Button>
        <Button size="icon" variant="ghost" className="size-7" aria-label="Close simulator" onClick={() => setOpen(false)}><X /></Button>
      </header>
      {!collapsed && (
        <>
        <dl className="grid shrink-0 grid-cols-3 gap-2 border-b bg-muted/50 px-3 py-2 text-center" aria-label="Results" aria-live="polite">
          <div><dt className="text-[10px] text-muted-foreground">Estimated capacity</dt><dd className="text-lg font-bold">{result.capacityPct}%</dd></div>
          <div><dt className="text-[10px] text-muted-foreground">Stopped stations</dt><dd className="text-lg font-bold">{result.blockedMachines}</dd></div>
          <div><dt className="text-[10px] text-muted-foreground">Shortage duration</dt><dd className="text-lg font-bold">{result.shortageDays} days</dd></div>
        </dl>
        <div className="min-h-0 space-y-4 overflow-y-auto p-4 text-xs leading-relaxed">
          <p className="text-muted-foreground">What happens if a material delivery is late? Compare your stock buffer, machine stoppages and a backup supplier in your current layout.</p>
          <section className="space-y-2" aria-labelledby="supply-material-heading">
          <h3 id="supply-material-heading" className="text-sm font-bold">1. Choose the delayed material</h3>
          <label className="block">
            <span className="sr-only">Material</span>
            <select aria-label="Material" className="w-full rounded-md border bg-background px-2 py-2 text-sm" value={materialId} onChange={(e) => setMaterial(e.target.value)}>
              {MATERIALS.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </label>
          <div className="grid grid-cols-2 gap-2">
            <div><p className="text-muted-foreground">Supplier</p><p className="font-semibold">{material.supplier}</p></div>
            <div><p className="text-muted-foreground">Stock covers</p><p className="font-semibold">{material.inventoryDays} days of demand</p></div>
          </div>
          <p className="text-muted-foreground">Used by {categoryNames}. <span className="font-semibold text-foreground">{affected} of {categories.length} stations</span> in this layout depend on {material.name.toLowerCase()}.</p>
          </section>
          <section className="space-y-2 border-t pt-3" aria-labelledby="supply-delay-heading">
          <h3 id="supply-delay-heading" className="text-sm font-bold">2. Set the delivery delay</h3>
          <label className="block">
            <span className="flex justify-between text-muted-foreground"><span>Delivery delay</span><span className="font-semibold text-foreground">{delayDays} days</span></span>
            <input aria-label="Delivery delay" aria-describedby="supply-stock-buffer" type="range" min={0} max={MAX_DELAY_DAYS} value={delayDays} onChange={(e) => setDelay(Number(e.target.value))} className="w-full accent-primary" />
          </label>
          <div className="flex justify-between text-[10px] text-muted-foreground"><span>On time · 0 days</span><span>{MAX_DELAY_DAYS} days late</span></div>
          <p id="supply-stock-buffer" className="bg-muted/50 px-2 py-1.5 tabular-nums">{delayDays} days late − {material.inventoryDays} days of stock = <strong>{result.shortageDays} shortage days</strong> (minimum 0).</p>
          <p className="text-muted-foreground">{short ? 'The stock buffer runs out before the delivery arrives.' : 'Existing stock covers this delay. No stations need to stop.'}</p>
          </section>

          <section className="space-y-2 border-t pt-3" aria-labelledby="supply-alternative-heading">
            <h3 id="supply-alternative-heading" className="text-sm font-bold">3. Try a backup supplier</h3>
            <div className="flex items-center justify-between gap-3">
              <label htmlFor="supply-alternative" className="font-semibold">Use {material.alternativeSupplier}</label>
              <Switch id="supply-alternative" checked={useAlternative} onCheckedChange={setUseAlternative} aria-describedby="supply-alternative-description" />
            </div>
            <p id="supply-alternative-description" className="text-muted-foreground">This fictional approved supplier covers {Math.round(ALTERNATIVE_CAPACITY * 100)}% of demand. During a shortage, dependent stations run at 60% instead of stopping. Other stations stay at 100%.</p>
            {!short && <p className="text-muted-foreground">The backup only affects results when the delay exceeds your stock buffer.</p>}
          </section>

          <section className="space-y-2 border-t pt-3" aria-labelledby="supply-results-heading">
            <h3 id="supply-results-heading" className="text-sm font-bold">Impact on your layout</h3>
            {categories.length === 0 ? <p className="font-semibold">Add machines to your layout to see a station-level impact.</p> : affected === 0 ? <p>No stations in this layout use {material.name.toLowerCase()}, so this delay does not change their capacity.</p> : short ? <p><strong>{affected} dependent stations</strong> {useAlternative ? 'run at 60% with the backup supplier' : 'stop during the shortage'}. The other {categories.length - affected} stations keep running normally.</p> : <p>All {categories.length} stations keep running normally.</p>}
            {short && affected > 0 && <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-primary"><span>No backup: <strong>{baseline.capacityPct}%</strong></span><ArrowRight className="size-3" /><span>With backup: <strong>{alternative.capacityPct}%</strong></span></div>}
            <p className="text-[11px] text-muted-foreground">Capacity is the equally weighted average of all included stations during the shortage, not a forecast of finished products. Backup reduces the impact, not the shortage duration.</p>
            <ul className="space-y-1 text-[11px]">
              <li className="flex items-center gap-2"><span className="size-2.5 shrink-0 rounded-full bg-[var(--feedback-green)]" />Green — normal, 100% station output</li>
              <li className="flex items-center gap-2"><span className="size-2.5 shrink-0 rounded-full bg-destructive" />Red — stopped due to missing material, 0%</li>
              <li className="flex items-center gap-2"><span className="size-2.5 shrink-0 rounded-full bg-primary" />Blue — backup supply, 60% station output</li>
            </ul>
          </section>
          <div className="flex items-center justify-between gap-2 border-t pt-3">
            <p className="text-[10px] text-muted-foreground">Reset keeps your selected material.</p>
            <Button size="sm" variant="outline" onClick={reset}><RotateCcw /> Reset scenario</Button>
          </div>
          <p className="text-[10px] text-muted-foreground">Demo only: fictional suppliers, fixed stock buffers and assumed material-to-station links. No live orders, delivery routes or real production data. Your layout and saved project are never changed.</p>
        </div>
        </>
      )}
    </aside>
  )
}
