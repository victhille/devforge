/**
 * v3.5.3: just enough TOML to read dependency lists (pyproject.toml, Pipfile,
 * Cargo.toml) and lockfiles (poetry.lock, uv.lock, Cargo.lock): tables,
 * arrays of tables, strings, numbers, booleans, arrays (over several lines)
 * and inline tables. Anything else is skipped, never thrown on.
 */

export type TomlValue = string | number | boolean | TomlValue[] | { [key: string]: TomlValue }
export type TomlTable = { [key: string]: TomlValue }

export interface TomlDoc {
  /** "project", "tool.poetry.dependencies"… → its keys ("" for the top) */
  tables: Record<string, TomlTable>
  /** [[package]] → each entry, in order */
  arrays: Record<string, TomlTable[]>
}

class Reader {
  i = 0
  constructor(readonly s: string) {}
  skipSpace(lines: boolean) {
    for (;;) {
      const c = this.s[this.i]
      if (c === ' ' || c === '\t' || (lines && (c === '\n' || c === '\r'))) this.i++
      else if (lines && c === '#') { while (this.i < this.s.length && this.s[this.i] !== '\n') this.i++ }
      else return
    }
  }
  string(): string {
    const triple = this.s.startsWith('"""', this.i) || this.s.startsWith("'''", this.i)
    const q = this.s[this.i]
    if (triple) {
      const end = this.s.indexOf(q.repeat(3), this.i + 3)
      const out = this.s.slice(this.i + 3, end < 0 ? undefined : end).replace(/^\r?\n/, '')
      this.i = end < 0 ? this.s.length : end + 3
      return out
    }
    this.i++
    let out = ''
    while (this.i < this.s.length && this.s[this.i] !== q && this.s[this.i] !== '\n') {
      if (q === '"' && this.s[this.i] === '\\') {
        const n = this.s[this.i + 1]
        out += n === 'n' ? '\n' : n === 't' ? '\t' : n
        this.i += 2
      } else out += this.s[this.i++]
    }
    this.i++
    return out
  }
  key(): string {
    this.skipSpace(false)
    const c = this.s[this.i]
    if (c === '"' || c === "'") return this.string()
    const m = this.s.slice(this.i).match(/^[A-Za-z0-9_-]+/)
    this.i += m ? m[0].length : 1
    return m ? m[0] : ''
  }
  /** a.b."c" → ["a", "b", "c"] */
  dottedKey(): string[] {
    const parts = [this.key()]
    for (;;) {
      this.skipSpace(false)
      if (this.s[this.i] !== '.') return parts
      this.i++
      parts.push(this.key())
    }
  }
  value(): TomlValue {
    this.skipSpace(false)
    const c = this.s[this.i]
    if (c === '"' || c === "'") return this.string()
    if (c === '[') {
      this.i++
      const list: TomlValue[] = []
      for (;;) {
        this.skipSpace(true)
        if (this.s[this.i] === ']' || this.i >= this.s.length) { this.i++; return list }
        list.push(this.value())
        this.skipSpace(true)
        if (this.s[this.i] === ',') this.i++
      }
    }
    if (c === '{') {
      this.i++
      const table: TomlTable = {}
      for (;;) {
        this.skipSpace(true)
        if (this.s[this.i] === '}' || this.i >= this.s.length) { this.i++; return table }
        const path = this.dottedKey()
        this.skipSpace(false)
        if (this.s[this.i] === '=') this.i++
        setPath(table, path, this.value())
        this.skipSpace(true)
        if (this.s[this.i] === ',') this.i++
      }
    }
    const m = this.s.slice(this.i).match(/^[^\s,\]}#]+/)
    this.i += m ? m[0].length : 1
    const raw = m ? m[0] : ''
    if (raw === 'true' || raw === 'false') return raw === 'true'
    const n = Number(raw.replace(/_/g, ''))
    return raw !== '' && !Number.isNaN(n) ? n : raw
  }
}

function setPath(table: TomlTable, path: string[], value: TomlValue) {
  let t = table
  for (const k of path.slice(0, -1)) {
    if (typeof t[k] !== 'object' || Array.isArray(t[k])) t[k] = {}
    t = t[k] as TomlTable
  }
  t[path[path.length - 1]] = value
}

export function parseToml(text: string): TomlDoc {
  const doc: TomlDoc = { tables: { '': {} }, arrays: {} }
  const r = new Reader(text)
  let current = doc.tables['']
  while (r.i < r.s.length) {
    r.skipSpace(true)
    if (r.i >= r.s.length) break
    if (r.s[r.i] === '[') {
      const array = r.s[r.i + 1] === '['
      r.i += array ? 2 : 1
      const name = r.dottedKey().join('.')
      r.skipSpace(false)
      r.i += array ? 2 : 1
      if (array) {
        current = {}
        ;(doc.arrays[name] ??= []).push(current)
      } else current = doc.tables[name] ??= {}
    } else {
      const path = r.dottedKey()
      r.skipSpace(false)
      if (r.s[r.i] !== '=') { while (r.i < r.s.length && r.s[r.i] !== '\n') r.i++; continue }
      r.i++
      setPath(current, path, r.value())
    }
    // The rest of the line (a comment)
    r.skipSpace(false)
    if (r.s[r.i] === '#') while (r.i < r.s.length && r.s[r.i] !== '\n') r.i++
  }
  return doc
}
