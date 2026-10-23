import type { Density, MotionSetting, Theme } from '@shared/types'

/** Theme, animation level and density, as attributes the CSS reads */
export function applyAppearance(s: { theme?: Theme; motion?: MotionSetting; density?: Density }): void {
  const root = document.documentElement
  root.setAttribute('data-theme', s.theme ?? 'dark')
  root.setAttribute('data-motion', s.motion ?? 'system')
  root.setAttribute('data-density', s.density ?? 'comfortable')
}

/** True when animations should stay still (setting, or Windows when it follows the system) */
export function reducedMotion(): boolean {
  const m = document.documentElement.getAttribute('data-motion')
  if (m === 'reduced') return true
  if (m === 'full') return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}
