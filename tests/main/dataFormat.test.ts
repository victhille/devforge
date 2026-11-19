import { describe, expect, it } from 'vitest'
import { existsSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'fs'
import { homedir, tmpdir } from 'os'
import { join } from 'path'
import { writeJsonFile } from '../../src/main/lib/jsonFile'
import { backupData, migrateData, readSchemaVersion, type Migration } from '../../src/main/services/storage/migrations'
import { initLog, log, redact, tailLog } from '../../src/main/lib/log'

const tmp = () => mkdtempSync(join(tmpdir(), 'devforge-storage-'))
const readJson = (path: string) => JSON.parse(readFileSync(path, 'utf-8'))

describe('writeJsonFile', () => {
  it('writes through a temp file and leaves nothing behind', () => {
    const dir = tmp()
    writeJsonFile(join(dir, 'sub', 'a.json'), { a: 1 })
    writeJsonFile(join(dir, 'sub', 'a.json'), { a: 2 }, false)
    expect(readJson(join(dir, 'sub', 'a.json'))).toEqual({ a: 2 })
    expect(readdirSync(join(dir, 'sub'))).toEqual(['a.json'])
  })
})

describe('data migrations', () => {
  it('treats data without a manifest as format 1 and records it', () => {
    const dir = tmp()
    expect(readSchemaVersion(dir)).toBe(1)
    expect(migrateData(dir, [], 1)).toEqual({ status: 'current', version: 1 })
    expect(readJson(join(dir, 'storage.json'))).toEqual({ schemaVersion: 1 })
  })

  it('backs up, then runs pending migrations in order', () => {
    const dir = tmp()
    writeFileSync(join(dir, 'projects.json'), JSON.stringify([{ name: 'a' }]))
    const order: number[] = []
    const migrations: Migration[] = [
      { to: 3, name: 'three', run: () => order.push(3) },
      { to: 2, name: 'two', run: d => { order.push(2); writeJsonFile(join(d, 'projects.json'), [{ name: 'a', v: 2 }]) } }
    ]
    const r = migrateData(dir, migrations, 3)
    expect(r.status).toBe('migrated')
    expect(order).toEqual([2, 3])
    expect(readSchemaVersion(dir)).toBe(3)
    // The backup holds the data as it was before migrating
    if (r.status !== 'migrated') throw new Error()
    expect(readJson(join(r.backup, 'projects.json'))).toEqual([{ name: 'a' }])
    expect(readJson(join(dir, 'projects.json'))).toEqual([{ name: 'a', v: 2 }])
    // Already current: nothing runs again
    expect(migrateData(dir, migrations, 3).status).toBe('current')
    expect(order).toEqual([2, 3])
  })

  it('never touches data written by a newer version', () => {
    const dir = tmp()
    writeFileSync(join(dir, 'storage.json'), JSON.stringify({ schemaVersion: 9 }))
    let ran = false
    expect(migrateData(dir, [{ to: 2, name: 'x', run: () => { ran = true } }], 2)).toEqual({ status: 'newer', version: 9 })
    expect(ran).toBe(false)
    expect(existsSync(join(dir, 'backups'))).toBe(false)
  })

  it('keeps only the last five backups', () => {
    const dir = tmp()
    writeFileSync(join(dir, 'settings.json'), '{}')
    for (let i = 0; i < 7; i++) backupData(dir, 1, new Date(Date.UTC(2026, 0, 1 + i)))
    const kept = readdirSync(join(dir, 'backups')).sort()
    expect(kept).toHaveLength(5)
    expect(kept[0]).toContain('2026-01-03')
  })
})

describe('local log', () => {
  it('masks secrets', () => {
    expect(redact('key sk-ant-api03-abcDEF_123 used')).toBe('key sk-ant-*** used')
    expect(redact('Authorization: Bearer eyJhbGci.x.y')).toBe('Authorization: Bearer ***')
    expect(redact('postgres://user:hunter2@db:5432/app')).toBe('postgres://user:***@db:5432/app')
    expect(redact('DB_PASSWORD=hunter2 next')).toBe('DB_PASSWORD=*** next')
  })

  it("masks the other providers' keys, JSON secrets, e-mails and user folders", () => {
    // Fake keys of the right shape (never real ones)
    expect(redact('openai sk-proj-AbCdEf0123456789xyz')).toBe('openai sk-proj-***')
    expect(redact('legacy sk-AbCdEf0123456789AbCdEf01')).toBe('legacy sk-***')
    expect(redact('google AIzaSyA0123456789abcdefghij')).toBe('google AIza***')
    expect(redact('grok xai-0123456789abcdefghij')).toBe('grok xai-***')
    expect(redact('groq gsk_0123456789abcdefghij')).toBe('groq gsk_***')
    expect(redact('gh ghp_0123456789abcdefghijABCD')).toBe('gh ghp_***')
    expect(redact('fine github_pat_11AAAA0000bbbbCCCCdddd')).toBe('fine github_pat_***')
    expect(redact('{"token": "abc", "apiKey":"xyz", "name":"ok"}')).toBe('{"token": "***", "apiKey":"***", "name":"ok"}')
    expect(redact('from alice@example.org to bob.smith+dev@mail.example.com')).toBe('from ***@*** to ***@***')
    // An SSH remote keeps its git@ part, it is not an address
    expect(redact('git@github.com:owner/repo.git')).toBe('git@github.com:owner/repo.git')
    expect(redact('C:\\Users\\someone\\project\\.env')).toBe('C:\\Users\\***\\project\\.env')
    expect(redact('C:\\Users\\Public\\x')).toBe('C:\\Users\\Public\\x')
    expect(redact('{"path":"C:\\\\Users\\\\someone\\\\app"}')).toBe('{"path":"C:\\\\Users\\\\***\\\\app"}')
    expect(redact('cd /home/someone/app && ls /Users/other')).toBe('cd /home/***/app && ls /Users/***')
    // Quoted values, prefixed JSON keys, passphrases, and a key glued to a letter
    expect(redact('password="hunter2" DB_PASSWORD=\'x y\'')).toBe('password=*** DB_PASSWORD=***')
    expect(redact("{ password: 'x', token: 'y' }")).toBe('{ password: ***, token: *** }')
    expect(redact('{"access_token":"a","client_secret":"b","X-N8N-API-KEY":"c"}')).toBe('{"access_token":"***","client_secret":"***","X-N8N-API-KEY":"***"}')
    expect(redact('passphrase=open sesame')).toBe('passphrase=*** sesame')
    expect(redact('?api_key%3Dsk-ant-api03-abcdef')).toBe('?api_key%3Dsk-ant-***')
    // This PC's own folder becomes ~ (the account name stays out of a shared report)
    expect(redact(`${homedir()}\\Dev\\shop`)).toBe('~\\Dev\\shop')
  })

  it('appends lines and returns the tail', () => {
    initLog(join(tmp(), 'logs'))
    log('info', 'test', 'first')
    log('warn', 'test', new Error('boom token=abc'))
    const tail = tailLog(200)
    expect(tail).toContain('INFO [test] first')
    expect(tail).toContain('WARN [test] boom token=***')
  })
})
