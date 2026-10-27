import { readFileSync } from 'fs'
import { join } from 'path'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { tempDir } from './../helpers'
import * as conn from '../../src/main/services/connections/connectionsService'
import { saveConfig } from '../../src/main/services/assistant/assistantStorage'

/** v3.0 lot 1: Settings › Connections, main side (Git's global config redirected to a temp file) */
describe('v3.0 lot 1: connections', () => {
  const before = process.env.GIT_CONFIG_GLOBAL
  const gitconfig = join(tempDir('git'), 'gitconfig')
  beforeAll(() => { process.env.GIT_CONFIG_GLOBAL = gitconfig })
  afterAll(() => { if (before === undefined) delete process.env.GIT_CONFIG_GLOBAL; else process.env.GIT_CONFIG_GLOBAL = before })

  it('sets the Git identity, refuses what git would not take', async () => {
    await conn.setGitIdentity('Alice Martin', 'alice@example.org')
    expect(readFileSync(gitconfig, 'utf-8')).toMatch(/name = Alice Martin[\s\S]*email = alice@example.org/)
    await expect(conn.setGitIdentity('Alice\nMartin', 'alice@example.org')).rejects.toThrow('BAD_NAME')
    await expect(conn.setGitIdentity('Alice', 'pas-un-mail')).rejects.toThrow('BAD_EMAIL')
    expect((await conn.overview()).git).toEqual({ name: 'Alice Martin', email: 'alice@example.org' })
  })

  it('says whether a key is there, never the key; forgets it', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', '')
    saveConfig({ apiKey: 'sk-ant-test' })
    const o = await conn.overview()
    expect(o.forgy).toEqual({ hasKey: true, source: 'saved' })
    expect(JSON.stringify(o)).not.toContain('sk-ant-test')
    await conn.disconnect('forgy')
    expect((await conn.overview()).forgy).toEqual({ hasKey: false, source: null })
    expect(await conn.test('forgy')).toEqual({ ok: false, detail: 'NO_KEY' })
    // ANTHROPIC_API_KEY counts too, and says so
    vi.stubEnv('ANTHROPIC_API_KEY', 'sk-ant-env')
    expect((await conn.overview()).forgy).toEqual({ hasKey: true, source: 'env' })
    vi.unstubAllEnvs()
  })
})
