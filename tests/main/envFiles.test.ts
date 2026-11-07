import { readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { describe, expect, it } from 'vitest'
import { backupEnv, parseEnv, readEnvProject, restoreEnv, writeEnvValues } from '../../src/main/services/envfiles/envFiles'
import { saveProjects, tempDir, userData } from '../helpers'

describe('parseEnv', () => {
  it('reads the usual .env syntax', () => {
    expect(parseEnv([
      '# comment',
      'A=1',
      'export B = two ',
      'C="quoted # not a comment"',
      "D='single $NOT_EXPANDED'",
      'E=value # inline comment',
      'F=',
      'G="multi\\nline"',
      'H="say \\"hi\\""',
      'not a line',
      'DATABASE_URL=postgres://u:p@h:5432/db?x=1'
    ].join('\r\n'))).toEqual({
      A: '1', B: 'two', C: 'quoted # not a comment', D: 'single $NOT_EXPANDED', E: 'value', F: '',
      G: 'multi\nline', H: 'say "hi"', DATABASE_URL: 'postgres://u:p@h:5432/db?x=1'
    })
  })
})

describe('writeEnvValues', () => {
  function project() {
    const dir = tempDir('env')
    saveProjects([{ name: 'p', path: dir }])
    return dir
  }

  it('edits in place, keeps comments and order, appends new keys, removes nulls', async () => {
    const dir = project()
    writeFileSync(join(dir, '.env'), '# db\nDB_HOST=localhost\nDB_PORT=5432\n\n# app\nDEBUG=true\n')
    await writeEnvValues(dir, '.env', { DB_PORT: '5433', DEBUG: null, NEW_KEY: 'x' })
    expect(readFileSync(join(dir, '.env'), 'utf-8')).toBe('# db\nDB_HOST=localhost\nDB_PORT=5433\n\n# app\nNEW_KEY=x\n')
  })

  it('keeps CRLF files in CRLF', async () => {
    const dir = project()
    writeFileSync(join(dir, '.env'), 'A=1\r\nB=2\r\n')
    await writeEnvValues(dir, '.env', { B: '3' })
    expect(readFileSync(join(dir, '.env'), 'utf-8')).toBe('A=1\r\nB=3\r\n')
  })

  it.each([
    'plain',
    'with space',
    'has # hash',
    'quote " inside',
    "apostrophe ' inside",
    'C:\\Users\\me\\file',
    'back\\nslash-n literal',
    'real\nnewline',
    '$VAR and ${OTHER}'
  ])('round-trips %j', async value => {
    const dir = project()
    await writeEnvValues(dir, '.env', { KEY: value })
    const env = await readEnvProject(dir)
    expect(env.files[0].values.KEY).toBe(value)
  })

  it('refuses unknown projects and non-env file names', async () => {
    const dir = project()
    await expect(writeEnvValues(tempDir('other'), '.env', { A: '1' })).rejects.toThrow()
    await expect(writeEnvValues(dir, '../evil', { A: '1' })).rejects.toThrow()
    await expect(writeEnvValues(dir, 'package.json', { A: '1' })).rejects.toThrow()
  })
})

describe('encrypted backups', () => {
  it('stores env files encrypted and restores them', async () => {
    const dir = tempDir('env')
    saveProjects([{ name: 'p', path: dir }])
    writeFileSync(join(dir, '.env'), 'SECRET=hunter2\n')
    await backupEnv(dir)
    const raw = readFileSync(join(userData(), 'env-backups', (await import('fs')).readdirSync(join(userData(), 'env-backups'))[0]))
    expect(raw.toString()).not.toContain('hunter2')
    writeFileSync(join(dir, '.env'), 'SECRET=changed\n')
    expect(await restoreEnv(dir)).toEqual(['.env'])
    expect(readFileSync(join(dir, '.env'), 'utf-8')).toBe('SECRET=hunter2\n')
  })
})

describe('dotenv compatibility of written values', () => {
  it('writes Windows paths so dotenv reads them unchanged', async () => {
    const dir = tempDir('env')
    saveProjects([{ name: 'p', path: dir }])
    await writeEnvValues(dir, '.env', { PATH_A: 'C:\\Users\\me', TWICE: 'x\\y' })
    await writeEnvValues(dir, '.env', { OTHER: '1' })
    expect(readFileSync(join(dir, '.env'), 'utf-8')).toBe("PATH_A='C:\\Users\\me'\nTWICE='x\\y'\nOTHER=1\n")
  })
})
