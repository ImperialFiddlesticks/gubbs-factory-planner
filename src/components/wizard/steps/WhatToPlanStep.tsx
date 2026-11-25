import { FilePen, SquarePlus } from 'lucide-react'
import { ChoiceCard } from '@/components/wizard/ChoiceCard'
import { usePlanner } from '@/store'

export function WhatToPlanStep() {
  const mode = usePlanner((s) => s.setup.mode)
  const updateSetup = usePlanner((s) => s.updateSetup)

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <ChoiceCard
        icon={SquarePlus}
        title="Plan a new floor"
        description="Start from an empty hall: set its shape and size, then place equipment."
        selected={mode === 'new'}
        onSelect={() => updateSetup({ mode: 'new' })}
      />
      <ChoiceCard
        icon={FilePen}
        title="Edit an existing layout"
        description="Open a layout you saved earlier and keep working on it."
        selected={mode === 'existing'}
        onSelect={() => updateSetup({ mode: 'existing' })}
        disabled
        badge="Coming soon"
      />
    </div>
  )
}
