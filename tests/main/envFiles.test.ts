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
    'lone\rreturn',
    'windows\r\nline break',
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

  it.each([
    'A\nINJECTED',
    'A\rINJECTED',
    'A B',
    'A=B',
    '1ABC',
    '',
    '# comment'
  ])('refuses the key %j and leaves the file as it was', async key => {
    const dir = project()
    writeFileSync(join(dir, '.env'), 'A=1\n')
    await expect(writeEnvValues(dir, '.env', { [key]: 'x' })).rejects.toThrow(/Not an env variable name/)
    expect(readFileSync(join(dir, '.env'), 'utf-8')).toBe('A=1\n')
  })

  it('refuses changes that are not text values in an object, as a window could send them', async () => {
    const dir = project()
    writeFileSync(join(dir, '.env'), 'A=1\n')
    const send = (changes: unknown) => writeEnvValues(dir, '.env', changes as Record<string, string | null>)
    await expect(send({ A: 2 })).rejects.toThrow(/must be text/)
    await expect(send({ A: { toString: () => 'x\nB=1' } })).rejects.toThrow(/must be text/)
    await expect(send(['A=1'])).rejects.toThrow(/must be an object/)
    await expect(send(null)).rejects.toThrow(/must be an object/)
    expect(readFileSync(join(dir, '.env'), 'utf-8')).toBe('A=1\n')
  })

  it('reads, changes and removes a value holding a lone \\r or U+2028, as older versions wrote it', async () => {
    const dir = project()
    writeFileSync(join(dir, '.env'), "OLD='a\rb'\nSEP='x y'\nZ=1\n")
    expect((await readEnvProject(dir)).files[0].values).toEqual({ OLD: 'a\rb', SEP: 'x y', Z: '1' })
    await writeEnvValues(dir, '.env', { OLD: 'new', SEP: null })
    expect(readFileSync(join(dir, '.env'), 'utf-8')).toBe('OLD=new\nZ=1\n')
  })

  it('never writes a raw line break, even a lone \\r: the value stays on its line', async () => {
    const dir = project()
    await writeEnvValues(dir, '.env', { KEY: 'a\rINJECTED=1', OTHER: 'b\nALSO=2' })
    const text = readFileSync(join(dir, '.env'), 'utf-8')
    expect(text).toBe('KEY="a\\rINJECTED=1"\nOTHER="b\\nALSO=2"\n')
    expect(text.replace(/\n$/, '').split(/\r\n|\r|\n/)).toHaveLength(2)
    expect(Object.keys((await readEnvProject(dir)).files[0].values)).toEqual(['KEY', 'OTHER'])
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
