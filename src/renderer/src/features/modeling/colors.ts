import type { McdColors } from '@shared/lib/mcd'
import type { SvgColors } from '@shared/lib/schemaLayout'
import type { DiagramColors } from '@shared/lib/uml'

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

/** The theme's colors for an MPD drawn as an image: the database schema's */
export function schemaColors(): SvgColors {
  const css = getComputedStyle(document.documentElement)
  const v = (name: string) => css.getPropertyValue(name).trim() || '#888'
  return {
    canvas: v('--color-canvas'), card: v('--color-surface'), header: v('--color-elevated'), line: v('--color-line'),
    text: v('--color-fg'), muted: v('--color-fg-muted'), key: v('--color-warning'), link: v('--color-accent')
  }
}

/** A diagram's colours: the theme's CSS variables on the canvas, their values in a picture */
export const LIVE_DIAGRAM: DiagramColors = {
  canvas: 'var(--color-canvas)', card: 'var(--color-surface)', line: 'var(--color-fg-muted)', text: 'var(--color-fg)', muted: 'var(--color-fg-muted)',
  accent: 'var(--syntax-keyword)', actor: 'var(--syntax-attr)', system: 'var(--color-accent)', note: 'rgba(255,203,107,.16)', noteText: 'var(--color-fg)'
}
export function diagramColors(): DiagramColors {
  const css = getComputedStyle(document.documentElement)
  const resolve = (v: string) => v.replace(/var\((--[\w-]+)\)/g, (_, name: string) => css.getPropertyValue(name).trim() || '#888')
  return Object.fromEntries(Object.entries(LIVE_DIAGRAM).map(([k, v]) => [k, resolve(v)])) as unknown as DiagramColors
}

export const svgUrl =(svg: string) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`

/** An SVG saved where the user picks, as itself or as a PNG twice its size; null when cancelled */
export async function saveDrawing(svg: string, name: string, ext: 'png' | 'svg'): Promise<string | null> {
  let content = svg
  if (ext === 'png') {
    const img = new Image()
    img.src = svgUrl(svg)
    await img.decode()
    const canvas = document.createElement('canvas')
    canvas.width = img.width * 2
    canvas.height = img.height * 2
    const ctx = canvas.getContext('2d')!
    ctx.scale(2, 2)
    ctx.drawImage(img, 0, 0)
    content = canvas.toDataURL('image/png')
  }
  return window.devforge.db.saveImage(name, content, ext)
}
