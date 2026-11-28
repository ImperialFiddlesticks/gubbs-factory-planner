import { useEffect } from 'react'
import { Hand, Layers as LayersIcon, Lock, LockOpen, Maximize, MousePointer2, Redo2, Ruler, Undo2, ZoomIn, ZoomOut } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Switch } from '@/components/ui/switch'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { LAYERS } from '@/data/layers'
import { redo, undo, useHistory } from '@/history'
import { cn } from '@/lib/utils'
import { usePlanner } from '@/store'

/**
 * Floating control bar for zoom, navigation, undo/redo, structures and layers.
 */
export function MapToolbar({
  zoom,
  onZoomIn,
  onZoomOut,
  onFit,
  measuring,
  onToggleMeasure,
  navigationTool,
  onNavigationToolChange,
}: {
  zoom: number
  onZoomIn: () => void
  onZoomOut: () => void
  onFit: () => void
  /** The distance-measuring tape is on. */
  measuring: boolean
  onToggleMeasure: () => void
  navigationTool: 'select' | 'hand'
  onNavigationToolChange: (tool: 'select' | 'hand') => void
}) {
  return (
    <TooltipProvider>
      <div
        role="toolbar"
        aria-label="Map controls"
        className="theme-chrome absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-full border bg-background/95 px-2 py-1 text-foreground shadow-lg backdrop-blur"
      >
        <UndoRedo />
        <Divider />
        <ToolButton
          label="Fit to view"
          onClick={onFit}
          size="sm"
          className="rounded-full bg-accent/20 px-3 text-foreground hover:bg-accent/30"
        >
          <Maximize />
          <span className="text-xs">Fit</span>
        </ToolButton>
        <Divider />
        <ToolButton label="Zoom out" onClick={onZoomOut} disabled={zoom <= 0.25}>
          <ZoomOut />
        </ToolButton>
        <span className="min-w-10 text-center text-[10px] tabular-nums text-muted-foreground">{Math.round(zoom * 100)}%</span>
        <ToolButton label="Zoom in" onClick={onZoomIn} disabled={zoom >= 4}>
          <ZoomIn />
        </ToolButton>
        <Divider />
        <ToolButton
          label="Select tool"
          aria-pressed={navigationTool === 'select'}
          onClick={() => onNavigationToolChange('select')}
          className={cn(navigationTool === 'select' && 'bg-accent text-accent-foreground hover:bg-accent/90 hover:text-accent-foreground')}
        >
          <MousePointer2 />
        </ToolButton>
        <ToolButton
          label="Hand tool"
          aria-pressed={navigationTool === 'hand'}
          onClick={() => onNavigationToolChange('hand')}
          className={cn(navigationTool === 'hand' && 'bg-accent text-accent-foreground hover:bg-accent/90 hover:text-accent-foreground')}
        >
          <Hand />
        </ToolButton>
        <ToolButton
          label={measuring ? 'Exit measuring mode' : 'Measure distance'}
          aria-pressed={measuring}
          onClick={onToggleMeasure}
          className={cn(measuring && 'bg-accent text-accent-foreground hover:bg-accent/90 hover:text-accent-foreground')}
        >
          <Ruler />
        </ToolButton>
        <Divider />
        <LockToggle />
        <LayersMenu />
      </div>
    </TooltipProvider>
  )
}

/**
 * An icon button with its label in a tooltip above it (and as its accessible name). The tooltip
 * hangs on a wrapper, so it still shows while the button is disabled (disabled buttons get no hover).
 */
function ToolButton({
  label,
  className,
  ...props
}: { label: string } & React.ComponentProps<typeof Button>) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex">
          <Button size="icon-sm" variant="ghost" aria-label={label} className={cn('rounded-full', className)} {...props} />
        </span>
      </TooltipTrigger>
      <TooltipContent side="top">{label}</TooltipContent>
    </Tooltip>
  )
}

function Divider() {
  return <span className="mx-1 h-5 w-px bg-border" aria-hidden />
}

/** Undo / redo buttons, plus Ctrl+Z, Ctrl+Shift+Z and Ctrl+Y anywhere outside a text field. */
function UndoRedo() {
  const canUndo = useHistory((h) => h.past.length > 0)
  const canRedo = useHistory((h) => h.future.length > 0)

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!(e.ctrlKey || e.metaKey)) return
      // Text fields keep their own undo.
      const t = e.target as HTMLElement | null
      if (t?.closest('input, textarea, [contenteditable="true"]')) return
      const key = e.key.toLowerCase()
      if (key === 'z' && !e.shiftKey) undo()
      else if ((key === 'z' && e.shiftKey) || key === 'y') redo()
      else return
      e.preventDefault()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <>
      <ToolButton label="Undo (Ctrl+Z)" onClick={undo} disabled={!canUndo}>
        <Undo2 />
      </ToolButton>
      <ToolButton label="Redo (Ctrl+Shift+Z)" onClick={redo} disabled={!canRedo}>
        <Redo2 />
      </ToolButton>
    </>
  )
}

/** Keeps pillars and walls from being selected or dragged while placing machines. */
function LockToggle() {
  const locked = usePlanner((s) => s.lockStructures)
  const toggle = usePlanner((s) => s.toggleLockStructures)
  const Icon = locked ? Lock : LockOpen
  return (
    <ToolButton
      label={locked ? 'Structures locked (click to unlock)' : 'Lock structures'}
      aria-pressed={locked}
      onClick={toggle}
      className={cn(locked && 'bg-accent text-accent-foreground hover:bg-accent/90 hover:text-accent-foreground')}
    >
      <Icon />
    </ToolButton>
  )
}

/** Popover with a switch per canvas layer; opens upwards from the bar. */
function LayersMenu() {
  const layers = usePlanner((s) => s.layers)
  const toggleLayer = usePlanner((s) => s.toggleLayer)
  const onCount = LAYERS.filter((l) => layers[l.id]).length
  return (
    <Popover>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <Button size="icon-sm" variant="ghost" aria-label="Layers" className="rounded-full">
              <LayersIcon />
            </Button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent side="top">
          Layers {onCount}/{LAYERS.length}
        </TooltipContent>
      </Tooltip>
      <PopoverContent side="top" align="center" sideOffset={10} className="w-64 p-2">
        <ul className="flex flex-col">
          {LAYERS.map((l) => (
            <li key={l.id}>
              <label
                htmlFor={`layer-${l.id}`}
                className="flex cursor-pointer items-center gap-3 rounded-sm px-2 py-2 hover:bg-muted"
              >
                <span className="size-3 shrink-0 rounded-full" style={{ backgroundColor: l.colour }} aria-hidden />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="text-sm font-medium">{l.name}</span>
                  <span className="text-xs text-muted-foreground">{l.description}</span>
                </span>
                <Switch id={`layer-${l.id}`} checked={layers[l.id]} onCheckedChange={() => toggleLayer(l.id)} />
              </label>
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  )
}
