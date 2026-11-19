import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { visibleInterval, type VisiblePage } from '../../src/renderer/src/lib/visibleInterval'

/** A page that can be hidden and shown again, as Windows does when the window is minimized */
function fakePage(): VisiblePage & { set: (v: 'visible' | 'hidden') => void; listeners: number } {
  const target = new EventTarget()
  let listeners = 0
  const page = {
    visibilityState: 'visible',
    addEventListener: (t: 'visibilitychange', l: () => void) => { listeners++; target.addEventListener(t, l) },
    removeEventListener: (t: 'visibilitychange', l: () => void) => { listeners--; target.removeEventListener(t, l) },
    set: (v: 'visible' | 'hidden') => { page.visibilityState = v; target.dispatchEvent(new Event('visibilitychange')) },
    get listeners() { return listeners }
  }
  return page
}

describe('visibleInterval', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  it('calls every period while the window is shown', () => {
    const fn = vi.fn()
    const stop = visibleInterval(fn, 5000, fakePage())
    vi.advanceTimersByTime(15_000)
    expect(fn).toHaveBeenCalledTimes(3)
    stop()
  })

  it('calls nothing while hidden, then catches up once when shown again', () => {
    const fn = vi.fn()
    const page = fakePage()
    const stop = visibleInterval(fn, 5000, page)
    page.set('hidden')
    vi.advanceTimersByTime(60_000)
    expect(fn).not.toHaveBeenCalled()
    page.set('visible')
    expect(fn).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(5000)
    expect(fn).toHaveBeenCalledTimes(2)
    stop()
  })

  it('does not call twice when the window comes back before the period is over', () => {
    const fn = vi.fn()
    const page = fakePage()
    const stop = visibleInterval(fn, 5000, page)
    vi.advanceTimersByTime(1000)
    page.set('hidden')
    vi.advanceTimersByTime(1000)
    page.set('visible')
    expect(fn).not.toHaveBeenCalled()
    stop()
  })

  it('starts paused in a hidden window', () => {
    const fn = vi.fn()
    const page = fakePage()
    page.visibilityState = 'hidden'
    const stop = visibleInterval(fn, 5000, page)
    vi.advanceTimersByTime(20_000)
    expect(fn).not.toHaveBeenCalled()
    stop()
  })

  it('stops for good: no timer, no listener left', () => {
    const fn = vi.fn()
    const page = fakePage()
    const stop = visibleInterval(fn, 5000, page)
    stop()
    page.set('hidden')
    page.set('visible')
    vi.advanceTimersByTime(20_000)
    expect(fn).not.toHaveBeenCalled()
    expect(page.listeners).toBe(0)
    expect(vi.getTimerCount()).toBe(0)
  })
})
