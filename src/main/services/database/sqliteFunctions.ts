import type { Database as SqlJsDb } from 'sql.js'
import { REGEX_MAX_VALUE, regexFlags, riskyRegex } from '@shared/lib/dbSearch'
import { loadSettings } from '../settings/settingsService'

/**
 * What SQLite lacks for the search. df_lower: a LOWER that knows accented
 * letters (its own name: an index on lower(…) must keep SQLite's).
 * REGEXP is real only while a search runs (withRegexp): a view or a query that
 * calls it otherwise gets an error, so a database file cannot make the app run
 * a regular expression of its own as it opens.
 */
export function sqliteFunctions(db: SqlJsDb): void {
  db.create_function('df_lower', (v: unknown) => (typeof v === 'string' ? v.toLowerCase() : typeof v === 'number' ? String(v) : null))
  regexpOff(db)
}

const fr = () => loadSettings().language === 'fr'

function regexpOff(db: SqlJsDb): void {
  db.create_function('regexp', () => {
    throw new Error(fr() ? 'REGEXP ne sert qu’à l’onglet Rechercher de DevForge.' : 'REGEXP only works in DevForge’s Search tab.')
  })
}

/** The expressions of the last searches, compiled once */
const compiled = new Map<string, RegExp>()

/** JavaScript expressions; a leading (?i) or (?-i) sets the case, as on MySQL. One that could hang is refused */
function regexp(pattern: unknown, value: unknown): number {
  if (value === null || value === undefined || pattern === null) return 0
  const key = String(pattern)
  let re = compiled.get(key)
  if (!re) {
    const { source, ignoreCase } = regexFlags(key)
    if (riskyRegex(source)) throw new Error(fr() ? 'Expression régulière refusée : elle pourrait bloquer DevForge.' : 'Regular expression refused: it could freeze DevForge.')
    re = new RegExp(source, ignoreCase ? 'i' : '')
    if (compiled.size > 100) compiled.clear()
    compiled.set(key, re)
  }
  return re.test(String(value).slice(0, REGEX_MAX_VALUE)) ? 1 : 0
}

/** Runs a search's statement with REGEXP on: the statement runs at once (sql.js is synchronous), then it is off again */
export function withRegexp<T>(db: SqlJsDb, run: () => T): T {
  db.create_function('regexp', regexp)
  try { return run() } finally { regexpOff(db) }
}
