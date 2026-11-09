import type { DbTableRef, DbType } from '../types'
import { quoteColumn, quoteIdent, sqlString } from './sqlQuote'

/**
 * Searching a whole database (the Database page's Search tab): the SQL of
 * one table's search on each engine, and what matched in a value (to light it).
 * Every column is read as text, so numbers, dates and JSON are found too.
 */

export type DbSearchMode = 'contains' | 'any' | 'all' | 'exact' | 'regex'

export const DB_SEARCH_MODES: DbSearchMode[] = ['contains', 'any', 'all', 'exact', 'regex']

export interface DbSearchOptions {
  term: string
  mode: DbSearchMode
  caseSensitive: boolean
  /** Only the columns of that name (case ignored); empty: every column */
  column?: string
  /** Rows brought back per table (all are counted) */
  limit: number
}

/** What is looked for, without how many rows come back */
export type DbSearchCriteria = Omit<DbSearchOptions, 'limit'>

export interface DbSearchResult {
  columns: string[]
  rows: unknown[][]
  /** Every matching row of the table */
  total: number
  durationMs: number
  /** The table has no column of that name: nothing was asked */
  skipped?: boolean
  error?: string
}

export const DB_SEARCH_MAX_ROWS = 200
export const DB_SEARCH_MAX_TERM = 500
/** How much of a value a JavaScript expression reads (SQLite, highlighting) */
export const REGEX_MAX_VALUE = 10_000

/** The words of « any » and « all »: split on spaces, a phrase in quotes kept whole ("…", « … » or “…”) */
export function searchWords(term: string, mode: DbSearchMode): string[] {
  if (mode !== 'any' && mode !== 'all') return term ? [term] : []
  const words: string[] = []
  for (const m of term.matchAll(/"([^"]+)"|«([^»]+)»|“([^”]+)”|(\S+)/g)) {
    const w = (m[1] ?? m[2] ?? m[3] ?? m[4]).trim()
    if (w && !words.includes(w)) words.push(w)
  }
  return words
}

/** A regular expression's leading (?i) or (?-i), as MySQL and MariaDB read it */
export function regexFlags(pattern: string): { source: string; ignoreCase: boolean | null } {
  const m = /^\(\?(-?)i\)/.exec(pattern)
  return m ? { source: pattern.slice(m[0].length), ignoreCase: m[1] !== '-' } : { source: pattern, ignoreCase: null }
}

/** The repetition at i, if any: its fewest and most counts (Infinity: no limit) */
function repetition(source: string, i: number): [number, number] | null {
  if (source[i] === '*') return [0, Infinity]
  if (source[i] === '+') return [1, Infinity]
  const m = source[i] === '{' ? /^\{(\d+)(,(\d*))?\}/.exec(source.slice(i)) : null
  if (!m) return null
  const min = Number(m[1])
  return [min, m[2] === undefined ? min : m[3] === '' ? Infinity : Number(m[3])]
}
/** Inside a group: a repetition that can match one text in several ways (*, +, {1,9}… but not {3}) */
const ambiguous = (source: string, i: number) => { const r = repetition(source, i); return !!r && r[1] > r[0] && r[1] >= 2 }
/** After a group: any repetition of it (*, +, {2}, {1,9}…) */
const repeated = (source: string, i: number) => { const r = repetition(source, i); return !!r && r[1] >= 2 }

/**
 * A repeated group that holds a repetition itself, like (a+)+, (\w+\s?)*,
 * (a{1,50})* or (a+){8}: on a value that almost matches, JavaScript (SQLite's
 * REGEXP during a search, the highlighting everywhere) may take hours, with no
 * way to stop it. A heuristic: overlapping alternatives such as (a|a)*, or
 * a*a*a*x on a long value, are not caught.
 */
export function riskyRegex(source: string): boolean {
  const groups: boolean[] = []
  for (let i = 0; i < source.length; i++) {
    const c = source[i]
    if (c === '\\') { i++; continue }
    if (c === '[') {
      // A class: its * and + are plain characters
      i++
      if (source[i] === '^') i++
      if (source[i] === ']') i++
      while (i < source.length && source[i] !== ']') { if (source[i] === '\\') i++; i++ }
      continue
    }
    if (c === '(') { groups.push(false); continue }
    if (c === ')') {
      const inner = groups.pop()
      if (inner && repeated(source, i + 1)) return true
      if (inner && groups.length) groups[groups.length - 1] = true
      continue
    }
    if (groups.length && ambiguous(source, i)) groups[groups.length - 1] = true
  }
  return false
}

/** What stops the search before it starts: no term, too long, a regular expression that does not compile or could hang */
export function searchProblem(o: Pick<DbSearchOptions, 'term' | 'mode'>): 'empty' | 'tooLong' | 'risky' | { regex: string } | null {
  if (!o.term.trim()) return 'empty'
  if (o.term.length > DB_SEARCH_MAX_TERM) return 'tooLong'
  if (o.mode === 'regex') {
    try { new RegExp(regexFlags(o.term).source) } catch (err) { return { regex: (err as Error).message.replace(/^Invalid regular expression: /, '') } }
    if (riskyRegex(regexFlags(o.term).source)) return 'risky'
  }
  if (!searchWords(o.term, o.mode).length) return 'empty'
  return null
}

/** The columns searched: all, or the ones of that name */
export function searchedColumns(columns: string[], column?: string): string[] {
  const only = column?.trim().toLowerCase()
  return only ? columns.filter(c => c.toLowerCase() === only) : columns
}

/**
 * The WHERE of one table's search. `param` gives what stands for a value:
 * a placeholder (the query run) or the value itself (the query shown).
 * On SQLite, df_lower and REGEXP are DevForge's own (Unicode, JavaScript expressions).
 */
