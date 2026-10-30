import type { McdColors } from '@shared/lib/mcd'

/** The theme's colors, for an MCD drawn as an image (export, thumbnails) */
export function mcdColors(): McdColors {
  const css = getComputedStyle(document.documentElement)
  const v = (name: string, fallback: string) => css.getPropertyValue(name).trim() || fallback
  return {
    canvas: v('--color-canvas', '#0D0F13'), card: v('--color-surface', '#161A21'), line: v('--color-fg-muted', '#8792A2'),
    entity: v('--syntax-keyword', '#C792EA'), text: v('--color-fg', '#E8ECF2'), muted: v('--color-fg-secondary', '#9AA4B2'),
    card11: v('--syntax-keyword', '#C792EA'), note: 'rgba(255,203,107,.16)', noteText: v('--color-fg', '#E8ECF2')
  }
}

export const svgUrl = (svg: string) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
