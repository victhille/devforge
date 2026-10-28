import { mkdirSync, writeFileSync } from 'fs'
import { join } from 'path'
import initSqlJs from 'sql.js'
import { describe, expect, it } from 'vitest'
import type { DbColumnInfo } from '../../src/shared/types'
import { scanDirectory } from '../../src/main/services/projects/projectScanner'
import { toCsv, toJson } from '../../src/shared/lib/resultExport'
import { looksBinary, previewKind } from '../../src/shared/lib/filePreview'
import {
  EMPTY_COLUMN, addColumnSql, alterColumnSql, columnProblem, createTableSql, defaultSql, dropColumnSql,
  dropTableSql, renameTableSql, type ColumnDef
} from '../../src/shared/lib/tableDdl'
import { tempDir } from '../helpers'

const file = (path: string, content = '{}') => { mkdirSync(join(path, '..'), { recursive: true }); writeFileSync(path, content) }

describe('v3.5.1: a group lists the rest of its folder', () => {
  it('shows docs, infra, README and Dockerfile, not its projects nor hidden or dependency folders', async () => {
    const root = tempDir('extras')
    const g = join(root, 'time-manager')
    file(join(g, 'backend', 'composer.json'))
    file(join(g, 'frontend', 'package.json'))
    file(join(g, 'docs', 'cahier-des-charges.pdf'), '%PDF')
    file(join(g, 'infra', 'proxy', 'Dockerfile'), 'FROM nginx')
    file(join(g, '.github', 'pull_request_template.md'), '#')
    file(join(g, 'node_modules', 'x', 'package.json'))
    file(join(g, 'README.md'), '# Time manager')
    file(join(g, 'Dockerfile'), 'FROM node')
    file(join(g, '.env'), 'SECRET=1')

    const [group] = await scanDirectory(root)
    expect(group.framework).toBe('group')
    expect(group.extras).toEqual(['docs/', 'infra/', 'Dockerfile', 'README.md'])
  })
})

describe('v3.5.1: file previews', () => {
  it('picks the preview from the name', () => {
    expect(previewKind('README.md')).toBe('markdown')
    expect(previewKind('cahier.PDF')).toBe('pdf')
    expect(previewKind('logo.svg')).toBe('image')
    expect(previewKind('Dockerfile')).toBe('text')
    expect(previewKind('.env.example')).toBe('text')
    expect(previewKind('app.zip')).toBeNull()
    expect(previewKind('Report.docx')).toBeNull()
  })

  it('tells binary content by its NUL bytes', () => {
    expect(looksBinary(new TextEncoder().encode('const a = 1\n'))).toBe(false)
    expect(looksBinary(new Uint8Array([0x4d, 0x5a, 0, 0]))).toBe(true)
  })
})

describe('v3.5.1: copy results as CSV or JSON', () => {
  const r = { columns: ['id', 'name', 'id'], rows: [[1, 'Ada, "the first"', 7], [2, null, 8]] }

  it('quotes CSV per RFC 4180', () => {
    expect(toCsv(r)).toBe('id,name,id\n1,"Ada, ""the first""",7\n2,,8')
  })

  it('gives one object per row, a repeated column suffixed', () => {
    expect(JSON.parse(toJson(r))).toEqual([{ id: 1, name: 'Ada, "the first"', id_2: 7 }, { id: 2, name: null, id_2: 8 }])
    expect(toJson({ columns: ['n'], rows: [[10n]] })).toContain('"10"')
  })
})

const col = (patch: Partial<ColumnDef>): ColumnDef => ({ ...EMPTY_COLUMN, ...patch })
const info = (patch: Partial<DbColumnInfo>): DbColumnInfo => ({ name: 'x', type: 'INT', nullable: true, default: null, key: '', extra: '', comment: '', ...patch })
const users = { name: 'users', schema: '' }