export function searchWhere(db: DbType, columns: string[], o: DbSearchCriteria, param: (value: string) => string): string {
  const text = (c: string) => `CAST(${quoteColumn(db, c)} AS ${db === 'mysql' ? 'CHAR' : 'TEXT'})`
  // Case kept on MySQL: compared as bytes (its collations ignore case, and often accents)
  const bin = (x: string) => (db === 'mysql' ? `CAST(${x} AS BINARY)` : x)
  const lower = (x: string) => (db === 'sqlite' ? `df_lower(${x})` : `LOWER(${x})`)

  const test = (c: string, value: string): string => {
    const v = text(c)
    switch (o.mode) {
      case 'exact':
        return o.caseSensitive ? `${bin(v)} = ${bin(param(value))}` : `${lower(v)} = ${lower(param(value))}`
      case 'regex':
        if (db === 'postgres') return `${v} ${o.caseSensitive ? '~' : '~*'} ${param(value)}`
        // MySQL, MariaDB and DevForge's SQLite read the case from a leading (?i) or (?-i)
        return `${v} REGEXP ${param(`${o.caseSensitive ? '(?-i)' : '(?i)'}${regexFlags(value).source}`)}`
      default: {
        const hay = o.caseSensitive ? bin(v) : lower(v)
        const needle = o.caseSensitive ? bin(param(value)) : lower(param(value))
        return db === 'mysql' ? `LOCATE(${needle}, ${hay}) > 0` : db === 'postgres' ? `strpos(${hay}, ${needle}) > 0` : `instr(${hay}, ${needle}) > 0`
      }
    }
  }
  const anywhere = (value: string) => {
    const tests = columns.map(c => test(c, value))
    return tests.length === 1 ? tests[0] : `(${tests.join(' OR ')})`
  }
  const words = searchWords(o.term, o.mode)
  if (words.length === 1) return anywhere(words[0])
  return words.map(anywhere).join(o.mode === 'all' ? ' AND ' : ' OR ')
}

export interface SearchStatement { sql: string; params: string[] }

/** One table's search, run with parameters: its rows (up to the limit), then their count */
export function searchStatements(db: DbType, table: DbTableRef, columns: string[], o: DbSearchOptions): { rows: SearchStatement; count: SearchStatement } {
  const make = (head: string, tail: string): SearchStatement => {
    const params: string[] = []
    const where = searchWhere(db, columns, o, v => { params.push(v); return db === 'postgres' ? `$${params.length}` : '?' })
    return { sql: `${head} FROM ${quoteIdent(db, table)} WHERE ${where}${tail}`, params }
  }
  const limit = Math.min(Math.max(Math.floor(o.limit) || 50, 1), DB_SEARCH_MAX_ROWS)
  return { rows: make('SELECT *', ` LIMIT ${limit}`), count: make('SELECT COUNT(*) AS n', '') }
}

/** The query as it reads, values in place: for the SQL tab (every matching row) */
export function searchSql(db: DbType, table: DbTableRef, columns: string[], o: DbSearchCriteria): string {
  return `SELECT * FROM ${quoteIdent(db, table)}\nWHERE ${searchWhere(db, columns, o, v => sqlString(db, v))};`
}

/** Where the search matched in one value: [start, end) ranges, merged */
export function matchRanges(value: string, o: Pick<DbSearchOptions, 'term' | 'mode' | 'caseSensitive'>): [number, number][] {
  if (!value) return []
  if (o.mode === 'exact') {
    const same = o.caseSensitive ? value === o.term : value.toLowerCase() === o.term.toLowerCase()
    return same ? [[0, value.length]] : []
  }
  const ranges: [number, number][] = []
  if (o.mode === 'regex') {
    let re: RegExp
    const source = regexFlags(o.term).source
    if (riskyRegex(source)) return []
    try { re = new RegExp(source, o.caseSensitive ? 'g' : 'gi') } catch { return [] }
    // In the window: the start of the value is enough to light (a cell shows ~90 characters)
    for (const m of value.slice(0, 2_000).matchAll(re)) {
      const at = m.index ?? 0
      if (m[0].length) ranges.push([at, at + m[0].length])
      if (ranges.length > 50) break
    }
  } else {
    const hay = o.caseSensitive ? value : value.toLowerCase()
    for (const w of searchWords(o.term, o.mode)) {
      const needle = o.caseSensitive ? w : w.toLowerCase()
      for (let i = hay.indexOf(needle); i !== -1 && ranges.length <= 50; i = hay.indexOf(needle, i + needle.length)) ranges.push([i, i + needle.length])
    }
  }
  ranges.sort((a, b) => a[0] - b[0])
  const merged: [number, number][] = []
  for (const r of ranges) {
    const last = merged[merged.length - 1]
    if (last && r[0] <= last[1]) last[1] = Math.max(last[1], r[1])
    else merged.push([r[0], r[1]])
  }
  return merged
}

/** A long value cut around its first match, the ranges moved with it */
export function snippet(value: string, ranges: [number, number][], max = 90): { text: string; ranges: [number, number][] } {
  if (value.length <= max) return { text: value, ranges }
  const first = ranges[0]?.[0] ?? 0
  const start = Math.max(0, Math.min(first - Math.floor(max / 3), value.length - max))
  const end = Math.min(value.length, start + max)
  const lead = start > 0 ? '…' : ''
  const text = `${lead}${value.slice(start, end)}${end < value.length ? '…' : ''}`
  const shift = lead.length - start
  const moved = ranges
    .filter(([a, b]) => b > start && a < end)
    .map(([a, b]): [number, number] => [Math.max(a, start) + shift, Math.min(b, end) + shift])
  return { text, ranges: moved }
}
