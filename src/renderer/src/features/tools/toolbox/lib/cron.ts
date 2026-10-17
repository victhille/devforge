/**
 * Small 5-field cron parser: minute hour day-of-month month day-of-week.
 * Supports *, lists (1,2), ranges (1-5), steps (*\/15, 1-30/5), names (MON, JAN)
 * and macros (@hourly, @daily, @weekly, @monthly, @yearly).
 */

export interface CronField { values: number[]; any: boolean }
export interface CronExpr { minute: CronField; hour: CronField; dom: CronField; month: CronField; dow: CronField }

const MACROS: Record<string, string> = {
  '@yearly': '0 0 1 1 *', '@annually': '0 0 1 1 *', '@monthly': '0 0 1 * *',
  '@weekly': '0 0 * * 0', '@daily': '0 0 * * *', '@midnight': '0 0 * * *', '@hourly': '0 * * * *'
}
const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']
const DAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']

function parseField(raw: string, min: number, max: number, names?: string[]): CronField {
  const values = new Set<number>()
  const toNum = (s: string) => {
    const idx = names?.indexOf(s.toUpperCase()) ?? -1
    const n = idx >= 0 ? idx + (names === MONTHS ? 1 : 0) : Number(s)
    if (!Number.isInteger(n)) throw new Error(`Invalid value "${s}"`)
    return n
  }
  for (const part of raw.split(',')) {
    const [range, stepRaw] = part.split('/')
    const step = stepRaw === undefined ? 1 : Number(stepRaw)
    if (!Number.isInteger(step) || step < 1) throw new Error(`Invalid step "${part}"`)
    let lo: number, hi: number
    if (range === '*') { lo = min; hi = max }
    else if (range.includes('-')) { const [a, b] = range.split('-'); lo = toNum(a); hi = toNum(b) }
    else { lo = toNum(range); hi = stepRaw === undefined ? lo : max }
    // 7 = Sunday too
    if (names === DAYS) { if (lo === 7) lo = 0; if (hi === 7 && lo !== 0) hi = 6 }
    if (lo < min || hi > max || lo > hi) throw new Error(`Out of range "${part}" (${min}-${max})`)
    for (let v = lo; v <= hi; v += step) values.add(v)
  }
  return { values: [...values].sort((a, b) => a - b), any: raw === '*' }
}

export function parseCron(expr: string): CronExpr {
  const src = MACROS[expr.trim().toLowerCase()] ?? expr.trim()
  const f = src.split(/\s+/)
  if (f.length !== 5) throw new Error('Expected 5 fields: minute hour day month weekday')
  return {
    minute: parseField(f[0], 0, 59),
    hour:   parseField(f[1], 0, 23),
    dom:    parseField(f[2], 1, 31),
    month:  parseField(f[3], 1, 12, MONTHS),
    dow:    parseField(f[4], 0, 7, DAYS)
  }
}

function matches(c: CronExpr, d: Date): boolean {
  if (!c.minute.values.includes(d.getMinutes()) || !c.hour.values.includes(d.getHours())) return false
  if (!c.month.values.includes(d.getMonth() + 1)) return false
  const dom = c.dom.values.includes(d.getDate())
  const dow = c.dow.values.includes(d.getDay())
  // Standard cron: when both day fields are restricted, either one matching is enough
  if (!c.dom.any && !c.dow.any) return dom || dow
  return (c.dom.any || dom) && (c.dow.any || dow)
}

/** Next `count` run dates after `from` (searches up to ~4 years) */
export function nextRuns(c: CronExpr, count = 5, from = new Date()): Date[] {
  const out: Date[] = []
  const d = new Date(from)
  d.setSeconds(0, 0)
  d.setMinutes(d.getMinutes() + 1)
  for (let i = 0; i < 4 * 366 * 24 * 60 && out.length < count; i++) {
    if (!c.month.values.includes(d.getMonth() + 1)) { d.setMonth(d.getMonth() + 1, 1); d.setHours(0, 0, 0, 0); continue }
    if (!c.hour.values.includes(d.getHours())) { d.setHours(d.getHours() + 1, 0, 0, 0); continue }
    if (matches(c, d)) out.push(new Date(d))
    d.setMinutes(d.getMinutes() + 1)
  }
  return out
}

