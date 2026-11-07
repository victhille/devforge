import { useEffect, useRef, useState, type RefObject } from 'react'

/**
 * v4.3: whether an element is narrower than `px` (a small window, Forgy's
 * panel open), followed as it changes. For what a CSS container query cannot
 * do alone, such as folding a menu the user can also fold by hand.
 */
export function useNarrow<T extends HTMLElement>(px: number): [RefObject<T>, boolean] {
  const ref = useRef<T>(null)
  const [narrow, setNarrow] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const watch = new ResizeObserver(([entry]) => setNarrow(entry.contentRect.width < px))
    watch.observe(el)
    return () => watch.disconnect()
  }, [px])
  return [ref, narrow]
}
