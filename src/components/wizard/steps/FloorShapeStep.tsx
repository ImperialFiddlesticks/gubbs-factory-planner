import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { ChoiceCard } from '@/components/wizard/ChoiceCard'
import { ShapePreview } from '@/components/wizard/ShapePreview'
import { EQUIPMENT_CATEGORIES } from '@/data/categories'
import {
  DEFAULT_SHAPES,
  floorCorners,
  polygonArea,
  shapeError,
  shapeOutline,
  type FloorShape,
  type FloorShapeKind,
} from '@/lib/floorShapes'
import { pillarGridError, pillarGridPositions, type PillarGrid } from '@/lib/pillarGrid'
import { usePlanner } from '@/store'

const SHAPE_CARDS: { kind: FloorShapeKind; title: string; description: string }[] = [
  { kind: 'rectangle', title: 'Rectangle', description: 'A plain rectangular hall.' },
  { kind: 'chamfer', title: 'Chamfered corner', description: 'One corner cut off at an angle.' },
  { kind: 'l-shape', title: 'L-shape', description: 'A block missing from one corner.' },
]

/** Per-shape size fields, in the order they are shown. */
const FIELDS: { [K in FloorShapeKind]: { key: string; label: string }[] } = {
  rectangle: [
    { key: 'width', label: 'Width (m)' },
    { key: 'depth', label: 'Depth (m)' },
  ],
  chamfer: [
    { key: 'width', label: 'Width (m)' },
    { key: 'depth', label: 'Depth (m)' },
    { key: 'chamfer', label: 'Cut-off corner (m)' },
  ],
  'l-shape': [
    { key: 'width', label: 'Width (m)' },
    { key: 'depth', label: 'Depth (m)' },
    { key: 'notchWidth', label: 'Missing corner width (m)' },
    { key: 'notchDepth', label: 'Missing corner depth (m)' },
  ],
}

