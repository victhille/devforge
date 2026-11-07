/**
 * v4.3: brand colors (frameworks, file types, docs) stay as their makers
 * chose them, except the pale ones (yellow, light gray…), which a white
 * background swallows: they get `df-pale`, darkened in the light theme only.
 */
export function isPale(hex: string): boolean {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex)
  if (!m) return false
  const n = parseInt(m[1], 16)
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(v => {
    const c = v / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.4
}

/** The class for a brand color: `df-pale` when white would swallow it (see styles/index.css) */
export const paleClass = (hex: string | undefined): string => (hex && isPale(hex) ? 'df-pale' : '')