// ─── Human description ────────────────────────────────────────────────────────

type Lang = 'en' | 'fr'
const T = {
  en: { every: 'every', minute: 'minute', minutes: 'minutes', hour: 'hour', at: 'at', on: 'on', of: 'of', in: 'in', day: 'day', and: 'and', past: 'past the hour', everyMinute: 'Every minute', from: 'from', to: 'to',
        days: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
        months: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'] },
  fr: { every: 'toutes les', minute: 'minute', minutes: 'minutes', hour: 'heure', at: 'à', on: 'le', of: 'du mois', in: 'en', day: 'jour', and: 'et', past: 'de chaque heure', everyMinute: 'Toutes les minutes', from: 'de', to: 'à',
        days: ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'],
        months: ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'] }
}

const pad = (n: number) => String(n).padStart(2, '0')

function list(items: string[], l: Lang): string {
  return items.length <= 1 ? items.join('') : `${items.slice(0, -1).join(', ')} ${T[l].and} ${items[items.length - 1]}`
}

/** Constant step over the full range? e.g. 0,15,30,45 → 15 */
function stepOf(f: CronField, min: number, max: number): number | null {
  const v = f.values
  if (v.length < 2 || v[0] !== min) return null
  const s = v[1] - v[0]
  return v.every((x, i) => x === min + i * s) && v[v.length - 1] + s > max ? s : null
}

export function describeCron(c: CronExpr, l: Lang): string {
  const t = T[l]
  const parts: string[] = []

  const minStep = stepOf(c.minute, 0, 59)
  if (c.minute.any && c.hour.any) parts.push(t.everyMinute)
  else if (minStep && c.hour.any) parts.push(l === 'fr' ? `Toutes les ${minStep} minutes` : `Every ${minStep} minutes`)
  else if (c.hour.any) parts.push(l === 'fr' ? `À la minute ${list(c.minute.values.map(String), l)} ${t.past}` : `At minute ${list(c.minute.values.map(String), l)} ${t.past}`)
  else if (c.minute.values.length === 1 && c.hour.values.length <= 6) {
    parts.push(`${l === 'fr' ? 'À' : 'At'} ${list(c.hour.values.map(h => `${pad(h)}:${pad(c.minute.values[0])}`), l)}`)
  } else if (c.minute.values.length === 1 && stepOf(c.hour, 0, 23)) {
    const hStep = stepOf(c.hour, 0, 23)
    parts.push(l === 'fr' ? `Toutes les ${hStep} heures, à :${pad(c.minute.values[0])}` : `Every ${hStep} hours, at :${pad(c.minute.values[0])}`)
  } else {
    const hStep = stepOf(c.hour, 0, 23)
    parts.push(`${minStep ? (l === 'fr' ? `Toutes les ${minStep} min` : `Every ${minStep} min`) : `${l === 'fr' ? 'À la minute' : 'At minute'} ${list(c.minute.values.map(String), l)}`}, ${
      hStep ? (l === 'fr' ? `toutes les ${hStep} h` : `every ${hStep} hours`) : `${l === 'fr' ? 'pendant les heures' : 'during hours'} ${list(c.hour.values.map(String), l)}`}`)
  }

  const dowText = c.dow.any ? null : c.dow.values.join() === '1,2,3,4,5'
    ? (l === 'fr' ? 'du lundi au vendredi' : 'Monday to Friday')
    : `${l === 'fr' ? 'le' : 'on'} ${list(c.dow.values.map(x => t.days[x]), l)}`
  const domText = c.dom.any ? null : l === 'fr'
    ? `le ${list(c.dom.values.map(String), l)} du mois`
    : `on day ${list(c.dom.values.map(String), l)} of the month`
  // Cron runs when EITHER day field matches if both are restricted
  if (dowText && domText) parts.push(`${dowText} ${l === 'fr' ? 'ou' : 'or'} ${domText}`)
  else if (dowText || domText) parts.push((dowText ?? domText)!)
  if (!c.month.any) parts.push(`${t.in} ${list(c.month.values.map(m => t.months[m - 1]), l)}`)

  return parts.join(', ')
}
