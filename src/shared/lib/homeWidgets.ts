/** Widgets the Home page can show */
export const WIDGET_IDS = ['active-project', 'docker', 'vps', 'git', 'ports', 'activity', 'health', 'services', 'backups', 'n8n', 'vpn', 'commits'] as const
export type WidgetId = (typeof WIDGET_IDS)[number]

export interface HomeWidget {
  id: WidgetId
  /** 'full' spans the whole width */
  size: 'half' | 'full'
}

/** The Home page of v2.0, until the user composes their own */
export const DEFAULT_WIDGETS: HomeWidget[] = [
  { id: 'active-project', size: 'full' },
  { id: 'docker', size: 'half' },
  { id: 'vps', size: 'half' },
  { id: 'git', size: 'half' },
  { id: 'ports', size: 'half' },
  { id: 'activity', size: 'full' }
]

/** Where a widget sits in the home page's grid: its column (or both), its first row and how many rows */
export interface MasonryPlace { column: 1 | 2 | 'both'; row: number; span: number }

/**
 * Masonry on a grid of `unit`-pixel rows: each half widget goes, in order, to
 * the column that is shorter so far (left on a tie), so short cards leave no
 * hole; a full widget starts below both columns and spans them. A height not
 * measured yet counts as `guess`; `gap` is the space below each widget.
 */
export function masonryPlaces(sizes: HomeWidget['size'][], heights: (number | undefined)[], gap = 16, unit = 4, guess = 200): MasonryPlace[] {
  const top = [1, 1]
  return sizes.map((size, i) => {
    const span = Math.max(1, Math.ceil(((heights[i] ?? guess) + gap) / unit))
    if (size === 'full') {
      const row = Math.max(top[0], top[1])
      top[0] = top[1] = row + span
      return { column: 'both', row, span }
    }
    const c = top[1] < top[0] ? 1 : 0
    const row = top[c]
    top[c] += span
    return { column: c === 0 ? 1 : 2, row, span }
  })
}

/** Known widgets only, each once, valid sizes */
export function cleanWidgets(list: unknown): HomeWidget[] {
  if (!Array.isArray(list)) return DEFAULT_WIDGETS.map(w => ({ ...w }))
  const out: HomeWidget[] = []
  for (const w of list) {
    const id = (w as HomeWidget)?.id
    if (!(WIDGET_IDS as readonly string[]).includes(id) || out.some(x => x.id === id)) continue
    out.push({ id, size: (w as HomeWidget).size === 'full' ? 'full' : 'half' })
  }
  return out
}
