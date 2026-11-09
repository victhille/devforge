import type { AccentColor, Density, MotionSetting, TextSize, Theme } from '@shared/types'
import { PALETTES, PALETTE_VARS, TEXT_SCALE, accentSoft, type Palette } from '@shared/lib/accents'

type Appearance = { theme?: Theme; motion?: MotionSetting; density?: Density; accent?: AccentColor; textSize?: TextSize }

/** The theme on screen: 'system' resolved with Windows' light or dark mode */
export function shownTheme(theme: Theme | undefined): 'dark' | 'light' {
  if (theme === 'light') return 'light'
  if (theme === 'system' && window.matchMedia('(prefers-color-scheme: light)').matches) return 'light'
  return 'dark'
}

const VARS = [...Object.values(PALETTE_VARS), '--accent-dim', '--forgy', '--forgy-dim', '--forgy-fg']
let last: Appearance = {}

/** The chosen colour's whole palette (backgrounds, borders, texts, accent and Forgy) over the stylesheet's Forge, in the theme on screen */
function applyAccent(s: Appearance): void {
  const root = document.documentElement
  const accent = s.accent ?? 'forge'
  root.setAttribute('data-accent', accent)
  if (accent === 'forge' || !PALETTES[accent]) { for (const v of VARS) root.style.removeProperty(v); return }
  const theme = shownTheme(s.theme)
  const palette = PALETTES[accent][theme]
  for (const [key, name] of Object.entries(PALETTE_VARS)) root.style.setProperty(name, palette[key as keyof Palette])
  root.style.setProperty('--accent-dim', accentSoft(palette.accent, theme))
  // Forgy is the app's accent: it takes the colour as well (the logo keeps its orange)
  root.style.setProperty('--forgy', palette.accent)
  root.style.setProperty('--forgy-dim', accentSoft(palette.accent, theme))
  root.style.setProperty('--forgy-fg', palette.accentFg)
}

// Windows switching between light and dark: the accent follows when the theme does
if (typeof window !== 'undefined' && window.matchMedia) {
  window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', () => applyAccent(last))
}

/** Theme, animation level, density, main colour and text size, as attributes and variables the CSS reads */
export function applyAppearance(s: Appearance): void {
  last = s
  const root = document.documentElement
  root.setAttribute('data-theme', s.theme ?? 'dark')
  root.setAttribute('data-motion', s.motion ?? 'system')
  root.setAttribute('data-density', s.density ?? 'comfortable')
  // Every text size of the theme is multiplied by it (index.css)
  const size = s.textSize && TEXT_SCALE[s.textSize] ? s.textSize : 'normal'
  root.setAttribute('data-text-size', size)
  root.style.setProperty('--df-text-scale', String(TEXT_SCALE[size]))
  applyAccent(s)
}

/**
 * The size in pixels of an element's text as the theme draws it (`text-base`: 13 px, 12 compact,
 * times --df-text-scale). xterm draws on a canvas, out of the CSS's reach: it takes its size from its host.
 */
export function textPx(el: Element | null, fallback = 13): number {
  const px = el ? parseFloat(getComputedStyle(el).fontSize) : NaN
  return px > 0 ? px : fallback
}

/** Calls back when Settings › Appearance changes the text size or the density (for xterm); gives back what stops it */
export function onTextSizeChange(callback: () => void): () => void {
  const observer = new MutationObserver(callback)
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-text-size', 'data-density'] })
  return () => observer.disconnect()
}

/** True when animations should stay still (setting, or Windows when it follows the system) */
export function reducedMotion(): boolean {
  const m = document.documentElement.getAttribute('data-motion')
  if (m === 'reduced') return true
  if (m === 'full') return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}
