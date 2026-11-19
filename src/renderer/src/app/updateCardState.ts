import { useSyncExternalStore } from 'react'

/**
 * Whether the update card is open, or shrunk into the title-bar pill: the card (bottom right) and the pill
 * (UpdateButton) show one or the other. Open by default, so a new version is seen once. When the user switches
 * from one to the other, the focus follows (`takeFocus`), never when the card appears by itself.
 */
let open = true
let focusPending = false
const listeners = new Set<() => void>()

export function setUpdateCardOpen(next: boolean, byUser = false): void {
  if (open === next) return
  open = next
  focusPending = byUser
  listeners.forEach(l => l())
}

/** True once after the user opened or shrank the card: the side now shown takes the focus */
export function takeFocus(): boolean {
  const pending = focusPending
  focusPending = false
  return pending
}

export function useUpdateCardOpen(): boolean {
  return useSyncExternalStore(
    cb => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    () => open,
    () => open
  )
}
