import type { KeyboardEvent } from 'react'

/**
 * Makes a non-button element usable from the keyboard: focusable, and Enter
 * or Space act like a click. Keys typed inside a child control are left alone.
 */
export function pressable(onPress: () => void): { tabIndex: number; onKeyDown: (e: KeyboardEvent) => void } {
  return {
    tabIndex: 0,
    onKeyDown: e => {
      if (e.target !== e.currentTarget || (e.key !== 'Enter' && e.key !== ' ')) return
      e.preventDefault()
      onPress()
    }
  }
}
