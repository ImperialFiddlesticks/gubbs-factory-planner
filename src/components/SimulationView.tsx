import { useEffect, useMemo, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { machineTypeFor } from '@/data/catalog'
import { floorCorners } from '@/lib/floorShapes'
import { bodyRect, boxToRect, pillarBox, rectCorners, wallBox } from '@/lib/geometry'
import { flowPaths, flowPosition, trafficCells, type FlowKind } from '@/lib/simulation'
import { crossingPoints } from '@/lib/truckLogistics'
import { usePlanner } from '@/store'
import type { Floorplan, Point } from '@/types'

const colors: Record<FlowKind, string> = { material: '#f4a83b', worker: '#2ce0bd', truck: '#5ca7ff' }
const speeds: Record<FlowKind, number> = { material: 1000, worker: 1400, truck: 2200 }
const cellSize = 1000

export function SimulationView({ floor, onClose }: { floor: Floorplan; onClose: () => void }) {
  const machines = usePlanner((s) => s.machines)
  const walls = usePlanner((s) => s.walls)
  const pillars = usePlanner((s) => s.pillars)
  const trucks = usePlanner((s) => s.truckRoutes)
  const workers = usePlanner((s) => s.pedestrianRoutes)
  const canvas = useRef<HTMLCanvasElement>(null)
  const dialog = useRef<HTMLDialogElement>(null)
  const elapsed = useRef(0)
  const drag = useRef<Point | null>(null)
  const [playing, setPlaying] = useState(false)
  const [heat, setHeat] = useState(false)
  const [threeD, setThreeD] = useState(true)
  const [camera, setCamera] = useState({ angle: -0.55, tilt: 0.55, zoom: 1 })
  const [reset, setReset] = useState(0)

  const paths = useMemo(() => flowPaths(machines, workers, trucks), [machines, workers, trucks])
  const crossings = useMemo(() => trucks.flatMap((truck) => workers.flatMap((worker) => crossingPoints(truck, worker))), [trucks, workers])
  const cells = useMemo(() => trafficCells(paths, cellSize), [paths])
  const limit = useMemo(() => cells.reduce((max, cell) => Math.max(max, cell.count), 1), [cells])
  const blocks = useMemo(() => [
    ...machines.flatMap((machine) => {
      const type = machineTypeFor(machine)
      return type ? [{ corners: rectCorners(bodyRect(type, machine)), height: machine.height ?? type.height ?? 1000, color: machine.colour ?? (type.conveyor ? '#b8874d' : '#668ab5') }] : []
    }),
    ...walls.map((wall) => ({ corners: rectCorners(boxToRect(wallBox(wall))), height: 3000, color: '#667582' })),
    ...pillars.map((pillar) => ({ corners: rectCorners(boxToRect(pillarBox(pillar))), height: 3000, color: '#8293a1' })),
  ], [machines, walls, pillars])

  useEffect(() => { dialog.current?.showModal() }, [])

  useEffect(() => {
    const element = canvas.current
    const ctx = element?.getContext('2d')
    if (!element || !ctx) return
    const outline = floorCorners(floor)
    let frame = 0
    let last: number | undefined

    function render() {
      if (!element || !ctx) return
      const { clientWidth: width, clientHeight: height } = element
      if (!width || !height) return
      const dpr = window.devicePixelRatio || 1
      const pixelWidth = Math.round(width * dpr)
      const pixelHeight = Math.round(height * dpr)
      if (element.width !== pixelWidth || element.height !== pixelHeight) {
        element.width = pixelWidth
        element.height = pixelHeight
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, width, height)
      const angle = threeD ? camera.angle : 0
      const tilt = threeD ? camera.tilt : Math.PI / 2
      const c = Math.cos(angle), s = Math.sin(angle)
      const flatten = Math.sin(tilt), raise = Math.cos(tilt)
      const extent = Math.hypot(floor.width, floor.depth)
      const maxHeight = threeD ? blocks.reduce((max, b) => Math.max(max, b.height), 0) : 0
      const scale = camera.zoom * 0.88 * (threeD
        ? Math.min(width / extent, height / (extent * flatten + maxHeight * raise))
        : Math.min(width / floor.width, height / floor.depth))
      const depth = (p: Point) => (p.x - floor.width / 2) * s + (p.y - floor.depth / 2) * c
      const project = (p: Point, z = 0) => ({
        x: width / 2 + ((p.x - floor.width / 2) * c - (p.y - floor.depth / 2) * s) * scale,
        y: height / 2 + (depth(p) * flatten + (maxHeight / 2 - z) * raise) * scale,
      })
      function polygon(points: Point[], color: string, stroke?: string) {
        if (!ctx || points.length === 0) return
        ctx.beginPath()
        points.forEach((p, i) => { if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y) })
        ctx.closePath()
        ctx.fillStyle = color
        ctx.fill()
        if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 1; ctx.stroke() }
      }
      if (threeD) polygon(outline.map((p) => project(p, -190)), '#26364a')
      polygon(outline.map((p) => project(p)), '#223b4d', '#62829a')
      if (heat && outline.length) {
        ctx.save()
        ctx.clip()
        for (const { x, y, count } of cells) {
          const intensity = count / limit
          polygon([{ x, y }, { x: x + cellSize, y }, { x: x + cellSize, y: y + cellSize }, { x, y: y + cellSize }].map((p) => project(p)), 'hsla(' + (52 - intensity * 52) + ', 96%, 56%, ' + (0.28 + intensity * 0.54) + ')')
        }
        ctx.restore()
      }
      const ordered = [...blocks].sort((a, b) => {
        const meanDepth = (points: Point[]) => points.reduce((sum, p) => sum + depth(p), 0) / points.length
        return meanDepth(a.corners) - meanDepth(b.corners)
      })
      for (const block of ordered) {
        const bottom = block.corners.map((p) => project(p))
        const top = block.corners.map((p) => project(p, block.height))
        if (threeD) {
          for (let i = 0; i < bottom.length; i++) {
            const j = (i + 1) % bottom.length
            if (bottom[j].x < bottom[i].x) polygon([bottom[i], bottom[j], top[j], top[i]], i % 2 ? '#395066' : '#304257', '#233444')
          }
        }
        polygon(top, block.color, '#273f55')
      }
      for (const p of crossings) {
        const q = project(p, 130)
        polygon([{ x: q.x, y: q.y - 7 }, { x: q.x + 7, y: q.y }, { x: q.x, y: q.y + 7 }, { x: q.x - 7, y: q.y }], '#ff6490', '#fff')
      }
      for (const path of paths) {
        const z = threeD ? (path.kind === 'material' ? 950 : 100) : 0
        ctx.beginPath()
        path.points.forEach((p, i) => {
          const q = project(p, z)
          if (i === 0) ctx.moveTo(q.x, q.y); else ctx.lineTo(q.x, q.y)
        })
        ctx.strokeStyle = colors[path.kind] + 'aa'
        ctx.lineWidth = 2
        ctx.setLineDash([5, 4])
        ctx.stroke()
        ctx.setLineDash([])
        const marker = project(flowPosition(path, elapsed.current * speeds[path.kind]), z + (threeD ? 180 : 0))
        ctx.fillStyle = colors[path.kind]
        if (path.kind === 'worker') {
          ctx.beginPath()
          ctx.arc(marker.x, marker.y, 5, 0, Math.PI * 2)
          ctx.fill()
        } else {
          const size = path.kind === 'truck' ? 7 : 5
          ctx.fillRect(marker.x - size, marker.y - 4, size * 2, 8)
        }
      }
    }

    const resize = new ResizeObserver(render)
    resize.observe(element)
    render()
    function tick(now: number) {
      if (last !== undefined) elapsed.current += Math.min((now - last) / 1000, 0.1)
      last = now
      render()
      frame = requestAnimationFrame(tick)
    }
    if (playing) frame = requestAnimationFrame(tick)
    return () => { resize.disconnect(); cancelAnimationFrame(frame) }
  }, [blocks, camera, cells, crossings, floor, heat, limit, paths, playing, reset, threeD])

  const distance = (kind: FlowKind) => (paths.filter((path) => path.kind === kind).reduce((sum, path) => sum + path.length, 0) / 1000).toFixed(1)
  return (
    <dialog
      ref={dialog}
      onCancel={onClose}
      aria-labelledby="simulation-title"
      className="theme-dark fixed inset-0 m-0 h-dvh max-h-none w-screen max-w-none overflow-hidden border-0 bg-background p-0 text-foreground"
    >
      <div className="flex h-full min-h-0 flex-col">
        <header className="flex flex-wrap items-center gap-2 border-b p-3 sm:px-5">
          <h1 id="simulation-title" className="mr-auto text-sm font-semibold">Factory simulation</h1>
          <Button variant="outline" size="sm" onClick={() => setThreeD((value) => !value)}>{threeD ? '2D view' : '3D view'}</Button>
          <Button variant="secondary" size="sm" disabled={!paths.length} onClick={() => setPlaying((value) => !value)}>{playing ? 'Pause' : 'Play'}</Button>
          <Button variant="outline" size="sm" onClick={() => { elapsed.current = 0; setPlaying(false); setReset((value) => value + 1) }}>Reset playback</Button>
          <Button variant={heat ? 'secondary' : 'outline'} size="sm" aria-pressed={heat} onClick={() => setHeat((value) => !value)}>Heatmap</Button>
          <Button variant="outline" size="sm" onClick={onClose}>Back to planner</Button>
        </header>
        <div className="relative min-h-0 flex-1 bg-[#132431]">
          <canvas
            ref={canvas}
            aria-label={threeD ? '3D factory visualization' : '2D factory visualization'}
            className={'block h-full w-full touch-none ' + (threeD ? 'cursor-grab active:cursor-grabbing' : '')}
            onPointerDown={(event) => {
              if (!threeD || event.button !== 0) return
              drag.current = { x: event.clientX, y: event.clientY }
              event.currentTarget.setPointerCapture(event.pointerId)
            }}
            onPointerMove={(event) => {
              const previous = drag.current
              if (!previous) return
              const dx = event.clientX - previous.x, dy = event.clientY - previous.y
              drag.current = { x: event.clientX, y: event.clientY }
              setCamera((current) => ({ ...current, angle: current.angle + dx * 0.007, tilt: Math.max(0.18, Math.min(1.45, current.tilt + dy * 0.005)) }))
            }}
            onLostPointerCapture={() => { drag.current = null }}
            onWheel={(event) => setCamera((current) => ({ ...current, zoom: Math.max(0.5, Math.min(4, current.zoom * (event.deltaY < 0 ? 1.12 : 0.89))) }))}
          />
          {!paths.length && <p className="pointer-events-none absolute inset-x-3 top-3 text-center text-sm text-white">Place a conveyor or draw a pedestrian or forklift route to start playback.</p>}
        </div>
        <footer className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t px-4 py-3 text-xs">
          <span style={{ color: colors.material }}>Material · {distance('material')} m</span>
          <span style={{ color: colors.worker }}>Pedestrians · {distance('worker')} m</span>
          <span style={{ color: colors.truck }}>Forklifts · {distance('truck')} m</span>
          {crossings.length > 0 && <span className="text-pink-300">◆ Truck and pedestrian crossing</span>}
          {heat && <span>Yellow to red · more route passes per m²</span>}
          <label className="ml-auto flex items-center gap-2">
            Zoom
            <input className="w-24" type="range" min={0.5} max={4} step={0.05} value={camera.zoom} onChange={(event) => setCamera((current) => ({ ...current, zoom: Number(event.target.value) }))} />
          </label>
          {threeD && <Button variant="ghost" size="sm" onClick={() => setCamera((current) => ({ ...current, angle: current.angle + Math.PI / 4 }))}>Rotate camera</Button>}
        </footer>
      </div>
    </dialog>
  )
}
