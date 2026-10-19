import type { MotionSetting, Theme } from '@shared/types'

/** Theme and animation level, as attributes the CSS reads */
export function applyAppearance(s: { theme?: Theme; motion?: MotionSetting }): void {
  const root = document.documentElement
  root.setAttribute('data-theme', s.theme ?? 'dark')
  root.setAttribute('data-motion', s.motion ?? 'system')
}

/** True when animations should stay still (setting, or Windows when it follows the system) */
export function reducedMotion(): boolean {
  const m = document.documentElement.getAttribute('data-motion')
  if (m === 'reduced') return true
  if (m === 'full') return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}
