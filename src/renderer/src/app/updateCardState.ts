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

/**
 * « Restart and update », wherever it is clicked (the card, Settings): the card opens and covers the window
 * while DevForge closes, then the update installs behind DevForge's own small window. One way, one look.
 */
let installing = false
/** DevForge still here this long after « install »: the installer did not take over, the window comes back */
const GIVE_UP_MS = 20_000

function setInstalling(next: boolean): void {
  installing = next
  listeners.forEach(l => l())
}

export function startInstall(): void {
  if (installing) return
  setUpdateCardOpen(true)
  setInstalling(true)
  // The cover is painted first, then DevForge closes
  setTimeout(() => {
    window.devforge.updates
      .install()
      .then(() => setTimeout(() => setInstalling(false), GIVE_UP_MS))
      .catch(() => setInstalling(false))
  }, 600)
}

export function useInstalling(): boolean {
  return useSyncExternalStore(
    cb => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    () => installing,
    () => installing
  )
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
