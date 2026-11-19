/** What visibleInterval reads of the page: `document`, or a stand-in in the tests */
export interface VisiblePage {
  visibilityState: string
  addEventListener(type: 'visibilitychange', listener: () => void): void
  removeEventListener(type: 'visibilitychange', listener: () => void): void
}

/**
 * Calls `fn` every `ms` while the window is shown, and never while it is hidden (minimized, in the tray): no request
 * leaves for a page nobody sees. Shown again after a missed call, `fn` runs at once, then every `ms` again.
 * The first call is the caller's, as with setInterval. Returns the function that stops it.
 */
export function visibleInterval(fn: () => void, ms: number, page: VisiblePage = document): () => void {
  let id: ReturnType<typeof setInterval> | undefined
  let last = Date.now()
  const tick = () => {
    last = Date.now()
    fn()
  }
  const start = () => {
    if (id === undefined) id = setInterval(tick, ms)
  }
  const pause = () => {
    if (id !== undefined) {
      clearInterval(id)
      id = undefined
    }
  }
  const onChange = () => {
    if (page.visibilityState !== 'visible') return pause()
    if (id !== undefined) return
    if (Date.now() - last >= ms) tick()
    start()
  }
  if (page.visibilityState === 'visible') start()
  page.addEventListener('visibilitychange', onChange)
  return () => {
    pause()
    page.removeEventListener('visibilitychange', onChange)
  }
}
