import { describe, expect, it } from 'vitest'
import {
  matchRanges, regexFlags, riskyRegex, searchProblem, searchSql, searchStatements, searchWords, searchedColumns, snippet, type DbSearchOptions
} from '@shared/lib/dbSearch'
import { sqlString } from '@shared/lib/sqlQuote'

const opts = (o: Partial<DbSearchOptions>): DbSearchOptions => ({ term: 'ada', mode: 'contains', caseSensitive: false, column: '', limit: 50, ...o })
const client = { name: 'client', schema: '' }

describe('database search: the words', () => {
  it('splits « any » and « all » on spaces, keeps a quoted phrase whole, once each', () => {
    expect(searchWords('rue "de Paris" rue  75', 'all')).toEqual(['rue', 'de Paris', '75'])
    expect(searchWords('« rue de Paris » “bd Voltaire” 75', 'any')).toEqual(['rue de Paris', 'bd Voltaire', '75'])
    expect(searchWords('rue de Paris', 'contains')).toEqual(['rue de Paris'])
    expect(searchWords('   ', 'any')).toEqual([])
  })

  it('reads a leading (?i) or (?-i)', () => {
    expect(regexFlags('(?i)^a')).toEqual({ source: '^a', ignoreCase: true })
    expect(regexFlags('(?-i)^a')).toEqual({ source: '^a', ignoreCase: false })
    expect(regexFlags('^a')).toEqual({ source: '^a', ignoreCase: null })
  })

  it('stops an empty term, a too long one and a regular expression that does not compile', () => {
    expect(searchProblem({ term: '  ', mode: 'contains' })).toBe('empty')
    expect(searchProblem({ term: 'x'.repeat(501), mode: 'contains' })).toBe('tooLong')
    expect(searchProblem({ term: '([a-z', mode: 'regex' })).toEqual({ regex: expect.any(String) })
    expect(searchProblem({ term: '^[a-z]+$', mode: 'regex' })).toBeNull()
    expect(searchProblem({ term: '(?i)^(\\w+\\s?)*$', mode: 'regex' })).toBe('risky')
  })

  it('tells a regular expression that could hang: a repeated group holding an unbounded repetition', () => {
    for (const risky of ['(a+)+', '(\\w+\\s?)*$', '(a{2,})*', '((ab)*c)+', '(a{1,50})*b', '(a+){8}b']) expect(riskyRegex(risky), risky).toBe(true)
    for (const safe of ['^[a-z]+@example\\.(com|org)$', '(\\d{3})-(\\d{4})', '(\\d{3}){2}', '[(+)]+', '(?:ab|cd)+', '\\(a+\\)+']) expect(riskyRegex(safe), safe).toBe(false)
  })

  it('searches every column, or only the ones of that name (case ignored)', () => {
    expect(searchedColumns(['id', 'Email', 'name'], '')).toEqual(['id', 'Email', 'name'])
    expect(searchedColumns(['id', 'Email', 'name'], ' email ')).toEqual(['Email'])
    expect(searchedColumns(['id'], 'email')).toEqual([])
  })
})

