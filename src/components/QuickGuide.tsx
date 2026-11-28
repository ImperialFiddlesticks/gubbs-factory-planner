import { ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

const TIPS = [
  'Drag equipment from the library onto the floor.',
  'Select machines to edit them, move them, or group them together.',
  'Use Layout checks to spot issues. Open Projects to manage or save your work.',
]

export function QuickGuide({
  open,
  onOpenChange,
  onStartTour,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onStartTour: () => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl">Welcome to Factory Planner</DialogTitle>
          <DialogDescription>Three quick tips to get you started.</DialogDescription>
        </DialogHeader>
        <ol className="grid gap-3 py-1">
          {TIPS.map((tip, index) => (
            <li key={tip} className="flex items-start gap-3 text-sm leading-relaxed">
              <span className="grid size-6 shrink-0 place-items-center rounded-full bg-muted text-xs font-medium text-muted-foreground">{index + 1}</span>
              <span>{tip}</span>
            </li>
          ))}
        </ol>
        <DialogFooter className="flex-col-reverse sm:flex-row sm:justify-between">
          <Button
            variant="outline"
            className="border-2 border-accent bg-accent/10 font-semibold shadow-sm hover:bg-accent/20"
            onClick={() => onOpenChange(false)}
          >
            I’ll explore myself
          </Button>
          <Button onClick={onStartTour}>Show me around <ArrowRight /></Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
