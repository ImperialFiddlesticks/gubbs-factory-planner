import { useEffect, useState } from 'react'

/** Live size of an element in whole px (0 × 0 until it has been measured). */
export function useElementSize(ref: React.RefObject<HTMLElement | null>, active = true) {
  const [size, setSize] = useState({ width: 0, height: 0 })
  useEffect(() => {
    if (!active) return
    const el = ref.current
    if (!el) return
    const measure = () => {
      const { width, height } = el.getBoundingClientRect()
      setSize({ width: Math.floor(width), height: Math.floor(height) })
    }
    // Measure immediately when the observed view becomes active. ResizeObserver's first
    // notification is asynchronous, which can leave canvas-backed views blank in the meantime.
    measure()
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect
      setSize({ width: Math.floor(width), height: Math.floor(height) })
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [ref, active])
  return size
}
