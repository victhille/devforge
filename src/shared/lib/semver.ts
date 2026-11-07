/**
 * Minimal semver range check, enough for engines/.nvmrc/composer constraints:
 * exact (18, 18.2, v18.2.1, 18.x), comparators (>=18 <21), caret (^18.2),
 * tilde (~18.2), OR (18 || 20), wildcards (*, x). Returns null when the
 * range can't be understood (e.g. "lts/*"), so callers can show "unknown".
 */

type Version = [number, number, number]

export function parseVersion(v: string): Version | null {
  const m = v.trim().replace(/^[v=]/i, '').match(/^(\d+)(?:\.(\d+))?(?:\.(\d+))?/)
  return m ? [Number(m[1]), Number(m[2] ?? 0), Number(m[3] ?? 0)] : null
}

function cmp(a: Version, b: Version): number {
  return a[0] - b[0] || a[1] - b[1] || a[2] - b[2]
}

/** "18" → [18.0.0, 19.0.0), "18.2" → [18.2.0, 18.3.0) */
function partialRange(raw: string): [Version, Version] | null {
  const parts = raw.replace(/^[v=]/i, '').split('.').filter(p => p !== '' && !/^[x*]$/i.test(p))
  if (parts.some(p => !/^\d+$/.test(p))) return null
  const n = parts.map(Number)
  if (n.length === 0) return [[0, 0, 0], [Infinity, 0, 0]]
  if (n.length === 1) return [[n[0], 0, 0], [n[0] + 1, 0, 0]]
  if (n.length === 2) return [[n[0], n[1], 0], [n[0], n[1] + 1, 0]]
  return [[n[0], n[1], n[2]], [n[0], n[1], n[2] + 1]]
}

function satisfiesComparator(v: Version, comp: string): boolean | null {
  const m = comp.match(/^(>=|<=|>|<|\^|~|=)?\s*(.+)$/)
  if (!m) return null
  const [, op = '', rest] = m
  const target = parseVersion(rest)

  switch (op) {
    case '>=': return target ? cmp(v, target) >= 0 : null
    case '>':  return target ? cmp(v, target) > 0 : null
    case '<=': return target ? cmp(v, target) <= 0 : null
    case '<':  return target ? cmp(v, target) < 0 : null
    case '^': {
      if (!target) return null
      const upper: Version = target[0] > 0 ? [target[0] + 1, 0, 0] : target[1] > 0 ? [0, target[1] + 1, 0] : [0, 0, target[2] + 1]
      return cmp(v, target) >= 0 && cmp(v, upper) < 0
    }
    case '~': {
      if (!target) return null
      const hasMinor = /^\d+\.\d+/.test(rest.replace(/^v/, ''))
      const upper: Version = hasMinor ? [target[0], target[1] + 1, 0] : [target[0] + 1, 0, 0]
      return cmp(v, target) >= 0 && cmp(v, upper) < 0
    }
    default: {
      const r = partialRange(rest)
      return r ? cmp(v, r[0]) >= 0 && cmp(v, r[1]) < 0 : null
    }
  }
}

export function satisfies(version: string, range: string): boolean | null {
  const v = parseVersion(version)
  if (!v) return null
  const alternatives = range.split('||').map(s => s.trim()).filter(Boolean)
  if (alternatives.length === 0) return null

  let unknown = false
  for (const alt of alternatives) {
    // "1.2 - 2.3" hyphen ranges
    const hyphen = alt.match(/^(\S+)\s+-\s+(\S+)$/)
    const comps = hyphen ? [`>=${hyphen[1]}`, `<=${hyphen[2]}`] : alt.replace(/([<>=^~])\s+/g, '$1').split(/[\s,]+/).filter(Boolean)
    const results = comps.map(c => satisfiesComparator(v, c))
    if (results.includes(null)) { unknown = true; continue }
    if (results.every(Boolean)) return true
  }
  return unknown ? null : false
}
