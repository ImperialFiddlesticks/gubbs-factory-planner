import { useState } from 'react'
import { Minus, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { isValidStationTarget, MAX_STATIONS, MIN_STATIONS } from '@/lib/setup'
import { usePlanner } from '@/store'

export function StationsStep() {
  const target = usePlanner((s) => s.setup.stationTarget)
  const updateSetup = usePlanner((s) => s.updateSetup)
  // Kept as text so the field can be empty while typing; the store gets the parsed number,
  // which is invalid (and disables Next) until it is a whole number in range.
  const [text, setText] = useState(String(target))
  const valid = isValidStationTarget(target)

  function set(n: number) {
    setText(String(n))
    updateSetup({ stationTarget: n })
  }

  return (
    <div className="flex flex-col items-start gap-4">
      <div className="flex items-center gap-3">
        <Button
          type="button"
          variant="outline"
          size="icon-lg"
          aria-label="Fewer stations"
          disabled={!valid || target <= MIN_STATIONS}
          onClick={() => set(target - 1)}
        >
          <Minus />
        </Button>
        <Input
          id="station-target"
          aria-label="Number of stations"
          type="number"
          inputMode="numeric"
          min={MIN_STATIONS}
          max={MAX_STATIONS}
          step={1}
          value={text}
          onChange={(e) => {
            setText(e.target.value)
            updateSetup({ stationTarget: e.target.value === '' ? 0 : Number(e.target.value) })
          }}
          aria-invalid={!valid}
          className="h-16 w-28 text-center text-3xl font-semibold md:text-3xl"
          autoFocus
        />
        <Button
          type="button"
          variant="outline"
          size="icon-lg"
          aria-label="More stations"
          disabled={!valid || target >= MAX_STATIONS}
          onClick={() => set(target + 1)}
        >
          <Plus />
        </Button>
      </div>

      {valid ? (
        <p className="text-sm text-muted-foreground">
          Each machine you place counts as one station. You'll see your progress towards {target}{' '}
          {target === 1 ? 'station' : 'stations'} in the planner.
        </p>
      ) : (
        <p className="text-sm text-destructive">
          Enter a whole number from {MIN_STATIONS} to {MAX_STATIONS}.
        </p>
      )}
    </div>
  )
}
