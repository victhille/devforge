import { readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { afterAll, describe, expect, it } from 'vitest'
import { dialog } from '../stubs/electron'
import type { DbConnection, DbType } from '../../src/shared/types'
import { closeAllDbs, dbApplyRows, dbDetails, dbQuery } from '../../src/main/services/database/dbClient'
import { saveDbConnection } from '../../src/main/services/database/dbStorage'
import { exportTable, importCsv, pickCsv } from '../../src/main/services/database/dbTransfer'
import { addColumnSql, alterColumnSql, createTableSql, dropColumnSql, dropTableSql, renameTableSql, EMPTY_COLUMN } from '../../src/shared/lib/tableDdl'
import { tempDir } from '../helpers'

/**
 * v3.6 lot 6: tables, rows, export and import on real servers. Opt-in: start
 * the two containers, then run with DEVFORGE_REAL_DB=1
 *   docker run -d --rm --name df-verify-pg -e POSTGRES_PASSWORD=verify -e POSTGRES_DB=verify -p 55432:5432 postgres:16-alpine
 *   docker run -d --rm --name df-verify-maria -e MARIADB_ROOT_PASSWORD=verify -e MARIADB_DATABASE=verify -p 53306:3306 mariadb:11.4
 */
const SERVERS: { type: DbType; port: number; user: string; id: string }[] = [
  { type: 'postgres', port: 55432, user: 'postgres', id: 'real-pg' },
  { type: 'mysql', port: 53306, user: 'root', id: 'real-maria' }
]

afterAll(() => closeAllDbs())

describe.skipIf(!process.env.DEVFORGE_REAL_DB)('v3.6: on real PostgreSQL and MariaDB', () => {
  for (const s of SERVERS) {
    it(`${s.type}: a table created and changed, its rows edited in one transaction, exported and imported`, async () => {
      const conn: DbConnection = { id: s.id, name: s.id, type: s.type, host: '127.0.0.1', port: s.port, user: s.user, password: 'verify', database: 'verify', color: '#5B9BFF' }
      saveDbConnection(conn)
      const run = async (sql: string) => { const r = await dbQuery(s.id, sql); expect(r.error, sql).toBeUndefined(); return r }
      const t = { name: 'invoice', schema: s.type === 'postgres' ? 'public' : '' }
      await dbQuery(s.id, `DROP TABLE IF EXISTS ${s.type === 'mysql' ? '`invoice`, `invoices`' : '"invoice", "invoices"'}`)

      // Lot 3 of 3.5.1: the table's structure
      const id = { ...EMPTY_COLUMN, name: 'id', type: s.type === 'mysql' ? 'INT' : 'integer', nullable: false, primary: true, autoIncrement: true }
      for (const sql of createTableSql(s.type, t, [id, { ...EMPTY_COLUMN, name: 'label', type: 'varchar(100)', nullable: false }])) await run(sql)
      for (const sql of addColumnSql(s.type, t, { ...EMPTY_COLUMN, name: 'status', type: 'varchar(20)', default: 'draft' })) await run(sql)
      const status = (await dbDetails(s.id, t)).columns.find(c => c.name === 'status')!
      const altered = alterColumnSql(s.type, t, status, { ...EMPTY_COLUMN, name: 'state', type: 'varchar(40)', nullable: true, default: 'new' })
      expect(altered).not.toBe('unsupported')
      for (const sql of altered as string[]) await run(sql)
      const state = (await dbDetails(s.id, t)).columns.find(c => c.name === 'state')!
      expect(state.type).toMatch(/varchar|character varying/i)
      expect(state.default).toMatch(/new/)

      // v3.6 lot 3: rows, all or none
      expect(await dbApplyRows(s.id, t, [
        { kind: 'insert', values: { label: "O'Brien" } }, { kind: 'insert', values: { label: 'Ada', state: null } }, { kind: 'insert', values: { label: 'Linus' } }
      ])).toEqual({ affected: 3 })
      const rows = async () => (await run(`SELECT id, label, state FROM ${s.type === 'mysql' ? '`invoice`' : '"invoice"'} ORDER BY id`)).rows
      expect(await rows()).toEqual([[1, "O'Brien", 'new'], [2, 'Ada', null], [3, 'Linus', 'new']])
      expect(await dbApplyRows(s.id, t, [{ kind: 'update', key: { id: 2 }, set: { state: 'paid' } }, { kind: 'delete', key: { id: 3 } }])).toEqual({ affected: 2 })
      // label is required: the update before it is rolled back
      const failed = await dbApplyRows(s.id, t, [{ kind: 'update', key: { id: 1 }, set: { label: 'changed' } }, { kind: 'insert', values: { state: 'x' } }])
      expect(failed.error).toBeTruthy()
      expect(await rows()).toEqual([[1, "O'Brien", 'new'], [2, 'Ada', 'paid']])

      // v3.6 lot 4: export, then import
      const dir = tempDir('real')
      dialog.next = join(dir, 'invoice.csv')
      expect(await exportTable({} as never, s.id, t, 'csv')).toEqual({ path: dialog.next, rows: 2 })
      expect(readFileSync(dialog.next, 'utf-8')).toBe(`id,label,state\n1,O'Brien,new\n2,Ada,paid`)
      dialog.next = join(dir, 'invoice.sql')
      await exportTable({} as never, s.id, t, 'sql-create')
      expect(readFileSync(dialog.next, 'utf-8')).toContain(`INSERT INTO ${s.type === 'mysql' ? '`invoice`' : '"public"."invoice"'}`)

      dialog.next = join(dir, 'in.csv')
      writeFileSync(dialog.next, 'Label;State\nGrace;\nMargaret;sent\n')
      const preview = await pickCsv({} as never, s.id, t)
      expect(preview && !('error' in preview) && preview.mapping).toEqual(['label', 'state'])
      expect(await importCsv(s.id, t, (preview as { token: string }).token, ['label', 'state'], true)).toEqual({ inserted: 2 })
      expect((await rows()).slice(2).map(r => r.slice(1))).toEqual([['Grace', null], ['Margaret', 'sent']])
      // A refused row: none kept, its line named
      writeFileSync(dialog.next, 'label,state\nOk,a\n,b\n')
      const bad = await pickCsv({} as never, s.id, t)
      const refused = await importCsv(s.id, t, (bad as { token: string }).token, ['label', 'state'], true)
      expect(refused).toMatchObject({ inserted: 0, line: 3 })
      expect(await rows()).toHaveLength(4)

      // The table renamed, a column dropped, then the table dropped
      for (const sql of dropColumnSql(s.type, t, 'state')) await run(sql)
      for (const sql of renameTableSql(s.type, t, 'invoices')) await run(sql)
      for (const sql of dropTableSql(s.type, { ...t, name: 'invoices' })) await run(sql)
    })
  }
})
