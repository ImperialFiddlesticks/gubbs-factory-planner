import { useState } from 'react'
import { Input } from '@/components/ui/input'

interface CommitInputProps extends Omit<React.ComponentProps<'input'>, 'value' | 'onChange'> {
  value: number
  /** Called on Enter or blur with a valid number. */
  onCommit: (value: number) => void
  /** Invalid entries revert to `value`. Defaults to any finite number. */
  isValid?: (value: number) => boolean
}

/** Number input that only applies its value on Enter or blur. */
export function CommitInput({
  value,
  onCommit,
  isValid = Number.isFinite,
  ...props
}: CommitInputProps) {
  const [text, setText] = useState(String(value))
  // Follow outside changes (e.g. the machine was dragged) while not editing.
  const [lastValue, setLastValue] = useState(value)
  if (value !== lastValue) {
    setLastValue(value)
    setText(String(value))
  }

  function commit() {
    const next = Number(text)
    if (text.trim() !== '' && isValid(next)) {
      if (next !== value) onCommit(next)
    } else {
      setText(String(value))
    }
  }

  return (
    <Input
      type="number"
      {...props}
      value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
    />
  )
}
