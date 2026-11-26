import { useEffect } from 'react'
import { Layers as LayersIcon, Lock, LockOpen, Redo2, Undo2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Switch } from '@/components/ui/switch'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { LAYERS } from '@/data/layers'
import { redo, undo, useHistory } from '@/history'
import { cn } from '@/lib/utils'
import { usePlanner } from '@/store'

/**
 * Floating control bar at the bottom of the map: undo/redo, lock structures and layers.
 * Keeps the map's own controls next to the map instead of in the crowded header.
 */
export function MapToolbar() {
  return (
    <TooltipProvider>
      <div
        role="toolbar"
        aria-label="Map controls"
        className="theme-dark absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-full border bg-background/95 px-2 py-1 text-foreground shadow-lg backdrop-blur"
      >
        <UndoRedo />
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
