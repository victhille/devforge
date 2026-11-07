/**
 * v3.5 lot 4: the examples the tools load on demand. They only fill fields:
 * nothing here is saved, and the addresses use .invalid, a name that never
 * exists (RFC 2606), so nothing could be sent anywhere for real.
 */

export const JSON_EXAMPLE = '{"id":42,"name":"Ada Lovelace","roles":["admin","dev"],"active":true,"address":{"city":"Nancy","zip":"54000"},"lastLogin":null}'

export const BASE64_TEXT = 'Hello DevForge ✓'
export const BASE64_ENCODED = 'SGVsbG8gRGV2Rm9yZ2Ug4pyT'

const b64url = (value: unknown) =>
  btoa(String.fromCharCode(...new TextEncoder().encode(JSON.stringify(value)))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

/** A JWT shaped like a real one; its signature is a placeholder (the tool decodes, it never checks) */
export function jwtExample(): string {
  return [b64url({ alg: 'HS256', typ: 'JWT' }), b64url({ sub: '42', name: 'Ada Lovelace', role: 'admin', iat: 1793145600, exp: 1793232000 }), 'signature-example'].join('.')
}

export type RegexModel = 'email' | 'date' | 'url' | 'phone'

/** Ready-made patterns, each with a text it finds things in (and things it must not) */
export const REGEX_MODELS: Record<RegexModel, { pattern: string; flags: string; text: string }> = {
  email: { pattern: '[\\w.+-]+@[\\w-]+(\\.[\\w-]+)+', flags: 'g', text: 'Contact: ada@example.invalid, support+dev@devforge.invalid or not-an-email@' },
  date: { pattern: '\\b\\d{2}/\\d{2}/\\d{4}\\b', flags: 'g', text: 'Shipped on 28/10/2026, billed on 02/11/2026, ref 123/45/6789.' },
  url: { pattern: 'https?://[^\\s,]+', flags: 'g', text: 'Docs: https://docs.example.invalid/start, local: http://localhost:5173, not ftp://files.example.invalid' },
  phone: { pattern: '(\\+33\\s?|0)[1-9]([\\s.-]?\\d{2}){4}', flags: 'g', text: 'Call 06 12 34 56 78 or +33 1 23 45 67 89, not 12 34.' }
}

export const HASH_EXAMPLE = 'Hello DevForge'

export const URL_EXAMPLE = 'https://shop.example.invalid/search?q=caf%C3%A9%20cr%C3%A8me&page=2&tags=a&tags=b#results'

export const TIMESTAMP_EXAMPLES = ['1793145600', '1793145600000', '2026-10-28T09:00:00Z']

export const DIFF_EXAMPLE = {
  left: 'APP_NAME=shop\nAPP_ENV=local\nAPP_DEBUG=true\nDB_HOST=127.0.0.1\nDB_PORT=5432\nMAIL_HOST=localhost',
  right: 'APP_NAME=shop\nAPP_ENV=production\nAPP_DEBUG=false\nDB_HOST=db.example.invalid\nDB_PORT=5432\nCACHE_DRIVER=redis'
}

export const SNIPPET_EXAMPLE = {
  title: 'Lire du JSON avec un délai',
  language: 'TypeScript',
  tags: ['fetch', 'http'],
  code: `export async function getJson<T>(url: string, ms = 5000): Promise<T> {
  const res = await fetch(url, { signal: AbortSignal.timeout(ms) })
  if (!res.ok) throw new Error(\`HTTP \${res.status}\`)
  return res.json() as Promise<T>
}`
}

/** What a captured webhook looks like (Stripe's shape); never sent, never stored */
export const WEBHOOK_EXAMPLE = {
  method: 'POST',
  url: '/webhooks/stripe',
  headers: { 'content-type': 'application/json', 'stripe-signature': 't=1793145600,v1=example', 'user-agent': 'Stripe/1.0 (+https://stripe.com/docs/webhooks)' },
  body: JSON.stringify({ id: 'evt_example', type: 'checkout.session.completed', data: { object: { id: 'cs_example', amount_total: 4200, currency: 'eur', customer_email: 'ada@example.invalid' } } }, null, 2)
}

/** Where a replay would go in the example: an address that never answers */
export const WEBHOOK_EXAMPLE_TARGET = 'https://app.example.invalid/webhooks/stripe'
