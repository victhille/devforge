import initSqlJs from 'sql.js'
import { describe, expect, it } from 'vitest'
import { previewStatement, rowChangesProblem, rowStatements, type RowChange } from '../../src/shared/lib/rowEdits'

/** v3.6 lot 3: rows changed from the Browse tab */
const client = { name: 'client', schema: '' }

describe('v3.6 lot 3: row statements', () => {
  const changes: RowChange[] = [
    { kind: 'update', key: { id: 2 }, set: { name: "O'Brien", note: null } },
    { kind: 'insert', values: { name: 'Grace' } },
    { kind: 'insert', values: {} },
    { kind: 'delete', key: { id: 1 } }
  ]

  it('writes parameters, never values, per engine', () => {
    expect(rowStatements('postgres', { name: 'client', schema: 'app' }, changes)).toEqual([
      { sql: 'UPDATE "app"."client" SET "name" = $1, "note" = $2 WHERE "id" = $3', params: ["O'Brien", null, 2] },
      { sql: 'INSERT INTO "app"."client" ("name") VALUES ($1)', params: ['Grace'] },
      { sql: 'INSERT INTO "app"."client" DEFAULT VALUES', params: [] },
      { sql: 'DELETE FROM "app"."client" WHERE "id" = $1', params: [1] }
    ])
    expect(rowStatements('mysql', client, changes).map(s => s.sql)).toEqual([
      'UPDATE `client` SET `name` = ?, `note` = ? WHERE `id` = ?',
      'INSERT INTO `client` (`name`) VALUES (?)',
      'INSERT INTO `client` () VALUES ()',
      'DELETE FROM `client` WHERE `id` = ?'
    ])
  })

  it('shows them with the values in place, quoted', () => {
    const [update] = rowStatements('postgres', client, changes)
    expect(previewStatement('postgres', update)).toBe(`UPDATE "client" SET "name" = 'O''Brien', "note" = NULL WHERE "id" = 2`)
    const [, , , del] = rowStatements('mysql', client, changes)
    expect(previewStatement('mysql', del)).toBe('DELETE FROM `client` WHERE `id` = 1')
  })

  it('names a row by its whole primary key, NULL included', () => {
    const [s] = rowStatements('sqlite', { name: 'pair', schema: '' }, [{ kind: 'delete', key: { a: 1, b: null } }])
    expect(s).toEqual({ sql: 'DELETE FROM "pair" WHERE "a" = ? AND "b" IS NULL', params: [1] })
  })

  it('refuses unknown columns, a partial key, a table without key, too many changes', () => {
    expect(rowChangesProblem(changes, ['id', 'name', 'note'], ['id'])).toBeNull()
    expect(rowChangesProblem(changes, ['id', 'name'], ['id'])).toBe('Unknown column: note')
    expect(rowChangesProblem([{ kind: 'delete', key: { a: 1 } }], ['a', 'b'], ['a', 'b'])).toBe('A row must be named by its whole primary key')
    expect(rowChangesProblem(changes, ['id', 'name', 'note'], [])).toMatch(/no primary key/)
    expect(rowChangesProblem(Array(501).fill({ kind: 'insert', values: {} }), ['id'], ['id'])).toMatch(/500 changes at most/)
  })

  it('runs on a real SQLite database', async () => {
    const SQL = await initSqlJs()
    const db = new SQL.Database()
    db.run("CREATE TABLE client (id INTEGER PRIMARY KEY, name TEXT, note TEXT); INSERT INTO client (name, note) VALUES ('Ada', 'x'), ('Linus', 'y')")
    for (const s of rowStatements('sqlite', client, changes)) db.run(s.sql, s.params as (string | number | null)[])
    expect(db.exec('SELECT id, name, note FROM client ORDER BY id')[0].values).toEqual([[2, "O'Brien", null], [3, 'Grace', null], [4, null, null]])
  })
})
