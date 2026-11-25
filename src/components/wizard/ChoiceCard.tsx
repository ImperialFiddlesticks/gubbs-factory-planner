import { Check, type LucideIcon } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

interface ChoiceCardProps {
  title: string
  description: string
  icon?: LucideIcon
  /** Picture shown at the top of the card instead of an icon, e.g. a shape preview. */
  media?: React.ReactNode
  selected: boolean
  onSelect: () => void
  disabled?: boolean
  /** Small label in the corner, e.g. "Coming soon". */
  badge?: string
}

/** Large clickable answer card for wizard steps, single- or multi-select. */
export function ChoiceCard({
  title,
  description,
  icon: Icon,
  media,
  selected,
  onSelect,
  disabled,
  badge,
}: ChoiceCardProps) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      disabled={disabled}
      onClick={onSelect}
      className={cn(
        'relative flex flex-col items-start gap-3 rounded-lg border-2 bg-card p-6 text-left transition-colors',
        'focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none',
        selected ? 'border-primary' : 'border-border hover:border-primary/50',
        disabled && 'cursor-not-allowed opacity-60 hover:border-border',
      )}
    >
      {media}
      {!media && Icon && (
        <span
          className={cn(
            'grid size-11 place-items-center rounded-md',
            selected ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground',
          )}
        >
          <Icon className="size-5" aria-hidden />
        </span>
      )}
      <span className="text-lg font-semibold">{title}</span>
      <span className="text-sm text-muted-foreground">{description}</span>

      {badge && (
        <Badge variant="secondary" className="absolute top-4 right-4">
          {badge}
        </Badge>
      )}
      {selected && (
        <span className="absolute top-4 right-4 grid size-6 place-items-center rounded-full bg-primary text-primary-foreground">
          <Check className="size-4" aria-hidden />
        </span>
      )}
    </button>
  )
}
