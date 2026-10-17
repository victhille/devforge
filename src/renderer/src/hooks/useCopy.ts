import { useCallback, useEffect, useRef, useState } from 'react'

/** Copy text to clipboard, `copied` holds the last copied key for `delay` ms. */
export function useCopy(delay = 1500) {
  const [copied, setCopied] = useState<string | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout>>()

  useEffect(() => () => clearTimeout(timer.current), [])

  const copy = useCallback((text: string, key = 'default') => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(key)
      clearTimeout(timer.current)
      timer.current = setTimeout(() => setCopied(null), delay)
    })
  }, [delay])

  return { copied, copy, isCopied: (key = 'default') => copied === key }
}
