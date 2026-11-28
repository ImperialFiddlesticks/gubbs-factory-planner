import { useState, type CSSProperties } from 'react'
import { ChevronDown, CircleCheck, Map as MapIcon, TriangleAlert } from 'lucide-react'
import { CATEGORY_COLOURS } from '@/data/machineColours'
import { ZONE_KINDS } from '@/data/zones'
import { cn } from '@/lib/utils'
import { CANVAS, COLORS, mixColours } from '@/theme'

/** The legend's rows: a little swatch drawn like the thing on the floor, and its name. */
const ROWS: { label: string; swatch: CSSProperties }[] = [
  {
    label: 'Clearance (working space)',
    swatch: { border: `2px dashed ${CANVAS.valid}`, backgroundColor: `${CANVAS.valid}22` },
  },
  {
    label: 'Clash or warning',
    swatch: { border: `2px solid ${CANVAS.invalid}`, backgroundColor: mixColours(CANVAS.invalid, COLORS.white, 0.84) },
  },
  {
    label: 'Aisle: keep clear',
    swatch: {
      border: `2px dashed ${ZONE_KINDS.aisle.colour}`,
      backgroundColor: `${ZONE_KINDS.aisle.colour}22`,
      backgroundImage: `repeating-linear-gradient(135deg, ${ZONE_KINDS.aisle.colour}88 0 1px, transparent 1px 4px)`,
    },
  },
  {
    label: 'Height limit',
    swatch: { border: `2px dashed ${ZONE_KINDS.height.colour}`, backgroundColor: `${ZONE_KINDS.height.colour}22` },
  },
  {
    label: 'Area',
    swatch: { border: `2px solid ${ZONE_KINDS.area.colour}`, backgroundColor: `${ZONE_KINDS.area.colour}1a` },
  },
  {
    label: 'Conveyor (arrows show flow)',
    swatch: {
      border: `2px solid ${CATEGORY_COLOURS['material-handling']}`,
      backgroundColor: mixColours(CATEGORY_COLOURS['material-handling'], COLORS.white, 0.62),
    },
  },
  {
    label: 'Comment (blue open, mint resolved)',
    swatch: { backgroundColor: COLORS.chatBlue, borderRadius: 6, boxShadow: `inset -7px 0 0 ${COLORS.chatGreen}` },
  },
]

/**
 * A small key in the bottom-left corner of the work area: what the colours and outlines on the
 * floor mean, the grid size, and how many layout checks are flagged right now. Folds down to a
 * "Legend" pill.
 */
export function MapLegend({ gridSize, flagged }: { gridSize: number; flagged: number }) {
  const [open, setOpen] = useState(true)
  const ok = flagged === 0

  return (
    <div className="canvas-legend absolute bottom-16 left-4 z-20 w-60 max-w-[calc(100%_-_2rem)]">
      <div className="overflow-hidden rounded-2xl border bg-card/95 text-card-foreground shadow-soft backdrop-blur">
        <button
          type="button"
          aria-expanded={open}
          aria-controls="map-legend-body"
          onClick={() => setOpen((o) => !o)}
          className="flex w-full items-center gap-2 px-3 py-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
        >
          <MapIcon className="size-3.5 text-muted-foreground" aria-hidden />
          <span className="flex-1 text-xs font-extrabold">Legend</span>
          {/* The check summary stays visible when folded. */}
          <span
            className={cn(
              'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-extrabold',
              ok ? 'bg-(--feedback-green)/15 text-(--feedback-green)' : 'bg-destructive/12 text-destructive',
            )}
          >
            {ok ? <CircleCheck className="size-3" aria-hidden /> : <TriangleAlert className="size-3" aria-hidden />}
            {ok ? 'All checks pass' : `${flagged} ${flagged === 1 ? 'check' : 'checks'} flagged`}
          </span>
          <ChevronDown className={cn('size-3.5 text-muted-foreground transition-transform', !open && 'rotate-180')} aria-hidden />
        </button>
        {open && (
          <div id="map-legend-body" className="border-t px-3 pt-2 pb-2.5 animate-in fade-in-0 slide-in-from-bottom-1">
            <ul className="space-y-1.5">
              {ROWS.map(({ label, swatch }) => (
                <li key={label} className="flex items-center gap-2 text-[11px] font-semibold">
                  <span className="h-3.5 w-5 shrink-0 rounded-sm" style={swatch} aria-hidden />
                  {label}
                </li>
              ))}
            </ul>
            <p className="mt-2 flex items-center gap-2 border-t pt-2 text-[11px] text-muted-foreground">
              <span
                className="h-3.5 w-5 shrink-0 rounded-sm border"
                style={{
                  backgroundColor: CANVAS.floor,
                  backgroundImage: `linear-gradient(${CANVAS.gridMajor} 1px, transparent 1px), linear-gradient(90deg, ${CANVAS.gridMajor} 1px, transparent 1px)`,
                  backgroundSize: '5px 5px',
                }}
                aria-hidden
              />
              Grid: {gridSize / 1000} m per square
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
