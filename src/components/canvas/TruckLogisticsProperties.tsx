import { useState } from 'react'
import { CommitInput } from '@/components/CommitInput'
import { CommitText } from '@/components/CommitText'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { supplyLines } from '@/lib/validation'
import { usePlanner } from '@/store'
import type { ForkliftCategory, MachineInstance, Point, TruckRoute, TruckServiceStation, TruckType, Utility, Wall } from '@/types'

const CATEGORIES: { value: ForkliftCategory; label: string }[] = [
  { value: 'pallet-truck', label: 'Pallet truck' },
  { value: 'stacker', label: 'Stacker' },
  { value: 'reach-truck', label: 'Reach truck' },
  { value: 'counterbalance-forklift', label: 'Counterbalance forklift' },
]

export function TruckLogisticsProperties({ id }: { id: string }) {
  const truck = usePlanner((s) => s.truckTypes.find((item) => item.id === id))
  const forkliftInstance = usePlanner((s) => s.forkliftInstances.find((item) => item.id === id))
  const forkliftType = usePlanner((s) => forkliftInstance && s.truckTypes.find((item) => item.id === forkliftInstance.typeId))
  const spot = usePlanner((s) => s.truckParkingSpots.find((item) => item.id === id))
  const station = usePlanner((s) => s.truckServiceStations.find((item) => item.id === id))
  const route = usePlanner((s) => s.truckRoutes.find((item) => item.id === id))
  const pedestrianRoute = usePlanner((s) => s.pedestrianRoutes.find((item) => item.id === id))
  const crossing = usePlanner((s) => s.pedestrianCrossings.find((item) => item.id === id))
  const barrier = usePlanner((s) => s.safetyBarriers.find((item) => item.id === id))
  const truckTypes = usePlanner((s) => s.truckTypes)
  const truckRoutes = usePlanner((s) => s.truckRoutes)
  const pedestrianRoutes = usePlanner((s) => s.pedestrianRoutes)
  const machines = usePlanner((s) => s.machines)
  const utilities = usePlanner((s) => s.utilities)
  const walls = usePlanner((s) => s.walls)
  const serviceStations = usePlanner((s) => s.truckServiceStations)
  const updateTruckType = usePlanner((s) => s.updateTruckType)
  const updateSpot = usePlanner((s) => s.updateTruckParkingSpot)
  const updateStation = usePlanner((s) => s.updateTruckServiceStation)
  const updateRoute = usePlanner((s) => s.updateTruckRoute)
  const updatePedestrianRoute = usePlanner((s) => s.updatePedestrianRoute)
  const updateCrossing = usePlanner((s) => s.updatePedestrianCrossing)
  const updateBarrier = usePlanner((s) => s.updateSafetyBarrier)
  const addParallelRoute = usePlanner((s) => s.addParallelPedestrianRoute)
  const startKeepClearPlacement = usePlanner((s) => s.startPlacingBarrierKeepClear)
  const removeItems = usePlanner((s) => s.removeItems)
  const moveItems = usePlanner((s) => s.moveItems)
  const rotateForkliftInstance = usePlanner((s) => s.rotateForkliftInstance)
  const removeTruckType = usePlanner((s) => s.removeTruckType)

  const title = truck?.name ?? (forkliftInstance ? `${forkliftType?.name ?? 'Forklift'} instance` : undefined) ?? spot?.name ?? station?.name ?? route?.name ?? pedestrianRoute?.name ?? crossing?.name ?? barrier?.name
  if (!title) return null
  return <div className="space-y-3">
    <div className="text-sm font-semibold">{title}</div>
    {forkliftInstance && <>
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div><span className="text-muted-foreground">Model</span><div>{forkliftType?.name ?? 'Unavailable model'}</div></div>
        <div><span className="text-muted-foreground">Rotation</span><div>{forkliftInstance.rotation}°</div></div>
        {forkliftType?.widthMm && forkliftType.lengthMm && <div className="col-span-2"><span className="text-muted-foreground">Footprint</span><div>{(forkliftType.widthMm / 1000).toFixed(2)} × {(forkliftType.lengthMm / 1000).toFixed(2)} m</div></div>}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Field id={`forklift-x-${id}`} label="X position (m)"><CommitInput id={`forklift-x-${id}`} className="h-8" min={-Number.MAX_VALUE} step={0.1} value={forkliftInstance.x / 1000} isValid={Number.isFinite} onCommit={(x) => moveItems([id], Math.round(x * 1000) - forkliftInstance.x, 0)} /></Field>
        <Field id={`forklift-y-${id}`} label="Y position (m)"><CommitInput id={`forklift-y-${id}`} className="h-8" min={-Number.MAX_VALUE} step={0.1} value={forkliftInstance.y / 1000} isValid={Number.isFinite} onCommit={(y) => moveItems([id], 0, Math.round(y * 1000) - forkliftInstance.y)} /></Field>
      </div>
      <Button variant="secondary" className="w-full" onClick={() => rotateForkliftInstance(id)}>Rotate 15°</Button>
    </>}
    {truck && <>
      <NameField id={id} name={truck.name} onCommit={(name) => updateTruckType(id, { name })} />
      <Field id={`forklift-category-${id}`} label="Category"><select id={`forklift-category-${id}`} value={truck.category ?? ''} onChange={(event) => updateTruckType(id, { category: (event.target.value || undefined) as ForkliftCategory | undefined })} className="h-8 w-full rounded-md border border-input bg-background px-2 text-sm"><option value="">Uncategorized</option>{CATEGORIES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></Field>
      <OptionalNumberField id={id} name="width" value={truck.widthMm} onCommit={(widthMm) => updateTruckType(id, { widthMm })} />
      <OptionalNumberField id={id} name="length" value={truck.lengthMm} onCommit={(lengthMm) => updateTruckType(id, { lengthMm })} />
      <OptionalNumberField id={id} name="turning-radius" value={truck.turningRadiusMm} onCommit={(turningRadiusMm) => updateTruckType(id, { turningRadiusMm })} />
      <OptionalNumberField id={id} name="minimum-aisle-width" value={truck.minimumAisleWidthMm} onCommit={(minimumAisleWidthMm) => updateTruckType(id, { minimumAisleWidthMm })} />
      <OptionalNumberField id={id} name="load-capacity" value={truck.loadCapacityKg} onCommit={(loadCapacityKg) => updateTruckType(id, { loadCapacityKg })} unit="kg" />
      <Field id={`forklift-energy-${id}`} label="Energy type"><select id={`forklift-energy-${id}`} value={truck.energyType} onChange={(event) => updateTruckType(id, { energyType: event.target.value as typeof truck.energyType })} className="h-8 w-full rounded-md border border-input bg-background px-2 text-sm"><option value="electric">Electric</option><option value="combustion">Combustion</option><option value="other">Other</option></select></Field>
      <NameField id="forklift-battery-type" label="Battery type" name={truck.batteryType ?? ''} onCommit={(batteryType) => updateTruckType(id, { batteryType: batteryType || undefined })} />
      <NameField id="forklift-chargers" label="Compatible charger types (comma-separated)" name={truck.compatibleChargerTypes.join(', ')} onCommit={(value) => updateTruckType(id, { compatibleChargerTypes: list(value) })} />
      <NameField id="forklift-manufacturer" label="Manufacturer" name={truck.manufacturer ?? ''} onCommit={(manufacturer) => updateTruckType(id, { manufacturer: manufacturer || undefined })} />
      <NameField id="forklift-model" label="Model" name={truck.model ?? ''} onCommit={(model) => updateTruckType(id, { model: model || undefined })} />
      <NameField id="forklift-configuration" label="Configuration" name={truck.configuration ?? ''} onCommit={(configuration) => updateTruckType(id, { configuration: configuration || undefined })} />
      {truck.sourceUrl && <a className="block text-xs text-blue-700 underline" href={truck.sourceUrl} target="_blank" rel="noreferrer">Specification source</a>}
      <p className="text-[11px] text-muted-foreground">Blank specifications mean unknown, not zero. Route checks only cover assigned forklifts with the needed data.</p>
    </>}
    {spot && <>
      <NameField id={id} name={spot.name} onCommit={(name) => updateSpot(id, { name })} />
      <TruckTypeChecklist id="spot-forklift-types" label="Compatible forklifts" items={truckTypes} selectedIds={spot.compatibleTruckTypeIds} onChange={(compatibleTruckTypeIds) => updateSpot(id, { compatibleTruckTypeIds })} />
      <ParkingDimensions spot={spot} onChange={(outline) => updateSpot(id, { outline })} />
    </>}
    {station && <>
      <NameField id={id} name={station.name} onCommit={(name) => updateStation(id, { name })} />
      <NumberField id={id} name="simultaneous-service-capacity" value={station.serviceCapacity} unit="connections" onCommit={(serviceCapacity) => updateStation(id, { serviceCapacity })} />
      {station.kind === 'charging' && <>
        <NameField id="station-charger-type" label="Charger type" name={station.chargerType ?? ''} onCommit={(chargerType) => updateStation(id, { chargerType: chargerType || undefined })} />
        <NumberField id={id} name="charger-power" value={station.chargerPowerKw ?? 0} unit="kW" onCommit={(chargerPowerKw) => updateStation(id, { chargerPowerKw })} />
        <AutomaticUtilityStatus stationId={id} kind="power" stations={serviceStations} machines={machines} utilities={utilities} walls={walls} truckTypes={truckTypes} />
      </>}
      {station.kind === 'battery-watering' && <>
        <AutomaticUtilityStatus stationId={id} kind="water" stations={serviceStations} machines={machines} utilities={utilities} walls={walls} truckTypes={truckTypes} />
        <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={station.requiresPower ?? false} onChange={(event) => updateStation(id, { requiresPower: event.target.checked })} />This equipment also needs electricity</label>
        {station.requiresPower && <>
          <NumberField id={id} name="equipment-power-demand" value={station.powerDemandKw ?? 0} unit="kW" onCommit={(powerDemandKw) => updateStation(id, { powerDemandKw })} />
          <AutomaticUtilityStatus stationId={id} kind="power" stations={serviceStations} machines={machines} utilities={utilities} walls={walls} truckTypes={truckTypes} />
        </>}
      </>}
      <TruckTypeChecklist id="station-forklift-types" label="Assigned forklifts" items={truckTypes} selectedIds={station.compatibleTruckTypeIds} onChange={(compatibleTruckTypeIds) => updateStation(id, { compatibleTruckTypeIds })} />
      {station.kind === 'battery-watering' && <NameField id="station-batteries" label="Compatible battery types (comma-separated)" name={station.compatibleBatteryTypes.join(', ')} onCommit={(value) => updateStation(id, { compatibleBatteryTypes: list(value) })} />}
    </>}
    {route && <>
      <NameField id={id} name={route.name} onCommit={(name) => updateRoute(id, { name })} />
      <NumberField id={id} name="corridor-width" value={route.usableWidthMm} onCommit={(usableWidthMm) => updateRoute(id, { usableWidthMm })} />
      <TruckTypeChecklist id="route-forklift-types" label="Forklifts checked on this route" items={truckTypes} selectedIds={route.allowedTruckTypeIds} onChange={(allowedTruckTypeIds) => updateRoute(id, { allowedTruckTypeIds })} />
      <Field id="route-direction" label="Direction"><select id="route-direction" value={route.direction} onChange={(event) => updateRoute(id, { direction: event.target.value as typeof route.direction })} className="h-8 w-full rounded-md border border-input bg-background px-2 text-sm"><option value="two-way">Two-way</option><option value="one-way">One-way</option></select></Field>
      <PointEditor points={route.points} onCommit={(points) => updateRoute(id, { points })} />
      <ParallelRouteCreator key={route.id} truckRoutes={truckRoutes} initialRouteId={route.id} onCreate={(truckRouteId, side, offset, width) => addParallelRoute(truckRouteId, side, offset, width)} />
    </>}
    {pedestrianRoute && <>
      <NameField id={id} name={pedestrianRoute.name} onCommit={(name) => updatePedestrianRoute(id, { name })} />
      <NumberField id={id} name="usable-width" value={pedestrianRoute.usableWidthMm} onCommit={(usableWidthMm) => updatePedestrianRoute(id, { usableWidthMm })} />
      {pedestrianRoute.parallel ? <ParallelRouteSettings route={pedestrianRoute} truckRoutes={truckRoutes} onChange={(parallel) => updatePedestrianRoute(id, { parallel })} onRemove={() => updatePedestrianRoute(id, { parallel: undefined })} /> : <ParallelRouteCreator truckRoutes={truckRoutes} onCreate={(truckRouteId, side, offset, width) => addParallelRoute(truckRouteId, side, offset, width)} />}
      <PointEditor points={pedestrianRoute.points} onCommit={(points) => updatePedestrianRoute(id, { points })} />
    </>}
    {crossing && <>
      <NameField id={id} name={crossing.name} onCommit={(name) => updateCrossing(id, { name })} />
      <p className="text-xs text-muted-foreground">Connected pedestrian routes: {(crossing.pedestrianRouteIds ?? [crossing.pedestrianRouteId]).map((routeId) => pedestrianRoutes.find((item) => item.id === routeId)?.name ?? 'Missing route').join(', ')}</p>
      <Field id="crossing-truck-route" label="Forklift route"><select id="crossing-truck-route" value={crossing.truckRouteId} onChange={(event) => updateCrossing(id, { truckRouteId: event.target.value })} className="h-8 w-full rounded-md border border-input bg-background px-2 text-sm">{truckRoutes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field>
      <Field id="crossing-pedestrian-route" label="Pedestrian route"><select id="crossing-pedestrian-route" value={crossing.pedestrianRouteId} onChange={(event) => updateCrossing(id, { pedestrianRouteId: event.target.value, pedestrianRouteIds: [event.target.value] })} className="h-8 w-full rounded-md border border-input bg-background px-2 text-sm">{pedestrianRoutes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field>
    </>}
    {barrier && <>
      <NameField id={id} name={barrier.name} onCommit={(name) => updateBarrier(id, { name })} />
      {barrier.generatedForPedestrianRouteId && <p className="text-[11px] text-muted-foreground">Automatically follows its pedestrian route; editing its path detaches it.</p>}
      <NumberField id={id} name="thickness" value={barrier.thicknessMm} unit="mm" min={1} onCommit={(thicknessMm) => updateBarrier(id, { thicknessMm })} />
      <Field id="barrier-purpose" label="Purpose"><select id="barrier-purpose" value={barrier.purpose} onChange={(event) => updateBarrier(id, { purpose: event.target.value as typeof barrier.purpose })} className="h-8 w-full rounded-md border border-input bg-background px-2 text-sm"><option value="pedestrian-separation">Pedestrian separation</option><option value="machine-protection">Machine protection</option><option value="other">Other</option></select></Field>
      <Field id={`barrier-target-${id}`} label="Protected machine or exit"><select id={`barrier-target-${id}`} value={barrier.protectedTargetId ?? ''} onChange={(event) => updateBarrier(id, { protectedTargetId: event.target.value || undefined })} className="h-8 w-full rounded-md border border-input bg-background px-2 text-sm"><option value="">No protected target</option><optgroup label="Machines">{machines.map((machine) => <option key={machine.id} value={machine.id}>{machine.name ?? machine.typeId}</option>)}</optgroup><optgroup label="Exits">{utilities.filter((utility) => utility.kind === 'exit').map((utility) => <option key={utility.id} value={utility.id}>Exit {utility.id.slice(0, 6)}</option>)}</optgroup></select></Field>
      {barrier.protectedTargetId && <>
        <Button type="button" variant="outline" className="w-full" onClick={() => startKeepClearPlacement(id)}>Draw keep-clear access area</Button>
        {barrier.keepClearOutline && <PointEditor points={barrier.keepClearOutline} onCommit={(keepClearOutline) => updateBarrier(id, { keepClearOutline })} />}
        <p className="text-[11px] text-muted-foreground">Draw a closed polygon that contains the protected target. Objects, routes, and barriers are checked against this explicit area.</p>
      </>}
      <PointEditor points={barrier.points} onCommit={(points) => updateBarrier(id, { points })} />
    </>}
    <p className="text-[11px] text-muted-foreground">Measurements use millimetres. Planning checks do not certify workplace safety.</p>
    <Button variant="ghost" className="w-full text-muted-foreground hover:text-destructive" onClick={() => truck ? removeTruckType(id) : removeItems([id])}>Delete {truck ? 'forklift type' : forkliftInstance ? 'forklift' : spot ? 'parking spot' : station ? 'service station' : route ? 'forklift route' : pedestrianRoute ? 'pedestrian route' : crossing ? 'crossing' : 'barrier'}</Button>
  </div>
}

function ParallelRouteCreator({ truckRoutes, initialRouteId, onCreate }: { truckRoutes: TruckRoute[]; initialRouteId?: string; onCreate: (truckRouteId: string, side: 'left' | 'right' | 'both', offsetMm: number, widthMm: number) => boolean }) {
  const [routeId, setRouteId] = useState(initialRouteId ?? truckRoutes[0]?.id ?? '')
  const [side, setSide] = useState<'left' | 'right' | 'both'>('left')
  const [offsetMm, setOffsetMm] = useState(2000)
  const [widthMm, setWidthMm] = useState(1200)
  const [error, setError] = useState('')
  const selectedRouteId = truckRoutes.some((route) => route.id === routeId) ? routeId : truckRoutes[0]?.id ?? ''
  return <div className="space-y-2 rounded-md border p-2">
    <div className="text-xs font-medium">Create parallel pedestrian route</div>
    {truckRoutes.length === 0 ? <p className="text-xs text-muted-foreground">Create a forklift route first.</p> : <>
      <Field id="parallel-source-route" label="Follow forklift route"><select id="parallel-source-route" value={selectedRouteId} onChange={(event) => setRouteId(event.target.value)} className="h-8 w-full rounded-md border border-input bg-background px-2 text-sm">{truckRoutes.map((route) => <option key={route.id} value={route.id}>{route.name}</option>)}</select></Field>
      <Field id="parallel-side" label="Side"><select id="parallel-side" value={side} onChange={(event) => setSide(event.target.value as 'left' | 'right' | 'both')} className="h-8 w-full rounded-md border border-input bg-background px-2 text-sm"><option value="left">Left</option><option value="right">Right</option><option value="both">Both sides</option></select></Field>
      <NumberField id="parallel-create" name="offset" value={offsetMm} onCommit={setOffsetMm} />
      <NumberField id="parallel-create" name="usable-width" value={widthMm} onCommit={setWidthMm} />
      <Button type="button" variant="outline" className="w-full" onClick={() => setError(onCreate(selectedRouteId, side, offsetMm, widthMm) ? '' : 'The route contains a sharp turn that cannot be offset cleanly.')}>Create parallel route</Button>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </>}
  </div>
}

function ParallelRouteSettings({ route, truckRoutes, onChange, onRemove }: { route: NonNullable<ReturnType<typeof usePlanner.getState>['pedestrianRoutes'][number]>; truckRoutes: TruckRoute[]; onChange: (parallel: NonNullable<typeof route.parallel>) => void; onRemove: () => void }) {
  const parallel = route.parallel!
  return <div className="space-y-2 rounded-md border p-2">
    <div className="text-xs font-medium">Parallel route settings</div>
    <Field id={`parallel-source-${route.id}`} label="Follow forklift route"><select id={`parallel-source-${route.id}`} value={parallel.truckRouteId} onChange={(event) => onChange({ ...parallel, truckRouteId: event.target.value })} className="h-8 w-full rounded-md border border-input bg-background px-2 text-sm">{truckRoutes.map((truckRoute) => <option key={truckRoute.id} value={truckRoute.id}>{truckRoute.name}</option>)}</select></Field>
    <Field id={`parallel-side-${route.id}`} label="Side"><select id={`parallel-side-${route.id}`} value={parallel.side} onChange={(event) => onChange({ ...parallel, side: event.target.value as 'left' | 'right' })} className="h-8 w-full rounded-md border border-input bg-background px-2 text-sm"><option value="left">Left</option><option value="right">Right</option></select></Field>
    <NumberField id={route.id} name="offset" value={parallel.offsetMm} onCommit={(offsetMm) => onChange({ ...parallel, offsetMm })} />
    <Button type="button" variant="ghost" className="w-full" onClick={onRemove}>Make this a standalone route</Button>
  </div>
}

function NameField({ id, name, onCommit, label = 'Name' }: { id: string; name: string; onCommit: (name: string) => void; label?: string }) {
  const fieldId = `logistics-${id}-${label.toLowerCase().replaceAll(' ', '-')}`
  return <Field id={fieldId} label={label}><CommitText id={fieldId} className="h-8" value={name} onCommit={onCommit} /></Field>
}

function NumberField({ id, name, value, onCommit, unit = 'm', min = 0 }: { id: string; name: string; value: number; onCommit: (value: number) => void; unit?: string; min?: number }) {
  const fieldId = `logistics-${id}-${name}`
  const displayed = unit === 'm' ? value / 1000 : value
  const step = unit === 'm' ? 0.1 : unit === 'kW' ? 0.1 : 1
  return <Field id={fieldId} label={`${name.replaceAll('-', ' ')} (${unit})`}><CommitInput id={fieldId} className="h-8" value={displayed} min={min} step={step} onCommit={(next) => onCommit(unit === 'm' ? Math.round(next * 1000) : next)} isValid={(next) => Number.isFinite(next) && next >= min && (unit !== 'connections' || Number.isInteger(next))} /></Field>
}

function OptionalNumberField({ id, name, value, onCommit, unit = 'm' }: { id: string; name: string; value: number | null; onCommit: (value: number | null) => void; unit?: string }) {
  const [draft, setDraft] = useState<string | null>(null)
  const text = draft ?? (value === null ? '' : String(unit === 'm' ? value / 1000 : value))
  const fieldId = `logistics-${id}-${name}`
  const commit = () => {
    if (draft === null) return
    if (!draft.trim()) { onCommit(null); setDraft(null); return }
    const parsed = Number(draft)
    if (Number.isFinite(parsed) && parsed >= 0) onCommit(unit === 'm' ? Math.round(parsed * 1000) : parsed)
    setDraft(null)
  }
  return <Field id={fieldId} label={`${name.replaceAll('-', ' ')} (${unit})`}><Input id={fieldId} type="number" className="h-8" value={text} min={0} step={unit === 'm' ? 0.1 : 1} onChange={(event) => setDraft(event.target.value)} onBlur={commit} onKeyDown={(event) => event.key === 'Enter' && event.currentTarget.blur()} /></Field>
}

function AutomaticUtilityStatus({ stationId, kind, stations, machines, utilities, walls, truckTypes }: { stationId: string; kind: 'power' | 'water'; stations: TruckServiceStation[]; machines: MachineInstance[]; utilities: Utility[]; walls: Wall[]; truckTypes: TruckType[] }) {
  const station = stations.find((item) => item.id === stationId)
  const batteryApplicable = kind !== 'water' || Boolean(station?.compatibleTruckTypeIds.some((id) => {
    const truck = truckTypes.find((item) => item.id === id)
    return Boolean(truck?.batteryType && station.compatibleBatteryTypes.includes(truck.batteryType))
  }))
  const line = batteryApplicable ? supplyLines(machines, utilities, kind, walls, stations, truckTypes).find((item) => item.servedIds.includes(stationId)) : undefined
  const utility = utilities.find((item) => item.id === line?.utilityId)
  const message = !batteryApplicable ? 'Assign a forklift with a matching battery type to require water routing.' : utility ? `Automatically routed to ${kind} point ${utility.id.slice(0, 6)}.` : `No ${kind} point is currently in reach.`
  return <div className="text-xs text-muted-foreground" role="status">{message}</div>
}

function ParkingDimensions({ spot, onChange }: { spot: { id: string; outline: Point[] }; onChange: (outline: Point[]) => void }) {
  const box = boundsOf(spot.outline)
  const setRect = (x = box.cx, y = box.cy, width = box.width, depth = box.depth) => onChange([
    { x: x - width / 2, y: y - depth / 2 }, { x: x + width / 2, y: y - depth / 2 },
    { x: x + width / 2, y: y + depth / 2 }, { x: x - width / 2, y: y + depth / 2 },
  ])
  return <div className="space-y-2">
    <div className="text-xs font-medium">Rectangular parking area</div>
    <NumberField id={spot.id} name="center-x" value={box.cx} min={-Number.MAX_VALUE} onCommit={(x) => setRect(x)} />
    <NumberField id={spot.id} name="center-y" value={box.cy} min={-Number.MAX_VALUE} onCommit={(y) => setRect(box.cx, y)} />
    <NumberField id={spot.id} name="width" value={box.width} onCommit={(width) => setRect(box.cx, box.cy, width)} />
    <NumberField id={spot.id} name="length" value={box.depth} onCommit={(depth) => setRect(box.cx, box.cy, box.width, depth)} />
  </div>
}

function boundsOf(points: Point[]) {
  const xs = points.map((point) => point.x)
  const ys = points.map((point) => point.y)
  const x = xs.length ? Math.min(...xs) : 0
  const y = ys.length ? Math.min(...ys) : 0
  const width = xs.length ? Math.max(...xs) - x : 0
  const depth = ys.length ? Math.max(...ys) - y : 0
  return { cx: x + width / 2, cy: y + depth / 2, width, depth }
}

function PointEditor({ points, onCommit }: { points: Point[]; onCommit: (points: Point[]) => void }) {
  return <div className="space-y-1"><div className="text-xs font-medium">Points (m)</div>{points.map((point, index) => <div key={index} className="grid grid-cols-2 gap-1">{(['x', 'y'] as const).map((axis) => <CommitInput key={axis} aria-label={`Point ${index + 1} ${axis}`} className="h-7 text-xs" value={point[axis] / 1000} step={0.1} onCommit={(value) => onCommit(points.map((current, pointIndex) => pointIndex === index ? { ...current, [axis]: Math.round(value * 1000) } : current))} />)}</div>)}</div>
}

function Field({ id, label, children }: { id: string; label: string; children: React.ReactNode }) {
  return <div className="space-y-1"><label htmlFor={id} className="text-xs text-muted-foreground">{label}</label>{children}</div>
}

function TruckTypeChecklist({ id, label, items, selectedIds, onChange }: { id: string; label: string; items: { id: string; name: string }[]; selectedIds: string[]; onChange: (ids: string[]) => void }) {
  return <fieldset className="space-y-1"><legend className="text-xs text-muted-foreground">{label}</legend>{items.length === 0 ? <p className="text-xs text-muted-foreground">Create or add a forklift first.</p> : items.map((item) => <label key={item.id} htmlFor={`${id}-${item.id}`} className="flex items-center gap-2 text-xs"><input id={`${id}-${item.id}`} type="checkbox" checked={selectedIds.includes(item.id)} onChange={(event) => onChange(event.target.checked ? [...selectedIds, item.id] : selectedIds.filter((selected) => selected !== item.id))} />{item.name}</label>)}</fieldset>
}

const list = (value: string) => value.split(',').map((item) => item.trim()).filter(Boolean)
