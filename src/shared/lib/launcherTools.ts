/**
 * Answers the launcher computes as you type: a calculation, a timestamp, a
 * date, base64, a color. Enter copies the value. No eval: a small parser.
 */

export type AnswerKind = 'calc' | 'timestamp' | 'date' | 'base64' | 'color'

export interface QuickAnswer {
  kind: AnswerKind
  /** What Enter copies */
  value: string
  /** Shown under it, e.g. "12 × 4,5" or "UTC" */
  detail: string
}

// ─── Calculator ───────────────────────────────────────────────────────────────

/** + − × ÷ % ^, parentheses, decimals with a dot or a comma */
export function calculate(input: string): number | null {
  const src = input.replace(/\s+/g, '').replace(/×/g, '*').replace(/÷/g, '/').replace(/(\d),(\d)/g, '$1.$2')
  if (!/^[\d.+\-*/%^()]+$/.test(src) || !/\d/.test(src)) return null
  let i = 0
  const peek = () => src[i]
  const number = (): number => {
    const m = /^\d*\.?\d+(e[+-]?\d+)?/i.exec(src.slice(i)) ?? /^\d+\.?/.exec(src.slice(i))
    if (!m) throw new Error('number')
    i += m[0].length
    return Number(m[0])
  }
  const factor = (): number => {
    if (peek() === '-') { i++; return -factor() }
    if (peek() === '+') { i++; return factor() }
    if (peek() === '(') {
      i++
      const v = expr()
      if (peek() !== ')') throw new Error('paren')
      i++
      return v
    }
    return number()
  }
  const power = (): number => {
    const base = factor()
    if (peek() === '^') { i++; return base ** power() }
    return base
  }
  const term = (): number => {
    let v = power()
    while (peek() === '*' || peek() === '/' || peek() === '%') {
      const op = src[i++]
      const r = power()
      v = op === '*' ? v * r : op === '/' ? v / r : v % r
    }
    return v
  }
  const expr = (): number => {
    let v = term()
    while (peek() === '+' || peek() === '-') {
      const op = src[i++]
      const r = term()
      v = op === '+' ? v + r : v - r
    }
    return v
  }
  try {
    const v = expr()
    return i === src.length && Number.isFinite(v) ? v : null
  } catch { return null }
}

/** 12 decimals at most, no float noise (0.1 + 0.2 → 0.3) */
export const formatNumber = (n: number) => String(Number(n.toPrecision(12)))

// ─── Dates ────────────────────────────────────────────────────────────────────

const pad = (n: number) => String(n).padStart(2, '0')
const local = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`

function timeAnswers(q: string, now: Date): QuickAnswer[] {
  if (/^(now|maintenant|timestamp)$/i.test(q)) {
    return [{ kind: 'timestamp', value: String(Math.floor(now.getTime() / 1000)), detail: local(now) }]
  }
  // 10 digits: seconds, 13: milliseconds (2001 → 2286)
  if (/^\d{10}$|^\d{13}$/.test(q)) {
    const d = new Date(q.length === 10 ? Number(q) * 1000 : Number(q))
    return [{ kind: 'date', value: local(d), detail: d.toISOString() }]
  }
  if (/^\d{4}-\d{2}-\d{2}([ T]\d{2}:\d{2}(:\d{2})?)?$/.test(q)) {
    const d = new Date(q.replace(' ', 'T'))
    if (!Number.isNaN(d.getTime())) return [{ kind: 'timestamp', value: String(Math.floor(d.getTime() / 1000)), detail: d.toISOString() }]
  }
  return []
}

// ─── Base64 ───────────────────────────────────────────────────────────────────

const toB64 = (s: string) => btoa(String.fromCharCode(...new TextEncoder().encode(s)))
function fromB64(s: string): string | null {
  try {
    const bytes = Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0))
    const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes)
    // Only readable text counts as a decoding
    return /^[\P{C}\n\r\t]*$/u.test(text) ? text : null
  } catch { return null }
}

function base64Answers(q: string): QuickAnswer[] {
  const enc = q.match(/^(?:b64|base64)\s+([\s\S]+)$/i)
  if (enc) return [{ kind: 'base64', value: toB64(enc[1]), detail: 'base64' }]
  const dec = q.match(/^(?:unb64|b64d|base64d)\s+(\S+)$/i)
  const candidate = dec ? dec[1] : /^[A-Za-z0-9+/_-]{8,}={0,2}$/.test(q) && q.length % 4 === 0 ? q : null
  if (!candidate) return []
  const text = fromB64(candidate)
  return text ? [{ kind: 'base64', value: text, detail: 'base64 → texte' }] : []
}

// ─── Colors ───────────────────────────────────────────────────────────────────

function rgbToHsl(r: number, g: number, b: number): string {
  const [rr, gg, bb] = [r / 255, g / 255, b / 255]
  const max = Math.max(rr, gg, bb), min = Math.min(rr, gg, bb), l = (max + min) / 2
  let h = 0, s = 0
  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    h = max === rr ? (gg - bb) / d + (gg < bb ? 6 : 0) : max === gg ? (bb - rr) / d + 2 : (rr - gg) / d + 4
    h *= 60
  }
  return `hsl(${Math.round(h)}, ${Math.round(s * 100)}%, ${Math.round(l * 100)}%)`
}

function colorAnswers(q: string): QuickAnswer[] {
  const hex = q.match(/^#?([0-9a-f]{3}|[0-9a-f]{6})$/i)
  if (hex && (q.startsWith('#') || /[a-f]/i.test(hex[1]))) {
    const h = hex[1].length === 3 ? hex[1].split('').map(c => c + c).join('') : hex[1]
    const [r, g, b] = [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16))
    return [
      { kind: 'color', value: `rgb(${r}, ${g}, ${b})`, detail: `#${h.toUpperCase()}` },
      { kind: 'color', value: rgbToHsl(r, g, b), detail: `#${h.toUpperCase()}` }
    ]
  }
  const rgb = q.match(/^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*(?:,\s*[\d.]+\s*)?\)$/i)
  if (rgb) {
    const [r, g, b] = rgb.slice(1, 4).map(Number)
    if ([r, g, b].some(v => v > 255)) return []
    const value = '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('').toUpperCase()
    return [{ kind: 'color', value, detail: rgbToHsl(r, g, b) }]
  }
  return []
}

/** Everything the query can be turned into, best first */
export function quickAnswers(query: string, now = new Date()): QuickAnswer[] {
  const q = query.trim()
  if (!q) return []
  const out: QuickAnswer[] = [...timeAnswers(q, now), ...colorAnswers(q), ...base64Answers(q)]
  // A bare number is not a calculation
  if (/[+\-*/%^×÷]/.test(q.replace(/^-/, '')) && !/^\d{4}-\d{2}-\d{2}/.test(q)) {
    const v = calculate(q)
    if (v !== null) out.unshift({ kind: 'calc', value: formatNumber(v), detail: q })
  }
  return out
}