describe('database search: the SQL of each engine', () => {
  it('MySQL: every column read as text, the case ignored with LOWER, kept as bytes', () => {
    const q = searchStatements('mysql', client, ['id', 'name'], opts({}))
    expect(q.rows.sql).toBe('SELECT * FROM `client` WHERE (LOCATE(LOWER(?), LOWER(CAST(`id` AS CHAR))) > 0 OR LOCATE(LOWER(?), LOWER(CAST(`name` AS CHAR))) > 0) LIMIT 50')
    expect(q.rows.params).toEqual(['ada', 'ada'])
    expect(q.count.sql).toMatch(/^SELECT COUNT\(\*\) AS n FROM `client` WHERE /)
    expect(searchStatements('mysql', client, ['name'], opts({ caseSensitive: true })).rows.sql)
      .toContain('LOCATE(CAST(? AS BINARY), CAST(CAST(`name` AS CHAR) AS BINARY)) > 0')
  })

  it('PostgreSQL: numbered parameters, the schema in the name, ~* for an expression', () => {
    const q = searchStatements('postgres', { name: 'client', schema: 'crm' }, ['name'], opts({ mode: 'regex', term: '^Ad' }))
    expect(q.rows.sql).toBe('SELECT * FROM "crm"."client" WHERE CAST("name" AS TEXT) ~* $1 LIMIT 50')
    expect(q.rows.params).toEqual(['^Ad'])
    const exact = searchStatements('postgres', client, ['a', 'b'], opts({ mode: 'exact', term: 'X' }))
    expect(exact.rows.sql).toContain('LOWER(CAST("a" AS TEXT)) = LOWER($1) OR LOWER(CAST("b" AS TEXT)) = LOWER($2)')
  })

  it('SQLite: DevForge\'s df_lower and REGEXP, the case given by (?i) or (?-i)', () => {
    expect(searchStatements('sqlite', client, ['name'], opts({})).rows.sql).toContain('instr(df_lower(CAST("name" AS TEXT)), df_lower(?)) > 0')
    const re = searchStatements('sqlite', client, ['name'], opts({ mode: 'regex', term: '(?i)^ad', caseSensitive: true }))
    expect(re.rows.sql).toContain('CAST("name" AS TEXT) REGEXP ?')
    expect(re.rows.params).toEqual(['(?-i)^ad'])
  })

  it('« all »: each word somewhere in the row; « any »: one of them', () => {
    const all = searchStatements('sqlite', client, ['a', 'b'], opts({ mode: 'all', term: 'rue Paris' }))
    expect(all.rows.sql).toMatch(/WHERE \(.+ OR .+\) AND \(.+ OR .+\) LIMIT/)
    expect(all.rows.params).toEqual(['rue', 'rue', 'Paris', 'Paris'])
    expect(searchStatements('sqlite', client, ['a'], opts({ mode: 'any', term: 'rue Paris' })).rows.sql).toMatch(/WHERE .+ OR .+ LIMIT/)
  })

  it('quotes odd names and caps the rows brought back', () => {
    expect(searchStatements('mysql', { name: 'we`ird', schema: '' }, ['co`l'], opts({ limit: 5000 })).rows.sql)
      .toBe('SELECT * FROM `we``ird` WHERE LOCATE(LOWER(?), LOWER(CAST(`co``l` AS CHAR))) > 0 LIMIT 200')
  })

  it('the query shown has the values in place, quotes and MySQL backslashes doubled', () => {
    expect(sqlString('postgres', "l'a\\b")).toBe("E'l''a\\\\b'")
    expect(sqlString('postgres', "l'a")).toBe("'l''a'")
    expect(sqlString('sqlite', "l'a\\b")).toBe("'l''a\\b'")
    expect(sqlString('mysql', "l'a\\b")).toBe("'l''a\\\\b'")
    expect(searchSql('sqlite', client, ['name'], opts({ term: "d'Arc" })))
      .toBe(`SELECT * FROM "client"\nWHERE instr(df_lower(CAST("name" AS TEXT)), df_lower('d''Arc')) > 0;`)
  })
})

describe('database search: what is lit', () => {
  it('finds each word, the case ignored or kept, overlaps merged', () => {
    expect(matchRanges('Ada Lovelace, ada', { term: 'ada', mode: 'contains', caseSensitive: false })).toEqual([[0, 3], [14, 17]])
    expect(matchRanges('Ada Lovelace, ada', { term: 'ada', mode: 'contains', caseSensitive: true })).toEqual([[14, 17]])
    expect(matchRanges('abcd', { term: 'abc bcd', mode: 'any', caseSensitive: false })).toEqual([[0, 4]])
    expect(matchRanges('ABC', { term: 'abc', mode: 'exact', caseSensitive: false })).toEqual([[0, 3]])
    expect(matchRanges('ABCD', { term: 'abc', mode: 'exact', caseSensitive: false })).toEqual([])
    expect(matchRanges('a1 b22', { term: '(?i)[0-9]+', mode: 'regex', caseSensitive: false })).toEqual([[1, 2], [4, 6]])
    expect(matchRanges('x', { term: '(', mode: 'regex', caseSensitive: false })).toEqual([])
  })

  it('cuts a long value around its first match', () => {
    const value = `${'a'.repeat(100)}MATCH${'b'.repeat(100)}`
    const s = snippet(value, [[100, 105]], 40)
    expect(s.text.startsWith('…') && s.text.endsWith('…')).toBe(true)
    const [[a, b]] = s.ranges
    expect(s.text.slice(a, b)).toBe('MATCH')
    expect(snippet('short', [[0, 2]])).toEqual({ text: 'short', ranges: [[0, 2]] })
  })
})
