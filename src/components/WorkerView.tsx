import { SafetyReportPanel } from './SafetyReportPanel'
import { useEffect, useMemo, useRef, useState } from 'react'
import { AlertTriangle, Pause, Play } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { machineTypeFor } from '@/data/catalog'
import { floorCorners } from '@/lib/floorShapes'
import { bodyRect, boxToRect, pillarBox, rectCorners, wallBox } from '@/lib/geometry'
import { flowPaths, flowPosition } from '@/lib/simulation'
import { polygonDistance, workerRisks, type Obstacle, type WorkerRisk } from '@/lib/workerSafety'
import { usePlanner } from '@/store'
import type { Floorplan, Point } from '@/types'

/** Eye height of the worker, mm. */
const EYE_MM = 1650
const WALK_MM_PER_S = 2400
const RUN_FACTOR = 2.5
const FORKLIFT_MM_PER_S = 2200
const NEAR_MM = 150
const FREE = '__free'
const TURN_RAD_PER_S = 1.8
/** A risk this far ahead (mm) shows the warning banner. */
const WARN_AHEAD_MM = 4000

interface Face { points: { x: number; y: number; z: number }[]; fill: string; stroke?: string }

function strip(points: Point[], width: number): Point[][] {
  const out: Point[][] = []
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]!, b = points[i]!
    const len = Math.hypot(b.x - a.x, b.y - a.y) || 1
    const nx = (-(b.y - a.y) / len) * width / 2, ny = ((b.x - a.x) / len) * width / 2
    out.push([{ x: a.x + nx, y: a.y + ny }, { x: b.x + nx, y: b.y + ny }, { x: b.x - nx, y: b.y - ny }, { x: a.x - nx, y: a.y - ny }])
  }
  return out
}
function box(corners: Point[], z0: number, z1: number, side: string, top: string): Face[] {
  const faces: Face[] = corners.map((p, i) => {
    const q = corners[(i + 1) % corners.length]!
    return { points: [{ ...p, z: z0 }, { ...q, z: z0 }, { ...q, z: z1 }, { ...p, z: z1 }], fill: side, stroke: '#00000033' }
  })
  faces.push({ points: corners.map((p) => ({ ...p, z: z1 })), fill: top, stroke: '#00000033' })
  return faces
}
function shade(hex: string, f: number) {
  const n = parseInt(hex.slice(1, 7), 16)
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(v * f)))
  return `rgb(${c(n >> 16)}, ${c((n >> 8) & 255)}, ${c(n & 255)})`
}