export function FloorShapeStep() {
  const name = usePlanner((s) => s.wizard.floorName)
  const shape = usePlanner((s) => s.wizard.floorShape)
  const shapeSelected = usePlanner((s) => s.wizard.floorShapeSelected)
  const categories = usePlanner((s) => s.wizard.categories)
  const stationTarget = usePlanner((s) => s.wizard.stationTarget)
  const updateSetup = usePlanner((s) => s.updateSetup)
  const currentName = usePlanner((s) => s.floorplan?.name)
  const hasFloor = usePlanner((s) => s.floorplan !== null)
  const grid = usePlanner((s) => s.wizard.pillarGrid)

  const error = shapeError(shape)
  const bounds = { width: shape.width, depth: shape.depth, outline: shapeOutline(shape) }
  const area = error ? null : polygonArea(floorCorners(bounds)) / 1e6
  const gridError = pillarGridError(grid)
  const pillarAt = !shapeSelected || error ? [] : pillarGridPositions(bounds, grid)
  const categoryNames = EQUIPMENT_CATEGORIES
    .filter((category) => categories.includes(category.id))
    .map((category) => category.name)
    .join(', ')
  const shapeName = SHAPE_CARDS.find((card) => card.kind === shape.kind)?.title ?? shape.kind

  function setGrid(patch: Partial<PillarGrid>) {
    updateSetup({ pillarGrid: { ...grid, ...patch } })
  }

  function pickShape(kind: FloorShapeKind) {
    // Keep the overall size; the shape's own extras start from their defaults.
    updateSetup({
      floorShape: kind === shape.kind
        ? shape
        : { ...DEFAULT_SHAPES[kind], width: shape.width, depth: shape.depth },
      floorShapeSelected: true,
    })
  }

  function setSize(key: string, mm: number) {
    updateSetup({ floorShape: { ...shape, [key]: mm } as FloorShape })
  }

  return (
    <div className="space-y-8">
      <div className="max-w-sm space-y-1.5">
        <Label htmlFor="floor-name">Floor name</Label>
        <Input
          id="floor-name"
          value={name}
          onChange={(e) => updateSetup({ floorName: e.target.value })}
          aria-invalid={!name.trim()}
        />
        {!name.trim() && <p className="text-sm text-destructive">Give the floor a name.</p>}
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {SHAPE_CARDS.map((card) => (
          <ChoiceCard
            key={card.kind}
            media={<ShapePreview shape={DEFAULT_SHAPES[card.kind]} boxWidth={96} boxHeight={64} />}
            title={card.title}
            description={card.description}
            selected={shapeSelected && shape.kind === card.kind}
            onSelect={() => pickShape(card.kind)}
          />
        ))}
      </div>

      <div className="grid items-start gap-6 rounded-lg border bg-card p-6 md:grid-cols-[1fr_auto]">
        <div className="grid grid-cols-2 gap-4">
          {FIELDS[shape.kind].map((field) => (
            <MetreField
              // Remount on shape change so the text follows the new shape's values.
              key={`${shape.kind}-${field.key}`}
              id={`floor-${field.key}`}
              label={field.label}
              mm={(shape as unknown as Record<string, number>)[field.key]}
              onChange={(mm) => setSize(field.key, mm)}
            />
          ))}
          <div className="col-span-2 text-sm">
            {!shapeSelected ? (
              <p className="text-muted-foreground">Select a floor shape to see the floor area.</p>
            ) : error ? (
              <p className="text-destructive">{error}</p>
            ) : (
              <p className="text-muted-foreground">
                Floor area <span className="font-semibold text-foreground">{area!.toFixed(1)} m²</span>
                {grid.enabled && !gridError && (
                  <>
                    {' · '}
                    <span className="font-semibold text-foreground">{pillarAt.length}</span>{' '}
                    {pillarAt.length === 1 ? 'pillar' : 'pillars'}
                  </>
                )}
              </p>
            )}
          </div>

          <div className="col-span-2 space-y-4 border-t pt-4">
            <div className="flex items-center gap-2">
              <Switch
                id="pillar-grid"
                checked={grid.enabled}
                onCheckedChange={(enabled) => setGrid({ enabled })}
              />
              <Label htmlFor="pillar-grid">Add a pillar grid</Label>
            </div>
            {grid.enabled && (
              <div className="grid grid-cols-3 gap-4">
                <MetreField id="grid-x" label="Spacing across (m)" mm={grid.spacingX} onChange={(spacingX) => setGrid({ spacingX })} />
                <MetreField id="grid-y" label="Spacing along (m)" mm={grid.spacingY} onChange={(spacingY) => setGrid({ spacingY })} />
                <MetreField id="grid-size" label="Pillar size (m)" mm={grid.size} step={0.1} onChange={(size) => setGrid({ size })} />
                {gridError && <p className="col-span-3 text-sm text-destructive">{gridError}</p>}
              </div>
            )}
          </div>
        </div>
        <div className="rounded-md bg-muted p-2">
          {shapeSelected ? (
            <ShapePreview
              shape={shape}
              boxWidth={360}
              boxHeight={240}
              labels
              pillars={{ at: pillarAt, size: grid.size }}
            />
          ) : (
            <div className="flex min-h-[256px] items-center justify-center px-6 text-center text-sm text-muted-foreground">
              Choose a floor shape to preview it.
            </div>
          )}
        </div>
      </div>

      <section aria-label="Setup summary" className="!mt-6 space-y-3 rounded-lg border bg-card p-4">
        <h2 className="text-left text-lg font-semibold">Summary of your factory</h2>
        <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-muted-foreground">Plan</dt>
            <dd className="font-medium">New floor</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Floor name</dt>
            <dd className="font-medium">{name.trim() || 'Not set'}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Equipment</dt>
            <dd className="font-medium">{categoryNames || 'None selected'}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Stations</dt>
            <dd className="font-medium">
              {stationTarget} {stationTarget === 1 ? 'station' : 'stations'}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Floor shape</dt>
            <dd className="font-medium">
              {shapeSelected ? shapeName : 'Not selected'} · {formatMetres(shape.width)} × {formatMetres(shape.depth)} m
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Pillar grid</dt>
            <dd className="font-medium">{grid.enabled ? 'On' : 'Off'}</dd>
          </div>
        </dl>
      </section>

      {hasFloor && (
        <p className="text-sm text-muted-foreground">
          This creates a new project. Your current one{currentName && ` ("${currentName}")`} stays saved;
          switch between them from the floor name in the header.
        </p>
      )}
    </div>
  )
}

function formatMetres(mm: number) {
  return Number.isFinite(mm) ? String(Number((mm / 1000).toFixed(2))) : '—'
}

interface MetreFieldProps {
  id: string
  label: string
  mm: number
  /** Input step in metres. */
  step?: number
  /** Called on every keystroke; NaN while the field is empty or not a number. */
  onChange: (mm: number) => void
}

function MetreField({ id, label, mm, step = 0.5, onChange }: MetreFieldProps) {
  const [text, setText] = useState(Number.isFinite(mm) ? String(mm / 1000) : '')
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type="number"
        min={0}
        step={step}
        value={text}
        onChange={(e) => {
          setText(e.target.value)
          const m = e.target.value === '' ? NaN : Number(e.target.value)
          onChange(Math.round(m * 1000))
        }}
      />
    </div>
  )
}