describe('v3.5.1: table SQL', () => {
  it('quotes defaults that are not numbers, keywords or SQL already', () => {
    expect(defaultSql('42')).toBe('42')
    expect(defaultSql('CURRENT_TIMESTAMP')).toBe('CURRENT_TIMESTAMP')
    expect(defaultSql('now()')).toBe('now()')
    expect(defaultSql("'draft'::character varying")).toBe("'draft'::character varying")
    expect(defaultSql("it's")).toBe("'it''s'")
    expect(defaultSql('draft')).toBe("'draft'")
  })

  it('refuses a type that would carry more SQL', () => {
    expect(columnProblem('mysql', col({ name: 'a', type: 'VARCHAR(255)' }))).toBeNull()
    expect(columnProblem('postgres', col({ name: 'a', type: 'timestamp without time zone' }))).toBeNull()
    expect(columnProblem('postgres', col({ name: 'a', type: 'text[]' }))).toBeNull()
    expect(columnProblem('mysql', col({ name: 'a', type: 'INT); DROP TABLE users; --' }))).toBe('type')
    expect(columnProblem('mysql', col({ name: '', type: 'INT' }))).toBe('name')
    expect(columnProblem('sqlite', col({ name: 'id', type: 'INT', primary: true, autoIncrement: true }))).toBe('autoIncrement')
    expect(columnProblem('mysql', col({ name: 'id', type: 'VARCHAR(10)', primary: true, autoIncrement: true }))).toBe('autoIncrement')
  })

  it('writes CREATE TABLE per engine', () => {
    const cols = [col({ name: 'id', type: 'INT', nullable: false, primary: true, autoIncrement: true }), col({ name: 'title', type: 'VARCHAR(255)', nullable: false, default: 'untitled' })]
    expect(createTableSql('mysql', users, cols)[0]).toBe('CREATE TABLE `users` (\n  `id` INT AUTO_INCREMENT NOT NULL,\n  `title` VARCHAR(255) NOT NULL DEFAULT \'untitled\',\n  PRIMARY KEY (`id`)\n)')
    expect(createTableSql('postgres', { name: 'users', schema: 'app' }, [{ ...cols[0], type: 'integer' }, cols[1]])[0])
      .toBe('CREATE TABLE "app"."users" (\n  "id" integer GENERATED BY DEFAULT AS IDENTITY NOT NULL,\n  "title" VARCHAR(255) NOT NULL DEFAULT \'untitled\',\n  PRIMARY KEY ("id")\n)')
  })

  it('changes a MySQL column in one CHANGE, keeping auto-increment and comment', () => {
    const before = info({ name: 'id', type: 'int', nullable: false, key: 'PRI', extra: 'auto_increment', comment: "user's id" })
    expect(alterColumnSql('mysql', users, before, col({ name: 'user_id', type: 'bigint', nullable: false, primary: true }))).toEqual([
      "ALTER TABLE `users` CHANGE COLUMN `id` `user_id` bigint NOT NULL AUTO_INCREMENT COMMENT 'user''s id'"
    ])
    expect(alterColumnSql('mysql', users, before, col({ name: 'id', type: 'int', nullable: false, primary: true, autoIncrement: true }))).toEqual([])
  })

  it('changes a PostgreSQL column step by step', () => {
    const before = info({ name: 'status', type: 'character varying(20)', nullable: true, default: "'draft'::character varying" })
    expect(alterColumnSql('postgres', users, before, col({ name: 'state', type: 'text', nullable: false, default: '' }))).toEqual([
      'ALTER TABLE "users" RENAME COLUMN "status" TO "state"',
      'ALTER TABLE "users" ALTER COLUMN "state" TYPE text USING "state"::text',
      'ALTER TABLE "users" ALTER COLUMN "state" SET NOT NULL',
      'ALTER TABLE "users" ALTER COLUMN "state" DROP DEFAULT'
    ])
    expect(renameTableSql('postgres', { name: 'users', schema: 'app' }, 'members')).toEqual(['ALTER TABLE "app"."users" RENAME TO "members"'])
    expect(renameTableSql('mysql', users, 'members')).toEqual(['RENAME TABLE `users` TO `members`'])
  })

  it('runs on a real SQLite database: create, add, rename, drop', async () => {
    const SQL = await initSqlJs()
    const db = new SQL.Database()
    const run = (list: string[]) => list.forEach(s => db.run(s))
    const columns = (t: string) => db.exec(`PRAGMA table_info("${t}")`)[0].values.map(v => String(v[1]))

    run(createTableSql('sqlite', users, [col({ name: 'id', type: 'INTEGER', nullable: false, primary: true, autoIncrement: true }), col({ name: 'name', type: 'TEXT', nullable: false })]))
    db.run(`INSERT INTO "users" ("name") VALUES ('Ada'), ('Linus')`)
    expect(db.exec('SELECT id FROM users')[0].values).toEqual([[1], [2]])

    run(addColumnSql('sqlite', users, col({ name: 'role', type: 'TEXT', default: 'member' })))
    expect(db.exec('SELECT role FROM users WHERE id = 1')[0].values).toEqual([['member']])

    const role = info({ name: 'role', type: 'TEXT', default: "'member'" })
    const renamed = alterColumnSql('sqlite', users, role, col({ name: 'kind', type: 'TEXT', default: "'member'" }))
    expect(renamed).not.toBe('unsupported')
    run(renamed as string[])
    expect(alterColumnSql('sqlite', users, role, col({ name: 'role', type: 'INTEGER', default: "'member'" }))).toBe('unsupported')

    run(dropColumnSql('sqlite', users, 'kind'))
    expect(columns('users')).toEqual(['id', 'name'])

    run(renameTableSql('sqlite', users, 'members'))
    run(dropTableSql('sqlite', { name: 'members', schema: '' }))
    expect(db.exec(`SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'`)).toEqual([])
  })
})