export function WorkerView({ floor }: { floor: Floorplan }) {
  const machines = usePlanner((s) => s.machines)
  const walls = usePlanner((s) => s.walls)
  const pillars = usePlanner((s) => s.pillars)
  const trucks = usePlanner((s) => s.truckRoutes)
  const walkers = usePlanner((s) => s.pedestrianRoutes)
  const [routeId, setRouteId] = useState(walkers[0]?.id ?? FREE)
  const route = walkers.find((r) => r.id === routeId)
  const free = !route
  const freePos = useRef<Point>({ x: floor.width / 2, y: floor.depth / 2 })
  const freeHeading = useRef(0)
  const keys = useRef(new Set<string>())
  const [nearby, setNearby] = useState<WorkerRisk[]>([])
  const [playing, setPlaying] = useState(true)
  const [progress, setProgress] = useState(0)
  const [look, setLook] = useState(0)
  const canvas = useRef<HTMLCanvasElement>(null)
  const pos = useRef(0)
  const clock = useRef(0)
  const drag = useRef<number | null>(null)

  const obstacles = useMemo<Obstacle[]>(() => [
    ...machines.flatMap((m) => {
      const type = machineTypeFor(m)
      if (!type) return []
      const hazard = type.category === 'welding' || type.category === 'forming' || type.category === 'machining' ? type.category : undefined
      return [{ name: m.name ?? type.shortName, corners: rectCorners(bodyRect(type, m)), hazard, height: m.height ?? type.height ?? 1000, colour: m.colour ?? '#7b9cc4' }]
    }),
    ...walls.map((w) => ({ name: 'a wall', corners: rectCorners(boxToRect(wallBox(w))), height: 3000, colour: '#a8a29e' })),
    ...pillars.map((p) => ({ name: 'a pillar', corners: rectCorners(boxToRect(pillarBox(p))), height: floor.height ?? 6000, colour: '#94a3b8' })),
  ], [machines, walls, pillars, floor.height])

  const routeRisks = useMemo(() => (route ? workerRisks(route, obstacles, trucks) : []), [route, obstacles, trucks])
  const risks = free ? nearby : routeRisks
  const path = useMemo(() => (route ? flowPaths([], [route], []).find((p) => p.kind === 'worker') : undefined), [route])
  const truckPaths = useMemo(() => flowPaths([], [], trucks), [trucks])

  useEffect(() => {
    const el = canvas.current
    const ctx = el?.getContext('2d')
    if (!el || !ctx) return
    const outline = floorCorners(floor)
    const statics: Face[] = []
    for (const o of obstacles as (Obstacle & { height: number; colour: string })[]) statics.push(...box(o.corners, 0, o.height, shade(o.colour, 0.8), o.colour))
    let frame = 0
    let last: number | undefined

    let lastCheck = 0
    const down = (e: KeyboardEvent) => { if (e.target instanceof HTMLElement && e.target.closest('textarea, input, select')) return; if (/^(Arrow|w$|a$|s$|d$|shift$)/i.test(e.key)) { keys.current.add(e.key.toLowerCase()); e.preventDefault() } }
    const up = (e: KeyboardEvent) => keys.current.delete(e.key.toLowerCase())
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    function heading(at: number) {
      const a = flowPosition(path!, Math.max(0, at - 300)), b = flowPosition(path!, Math.min(path!.length, at + 600))
      return Math.atan2(b.y - a.y, b.x - a.x)
    }

    function render() {
      if (!el || !ctx) return
      const W = el.clientWidth, H = el.clientHeight
      if (!W || !H) return
      const dpr = window.devicePixelRatio || 1
      if (el.width !== Math.round(W * dpr)) { el.width = Math.round(W * dpr); el.height = Math.round(H * dpr) }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      const at = path ? Math.min(pos.current, path.length) : 0
      const eye = path ? flowPosition(path, at) : freePos.current
      const h = (path ? heading(at) : freeHeading.current) + look
      const cos = Math.cos(h), sin = Math.sin(h)
      const focal = W / 2 / Math.tan((75 * Math.PI) / 360)
      const cam = (p: { x: number; y: number; z: number }) => {
        const dx = p.x - eye.x, dy = p.y - eye.y
        return { f: dx * cos + dy * sin, r: -dx * sin + dy * cos, u: p.z - EYE_MM }
      }
      // sky and floor backdrop
      ctx.fillStyle = '#d9d4ca'; ctx.fillRect(0, 0, W, H / 2)
      ctx.fillStyle = '#4b4742'; ctx.fillRect(0, H / 2, W, H / 2)

      const faces: Face[] = [{ points: outline.map((p) => ({ ...p, z: 0 })), fill: '#cfc8bb' }]
      for (const t of trucks) for (const q of strip(t.points, t.usableWidthMm)) faces.push({ points: q.map((p) => ({ ...p, z: 2 })), fill: t.access ? '#78716c' : '#f2c14e88' })
      if (route) for (const q of strip(route.points, route.usableWidthMm)) faces.push({ points: q.map((p) => ({ ...p, z: 4 })), fill: '#43a97955' })
      faces.push(...statics)
      for (const tp of truckPaths) {
        const p = flowPosition(tp, clock.current * FORKLIFT_MM_PER_S)
        faces.push(...box([{ x: p.x - 700, y: p.y - 700 }, { x: p.x + 700, y: p.y - 700 }, { x: p.x + 700, y: p.y + 700 }, { x: p.x - 700, y: p.y + 700 }], 0, 2100, '#d97706', '#f59e0b'))
      }
      for (const risk of risks) {
        const s = risk.severity === 'high' ? 220 : 160
        faces.push({ points: [{ ...risk.point, z: 2300 + s }, { x: risk.point.x + s, y: risk.point.y, z: 2300 }, { ...risk.point, z: 2300 - s }, { x: risk.point.x - s, y: risk.point.y, z: 2300 }], fill: risk.severity === 'high' ? '#e11d48' : '#f59e0b', stroke: '#fff' })
      }

      const projected = faces.flatMap((face) => {
        // clip against the near plane
        const pts = face.points.map(cam)
        const clipped: typeof pts = []
        for (let i = 0; i < pts.length; i++) {
          const a = pts[i]!, b = pts[(i + 1) % pts.length]!
          if (a.f >= NEAR_MM) clipped.push(a)
          if ((a.f >= NEAR_MM) !== (b.f >= NEAR_MM)) {
            const t = (NEAR_MM - a.f) / (b.f - a.f)
            clipped.push({ f: NEAR_MM, r: a.r + (b.r - a.r) * t, u: a.u + (b.u - a.u) * t })
          }
        }
        if (clipped.length < 3) return []
        const depth = Math.max(...clipped.map((p) => p.f))
        const flat = face.points.every((p) => p.z < 10)
        return [{ face, depth: flat ? Infinity : clipped.reduce((s, p) => s + Math.hypot(p.f, p.r), 0) / clipped.length, screen: clipped.map((p) => ({ x: W / 2 + (p.r / p.f) * focal, y: H / 2 - (p.u / p.f) * focal })), far: depth }]
      })
      projected.sort((a, b) => b.depth - a.depth)
      for (const { face, screen } of projected) {
        ctx.beginPath()
        screen.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)))
        ctx.closePath()
        ctx.fillStyle = face.fill
        ctx.fill()
        if (face.stroke) { ctx.strokeStyle = face.stroke; ctx.lineWidth = 1; ctx.stroke() }
      }
    }

    const resize = new ResizeObserver(render)
    resize.observe(el)
    function tick(now: number) {
      if (last !== undefined) {
        const dt = Math.min((now - last) / 1000, 0.1)
        clock.current += dt
        if (!path) {
          const k = keys.current
          const turn = (k.has('arrowright') || k.has('d') ? 1 : 0) - (k.has('arrowleft') || k.has('a') ? 1 : 0)
          const step = (k.has('arrowup') || k.has('w') ? 1 : 0) - (k.has('arrowdown') || k.has('s') ? 1 : 0)
          freeHeading.current += turn * TURN_RAD_PER_S * dt
          const h = freeHeading.current + look
          const speed = WALK_MM_PER_S * (k.has('shift') ? RUN_FACTOR : 1)
          const next = { x: freePos.current.x + Math.cos(h) * step * speed * dt, y: freePos.current.y + Math.sin(h) * step * speed * dt }
          if (step && obstacles.every((o) => { const d = polygonDistance(next, o.corners); return d > 250 || d > polygonDistance(freePos.current, o.corners) })) freePos.current = next
          if (now - lastCheck > 300) {
            lastCheck = now
            const p = freePos.current
            const here = { id: 'free', name: 'You', usableWidthMm: 800, points: [p, { x: p.x + Math.cos(h), y: p.y + Math.sin(h) }] }
            const found = workerRisks(here, obstacles, trucks)
            setNearby((old) => (JSON.stringify(old.map((r) => r.message)) === JSON.stringify(found.map((r) => r.message)) ? old : found))
          }
        } else if (playing) {
          pos.current = (pos.current + dt * WALK_MM_PER_S) % path!.length
          setProgress(pos.current)
        }
      }
      last = now
      render()
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => { resize.disconnect(); cancelAnimationFrame(frame); window.removeEventListener('keydown', down); window.removeEventListener('keyup', up) }
  }, [floor, obstacles, path, playing, risks, route, look, trucks, truckPaths])

  const ahead = free ? risks[0] : risks.find((r) => r.at >= progress && r.at - progress < WARN_AHEAD_MM)
  const jump = (r: WorkerRisk) => { pos.current = Math.max(0, r.at - 2500); setProgress(pos.current); setPlaying(false) }

  return (
    <div className="flex h-full min-h-0 flex-col lg:flex-row">
      <div className="relative min-h-0 flex-1">
        <canvas
          ref={canvas}
          aria-label="Worker's view"
          className="block h-full w-full cursor-grab touch-none active:cursor-grabbing"
          onPointerDown={(e) => { drag.current = e.clientX; e.currentTarget.setPointerCapture(e.pointerId) }}
          onPointerMove={(e) => { if (drag.current === null) return; setLook((l) => l + (e.clientX - drag.current!) * 0.006); drag.current = e.clientX }}
          onLostPointerCapture={() => { drag.current = null }}
          onDoubleClick={() => setLook(0)}
        />
        {ahead && (
          <div role="alert" className={'absolute left-1/2 top-4 flex max-w-[90%] -translate-x-1/2 items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white shadow-lg ' + (ahead.severity === 'high' ? 'bg-rose-600' : 'bg-amber-600')}>
            <AlertTriangle className="size-4 shrink-0" /> {free ? 'Here' : ((ahead.at - progress) / 1000).toFixed(1) + ' m ahead'}: {ahead.message}
          </div>
        )}
        {free ? (
          <div className="absolute inset-x-3 bottom-3 rounded-lg bg-black/60 px-3 py-2 text-center text-xs text-white">Walk with the arrow keys or W A S D · hold Shift to run · drag to look around</div>
        ) : path && (
        <div className="absolute inset-x-3 bottom-3 flex items-center gap-3 rounded-lg bg-black/60 px-3 py-2 text-xs text-white">
          <Button size="sm" variant="secondary" onClick={() => setPlaying((p) => !p)}>{playing ? <><Pause /> Pause</> : <><Play /> Walk</>}</Button>
          <input aria-label="Position along the walk" className="min-w-0 flex-1" type="range" min={0} max={path.length} value={progress} onChange={(e) => { pos.current = Number(e.target.value); setProgress(pos.current) }} />
          <span className="shrink-0">{(progress / 1000).toFixed(1)} / {(path.length / 1000).toFixed(1)} m</span>
          <span className="hidden shrink-0 opacity-70 sm:inline">Drag to look around</span>
        </div>
        )}
      </div>
      <aside className="max-h-[40%] w-full shrink-0 overflow-y-auto border-t p-4 lg:max-h-none lg:w-80 lg:border-l lg:border-t-0">
        <label className="mb-3 block text-xs font-semibold">
          Walk as a worker along
          <select className="mt-1 w-full rounded-md border bg-background px-2 py-1.5 text-sm" value={route?.id ?? FREE} onChange={(e) => { setRouteId(e.target.value); pos.current = 0; setProgress(0); setPlaying(false) }}>
            <option value={FREE}>Free walk (arrow keys)</option>
            {walkers.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
          </select>
        </label>
        <h2 className="mb-2 text-sm font-semibold">{free ? 'Safety risks where you stand' : 'Safety risks on this walk'} ({risks.length})</h2>
        {risks.length === 0 && <p className="text-sm text-muted-foreground">{free ? 'Nothing risky right here. Walk up to machines or forklift routes.' : 'No risks found along this walk.'}</p>}
        <ul className="space-y-2">
          {risks.map((r, i) => (
            <li key={i}>
              <button type="button" disabled={free} onClick={() => jump(r)} className="w-full rounded-md border p-2 text-left text-xs hover:bg-muted">
                <span className={'mr-1 inline-block size-2 rounded-full ' + (r.severity === 'high' ? 'bg-rose-500' : 'bg-amber-500')} />
                 {!free && <span className="font-semibold">{(r.at / 1000).toFixed(1)} m · </span>}{r.message}
              </button>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-[11px] text-muted-foreground">Concept: risk checks use simple distance rules (0.6 m passages, 1.5 m from forklift routes and hot or cutting machines). Click a risk to walk up to it.</p>
        <SafetyReportPanel projectId={floor.id} detected={risks.map((r) => r.message)} where={free ? 'Free walk in the factory' : `${route?.name ?? 'Walk'}, ${(progress / 1000).toFixed(1)} m along`} />
      </aside>
    </div>
  )
}
