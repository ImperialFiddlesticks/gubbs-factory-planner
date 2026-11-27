import { useRef, useState } from 'react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

interface CommitTextProps {
  id: string
  value: string
  placeholder?: string
  /** A few lines of text instead of one; Enter adds a line, Ctrl+Enter saves. */
  multiline?: boolean
  className?: string
  /** Called on blur (or Enter for one line) when the text changed. */
  onCommit: (value: string) => void
}

/**
 * Text field that only saves when you're done (Enter or clicking away), so typing a name
 * is one undo step rather than one per letter. Esc puts the old text back.
 */
export function CommitText({ id, value, placeholder, multiline = false, className, onCommit }: CommitTextProps) {
  const [text, setText] = useState(value)
  // Follow outside changes (another item selected, undo) while not editing.
  const [lastValue, setLastValue] = useState(value)
  if (value !== lastValue) {
    setLastValue(value)
    setText(value)
  }

  /** Set by Esc, so the blur that follows doesn't save the text being thrown away. */
  const cancelled = useRef(false)

  function commit() {
    if (cancelled.current) {
      cancelled.current = false
      return
    }
    if (text !== value) onCommit(text)
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) {
    if (e.key === 'Escape') {
      cancelled.current = true
      setText(value)
      e.currentTarget.blur()
    } else if (e.key === 'Enter' && (!multiline || e.ctrlKey || e.metaKey)) {
      e.preventDefault()
      e.currentTarget.blur()
    }
  }

  if (multiline) {
    return (
      <textarea
        id={id}
        value={text}
        placeholder={placeholder}
        rows={3}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={onKeyDown}
        className={cn(
          'w-full resize-y rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-input/30',
          className,
        )}
      />
    )
  }
  return (
    <Input
      id={id}
      value={text}
      placeholder={placeholder}
      onChange={(e) => setText(e.target.value)}
      onBlur={commit}
      onKeyDown={onKeyDown}
      className={className}
    />
  )
}
