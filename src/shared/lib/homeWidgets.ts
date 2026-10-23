/** Widgets the Home page can show */
export const WIDGET_IDS = ['active-project', 'docker', 'vps', 'git', 'ports', 'activity', 'health', 'services', 'backups', 'n8n', 'vpn'] as const
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
