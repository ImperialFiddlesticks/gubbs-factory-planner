import { ArrowLeft, ArrowRight, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface StepLayoutProps {
  /** Short label for each step, shown in the progress bar. */
  steps: string[]
  /** Index into `steps` of the step showing now. */
  current: number
  title: string
  description?: string
  /** Next stays disabled until the step's answer is valid. */
  canNext: boolean
  onNext: () => void
  /** Omitted on the first step. */
  onBack?: () => void
  /** Omitted when there is no floor to go back to. */
  onCancel?: () => void
  nextLabel?: string
  children: React.ReactNode
}

/** Full-page wizard step: dark header with progress, light question area, Back/Next footer. */
export function StepLayout({
  steps,
  current,
  title,
  description,
  canNext,
  onNext,
  onBack,
  onCancel,
  nextLabel = 'Next',
  children,
}: StepLayoutProps) {
  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (canNext) onNext()
  }

  return (
    <form onSubmit={handleSubmit} className="flex h-screen flex-col">
      <header className="relative z-10 border-b bg-card shadow-soft">
        <div className="flex h-14 items-center gap-3 px-4">
          <span className="h-6 w-1 bg-accent" aria-hidden />
          <span className="text-sm font-semibold tracking-widest uppercase">Factory Planner</span>
          {onCancel && (
            <Button type="button" variant="ghost" size="sm" className="ml-auto" onClick={onCancel}>
              <X /> Back to planner
            </Button>
          )}
        </div>
        <Progress steps={steps} current={current} />
      </header>

      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl px-6 py-12">
          <p className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">
            Step {current + 1} of {steps.length}
          </p>
          <h1 className="mt-2 text-3xl font-semibold">{title}</h1>
          {description && <p className="mt-2 text-muted-foreground">{description}</p>}
          <div className="mt-8">{children}</div>
        </div>
      </main>

      <footer className="border-t bg-card">
        <div className="mx-auto flex max-w-3xl items-center px-6 py-4">
          {onBack && (
            <Button type="button" variant="outline" onClick={onBack}>
              <ArrowLeft /> Back
            </Button>
          )}
          <Button type="submit" className="ml-auto" disabled={!canNext}>
            {nextLabel} <ArrowRight />
          </Button>
        </div>
      </footer>
    </form>
  )
}

/** One segment per step: done and current are yellow, the rest grey. */
function Progress({ steps, current }: { steps: string[]; current: number }) {
  return (
    <ol className="flex gap-1 px-4 pb-3" aria-label="Progress">
      {steps.map((label, i) => (
        <li key={label} className="flex-1" aria-current={i === current ? 'step' : undefined}>
          <div className={cn('h-1 rounded-full', i <= current ? 'bg-accent' : 'bg-secondary')} />
          <span
            className={cn(
              'mt-1.5 block truncate text-xs',
              i === current ? 'font-semibold text-foreground' : 'text-muted-foreground',
            )}
          >
            {label}
          </span>
        </li>
      ))}
    </ol>
  )
}
