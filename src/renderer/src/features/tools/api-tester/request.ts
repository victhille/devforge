/**
 * The API tester's request, kept apart from the page: the query string as
 * rows (edited in the Params tab, written back into the URL), and the headers
 * actually sent (the ones ticked, plus the Auth tab's).
 */

export interface Row { key: string; value: string; on: boolean }
export type AuthKind = 'none' | 'bearer' | 'basic'
export interface Auth { kind: AuthKind; token: string; user: string; password: string }

/** The URL's query as rows: « ?limite=2&tri=prix » → limite = 2, tri = prix */
export function queryRows(url: string): Row[] {
  const at = url.indexOf('?')
  if (at < 0) return []
  const query = url.slice(at + 1).split('#')[0]
  if (!query) return []
  return query.split('&').map(part => {
    const eq = part.indexOf('=')
    const decode = (s: string) => { try { return decodeURIComponent(s.replace(/\+/g, ' ')) } catch { return s } }
    return eq < 0 ? { key: decode(part), value: '', on: true } : { key: decode(part.slice(0, eq)), value: decode(part.slice(eq + 1)), on: true }
  })
}

/** The URL with these rows as its query (the empty keys left out), its #hash kept */
export function withQuery(url: string, rows: Row[]): string {
  const hashAt = url.indexOf('#')
  const hash = hashAt >= 0 ? url.slice(hashAt) : ''
  const base = url.slice(0, hashAt >= 0 ? hashAt : undefined).split('?')[0]
  const query = rows.filter(r => r.key).map(r => `${encodeURIComponent(r.key)}${r.value ? `=${encodeURIComponent(r.value)}` : ''}`).join('&')
  return `${base}${query ? `?${query}` : ''}${hash}`
}

/** The headers sent: the rows ticked, then Auth's unless an Authorization row is ticked */
export function headersToSend(rows: Row[], auth: Auth): Record<string, string> {
  const out = Object.fromEntries(rows.filter(r => r.on && r.key.trim()).map(r => [r.key.trim(), r.value]))
  const hasAuth = Object.keys(out).some(k => k.toLowerCase() === 'authorization')
  if (!hasAuth && auth.kind === 'bearer' && auth.token.trim()) out.Authorization = `Bearer ${auth.token.trim()}`
  if (!hasAuth && auth.kind === 'basic' && auth.user) {
    const bytes = new TextEncoder().encode(`${auth.user}:${auth.password}`)
    out.Authorization = `Basic ${btoa(String.fromCharCode(...bytes))}`
  }
  return out
}

/** « /api/produits?limite=2 » from a full URL: what the history shows */
export const pathOf = (url: string) => url.replace(/^[a-z][\w+.-]*:\/\/[^/?#]+/i, '') || '/'
