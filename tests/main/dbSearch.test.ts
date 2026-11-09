import { writeFileSync } from 'fs'
import { join } from 'path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { DbSearchOptions } from '@shared/lib/dbSearch'
import { closeAllDbs, dbQuery } from '../../src/main/services/database/dbClient'
import { dbSearchTable } from '../../src/main/services/database/dbSearch'
import { saveDbConnection } from '../../src/main/services/database/dbStorage'
import { tempDir } from '../helpers'

const o = (p: Partial<DbSearchOptions>): DbSearchOptions => ({ term: '', mode: 'contains', caseSensitive: false, column: '', limit: 50, ...p })
const client = { name: 'client', schema: '' }

/** The Search tab on a real SQLite file: DevForge's df_lower and REGEXP included */
describe('database search on SQLite', () => {
  beforeAll(async () => {
    const file = join(tempDir('search'), 'crm.sqlite')
    writeFileSync(file, Buffer.alloc(0))
    saveDbConnection({ id: 'search', name: 'search', type: 'sqlite', file, color: '' })
    for (const sql of [
      'CREATE TABLE client (id INTEGER PRIMARY KEY, name TEXT, email TEXT, city TEXT, score REAL)',
      "INSERT INTO client (name, email, city, score) VALUES ('Élodie Martin', 'elodie@example.com', 'Paris', 4.5), ('Ada', 'ada@example.org', 'Lyon', NULL), ('Linus', NULL, 'Paris 11e', 12)",
      'CREATE INDEX client_lower_email ON client (lower(email))'
    ]) expect((await dbQuery('search', sql)).error).toBeUndefined()
  })
  afterAll(() => closeAllDbs())

  const names = async (p: Partial<DbSearchOptions>) => {
    const r = await dbSearchTable('search', client, o(p))
    expect(r.error).toBeUndefined()
    return { names: r.rows.map(row => row[r.columns.indexOf('name')]), total: r.total, columns: r.columns }
  }

  it('finds the term in any column, accents and case ignored, numbers read as text', async () => {
    expect((await names({ term: 'élodie' })).names).toEqual(['Élodie Martin'])
    expect((await names({ term: 'ÉLODIE' })).names).toEqual(['Élodie Martin'])
    expect((await names({ term: '4.5' })).names).toEqual(['Élodie Martin'])
    expect((await names({ term: 'example' })).total).toBe(2)
    expect((await names({ term: 'élodie', caseSensitive: true })).names).toEqual([])
  })

  it('words, exact values, a column, a regular expression', async () => {
    expect((await names({ term: 'paris ada', mode: 'any' })).names).toEqual(['Élodie Martin', 'Ada', 'Linus'])
    expect((await names({ term: 'paris 11e', mode: 'all' })).names).toEqual(['Linus'])
    expect((await names({ term: '"Paris 11e"', mode: 'all' })).names).toEqual(['Linus'])
    expect((await names({ term: 'paris', mode: 'exact' })).names).toEqual(['Élodie Martin'])
    expect((await names({ term: 'paris', column: 'name' })).names).toEqual([])
    expect((await names({ term: '^[a-z]+@example\\.(com|org)$', mode: 'regex' })).names).toEqual(['Élodie Martin', 'Ada'])
    expect((await names({ term: '^ADA$', mode: 'regex', caseSensitive: true })).names).toEqual([])
  })

  it('counts every row, brings back the limit; a missing column skips the table', async () => {
    const r = await dbSearchTable('search', client, o({ term: 'a', limit: 1 }))
    expect([r.rows.length, r.total]).toEqual([1, 3])
    expect(await dbSearchTable('search', client, o({ term: 'a', column: 'phone' }))).toMatchObject({ skipped: true, rows: [], total: 0 })
  })

  it('leaves the database as it was, its own lower() index still working', async () => {
    expect((await dbQuery('search', "INSERT INTO client (name, email) VALUES ('Grace', 'GRACE@example.com')")).error).toBeUndefined()
    expect((await dbQuery('search', "SELECT name FROM client WHERE lower(email) = 'grace@example.com'")).rows).toEqual([['Grace']])
  })

  it('REGEXP only runs during a search: a view that calls it otherwise gets an error, a pattern that could hang is refused', async () => {
    expect((await dbQuery('search', "CREATE VIEW trap AS SELECT * FROM client WHERE name REGEXP '(a{1,50})*b'")).error).toBeUndefined()
    expect((await dbQuery('search', 'SELECT COUNT(*) FROM trap')).error).toMatch(/REGEXP/)
    expect((await dbQuery('search', "SELECT COUNT(*) FROM client WHERE name REGEXP 'a'")).error).toMatch(/REGEXP/)
    // The search's own statement still has it
    expect((await names({ term: 'ada', mode: 'regex' })).names).toEqual(['Ada'])
    expect((await dbQuery('search', 'DROP VIEW trap')).error).toBeUndefined()
  })

  it('an unknown table is an error, not a crash', async () => {
    const r = await dbSearchTable('search', { name: 'nope', schema: '' }, o({ term: 'a' }))
    expect(r.error).toMatch(/no such table/)
  })
})
