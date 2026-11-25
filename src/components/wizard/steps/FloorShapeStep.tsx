import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ChoiceCard } from '@/components/wizard/ChoiceCard'
import { ShapePreview } from '@/components/wizard/ShapePreview'
import {
  DEFAULT_SHAPES,
  floorCorners,
  polygonArea,
  shapeError,
  shapeOutline,
  type FloorShape,
  type FloorShapeKind,
} from '@/lib/floorShapes'
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
  const name = usePlanner((s) => s.setup.floorName)
  const shape = usePlanner((s) => s.setup.floorShape)
  const updateSetup = usePlanner((s) => s.updateSetup)
  const machineCount = usePlanner((s) => s.machines.length)
  const hasFloor = usePlanner((s) => s.floorplan !== null)

  const error = shapeError(shape)
  const area = error
    ? null
    : polygonArea(floorCorners({ ...shape, outline: shapeOutline(shape) })) / 1e6

  function pickShape(kind: FloorShapeKind) {
    if (kind === shape.kind) return
    // Keep the overall size; the shape's own extras start from their defaults.
    updateSetup({ floorShape: { ...DEFAULT_SHAPES[kind], width: shape.width, depth: shape.depth } })
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
            selected={shape.kind === card.kind}
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
            {error ? (
              <p className="text-destructive">{error}</p>
            ) : (
              <p className="text-muted-foreground">
                Floor area <span className="font-semibold text-foreground">{area!.toFixed(1)} m²</span>
              </p>
            )}
          </div>
        </div>
        <div className="rounded-md bg-muted p-2">
          <ShapePreview shape={shape} boxWidth={360} boxHeight={240} labels />
        </div>
      </div>

      {hasFloor && machineCount > 0 && (
        <p className="text-sm text-muted-foreground">
          Creating this floor replaces the current one and removes its {machineCount}{' '}
          {machineCount === 1 ? 'machine' : 'machines'}.
        </p>
      )}
    </div>
  )
}

interface MetreFieldProps {
  id: string
  label: string
  mm: number
  /** Called on every keystroke; NaN while the field is empty or not a number. */
  onChange: (mm: number) => void
}

function MetreField({ id, label, mm, onChange }: MetreFieldProps) {
  const [text, setText] = useState(Number.isFinite(mm) ? String(mm / 1000) : '')
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type="number"
        min={0}
        step={0.5}
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
