import { writeFileSync } from 'fs'
import { join } from 'path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { closeAllDbs, dbBrowse, dbDetails, dbOverview, dbQuery, dbSchema, testDb } from '../../src/main/services/database/dbClient'
import { saveDbConnection } from '../../src/main/services/database/dbStorage'
import { tempDir } from '../helpers'

const ID = 'lite'

beforeAll(async () => {
  const file = join(tempDir('sqlite'), 'app.sqlite')
  writeFileSync(file, Buffer.alloc(0))
  saveDbConnection({ id: ID, name: 'lite', type: 'sqlite', file, color: '' })
  for (const sql of [
    'CREATE TABLE client (id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT NOT NULL UNIQUE, name TEXT DEFAULT \'anon\')',
    'CREATE INDEX idx_name ON client (name)',
    'CREATE TABLE invoice (id INTEGER PRIMARY KEY, client_id INTEGER NOT NULL REFERENCES client(id) ON DELETE CASCADE, total REAL)',
    'CREATE VIEW big AS SELECT * FROM invoice WHERE total > 10',
    "INSERT INTO client (email, name) VALUES ('a@x.io','A'),('b@x.io','B'),('c@x.io',NULL)",
    'INSERT INTO invoice (client_id, total) VALUES (1, 10.5), (1, 20), (2, 5)'
  ]) {
    const r = await dbQuery(ID, sql)
    expect(r.error).toBeUndefined()
  }
})
afterAll(() => closeAllDbs())

describe('SQLite connection', () => {
  it('reports its version', async () => {
    const file = join(tempDir(), 'new.sqlite')
    writeFileSync(file, Buffer.alloc(0))
    expect(await testDb({ id: 'x', name: 'x', type: 'sqlite', file, color: '' })).toMatch(/^SQLite 3\./)
  })

  it('runs queries and reports errors without throwing', async () => {
    const r = await dbQuery(ID, 'SELECT email FROM client ORDER BY id')
    expect(r.columns).toEqual(['email'])
    expect(r.rows).toEqual([['a@x.io'], ['b@x.io'], ['c@x.io']])
    expect((await dbQuery(ID, 'SELECT * FROM nope')).error).toMatch(/no such table/)
  })

  it('lists tables and views with their columns', async () => {
    const schema = await dbSchema(ID)
    expect(schema.map(t => [t.name, t.type])).toEqual([['big', 'view'], ['client', 'table'], ['invoice', 'table']])
  })
})

describe('explorer', () => {
  it('overview counts rows per table', async () => {
    const o = await dbOverview(ID)
    expect(o.database).toBe('app.sqlite')
    expect(o.tables.find(t => t.name === 'invoice')?.rows).toBe(3)
  })

  it('details: columns, keys, indexes, foreign keys both ways, DDL', async () => {
    const client = await dbDetails(ID, { name: 'client', schema: '' })
    expect(client.columns.map(c => [c.name, c.key, c.nullable])).toEqual([['id', 'PRI', false], ['email', 'UNI', false], ['name', 'MUL', true]])
    expect(client.columns[0].extra).toBe('autoincrement')
    expect(client.columns[2].default).toBe("'anon'")
    expect(client.referencedBy).toEqual([expect.objectContaining({ table: 'invoice', columns: ['client_id'], refColumns: ['id'], onDelete: 'CASCADE' })])
    expect(client.ddl).toMatch(/^CREATE TABLE client/)

    const invoice = await dbDetails(ID, { name: 'invoice', schema: '' })
    expect(invoice.foreignKeys).toEqual([expect.objectContaining({ table: 'client', columns: ['client_id'], refColumns: ['id'] })])
  })

  it('browse pages and sorts', async () => {
    const page = await dbBrowse(ID, { name: 'client', schema: '' }, { offset: 1, limit: 1, orderBy: 'email', desc: true })
    expect(page.rows).toEqual([[2, 'b@x.io', 'B']])
    expect(page.total).toBe(3)
  })

  it('browse refuses to run injected identifiers', async () => {
    const bad = await dbBrowse(ID, { name: 'client"; DROP TABLE client; --', schema: '' }, { offset: 0, limit: 5 })
    expect(bad.error).toBeTruthy()
    // SQLite reads an unknown quoted column as a string: harmless constant sort
    await dbBrowse(ID, { name: 'client', schema: '' }, { offset: 0, limit: 5, orderBy: 'id"; DROP TABLE client; --' })
    expect((await dbQuery(ID, 'SELECT COUNT(*) FROM client')).rows).toEqual([[3]])
  })

  it('clamps paging values', async () => {
    const r = await dbBrowse(ID, { name: 'client', schema: '' }, { offset: -5, limit: 1e9 })
    expect(r.rows).toHaveLength(3)
  })
})
