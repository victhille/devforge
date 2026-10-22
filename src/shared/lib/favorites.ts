/** Pages pinned under Home until the user picks their own (Home itself is always first) */
export const DEFAULT_FAVORITES = ['/projects', '/docker', '/database', '/api-tester']

/** At most this many: the menu stays short */
export const MAX_FAVORITES = 10

/** Page paths only ("/vpn"), no duplicate, capped */
export function cleanFavorites(list: unknown): string[] {
  if (!Array.isArray(list)) return [...DEFAULT_FAVORITES]
  const out: string[] = []
  for (const p of list) if (typeof p === 'string' && /^\/[a-z0-9-]+$/.test(p) && !out.includes(p)) out.push(p)
  return out.slice(0, MAX_FAVORITES)
}
