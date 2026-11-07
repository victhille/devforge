import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'fs'
import { join } from 'path'
import { describe, expect, it } from 'vitest'
import { tempDir } from '../helpers'
import { exportConfig, importConfig, stripSecrets, wipeData } from '../../src/main/services/storage/profile'

/** v3.0 lot 4: erase everything, export and import the setup */
function profile(): string {
  const dir = tempDir('profile')
  writeFileSync(join(dir, 'settings.json'), JSON.stringify({ language: 'fr', onboarded: true, defaultProjectsDir: 'C:/code' }))
  writeFileSync(join(dir, 'projects.json'), JSON.stringify([{ id: 'p1', name: 'shop', path: 'C:/code/shop' }]))
  writeFileSync(join(dir, 'ssh-connections.json'), JSON.stringify([{ id: 's1', name: 'vps', host: '203.0.113.10', username: 'deploy', authMethod: 'privateKey', privateKeyPath: 'C:/keys/id', passwordEnc: 'abc' }]))
  writeFileSync(join(dir, 'github.json'), JSON.stringify({ tokenEnc: 'xyz' }))
  mkdirSync(join(dir, 'assistant'))
  writeFileSync(join(dir, 'assistant', 'config.json'), JSON.stringify({ model: 'claude-sonnet-5-5', keyEnc: 'secret' }))
  mkdirSync(join(dir, 'models'))
  writeFileSync(join(dir, 'models', 'ggml-base.bin'), 'model')
  mkdirSync(join(dir, 'Local Storage'))
  return dir
}

describe('v3.0 lot 4: profile', () => {
  it('erases every personal entry, keeps the dictation models and Chromium', () => {
    const dir = profile()
    const gone = wipeData(dir)
    expect(gone).toEqual(expect.arrayContaining(['settings.json', 'projects.json', 'ssh-connections.json', 'github.json', 'assistant']))
    expect(readdirSync(dir).sort()).toEqual(['Local Storage', 'models'])
  })

  it('exports the setup without any secret', () => {
    const e = exportConfig(profile(), '3.0.0', new Date('2026-10-26T10:00:00Z'))
    expect(e).toMatchObject({ app: 'DevForge', format: 1, version: '3.0.0', exportedAt: '2026-10-26T10:00:00.000Z' })
    expect(Object.keys(e.files).sort()).toEqual(['assistant/config.json', 'projects.json', 'settings.json', 'ssh-connections.json'])
    expect(JSON.stringify(e)).not.toMatch(/Enc|abc|xyz|secret/)
    expect((e.files['ssh-connections.json'] as { privateKeyPath: string }[])[0].privateKeyPath).toBe('C:/keys/id')
    expect(stripSecrets({ a: [{ password: 'p', apiKey: 'k', token: 't', name: 'n' }] })).toEqual({ a: [{ name: 'n' }] })
  })

  it('imports an export on another profile, after a backup; refuses anything else', () => {
    const exported = JSON.stringify(exportConfig(profile(), '3.0.0'))
    const other = tempDir('other')
    writeFileSync(join(other, 'settings.json'), JSON.stringify({ language: 'en', onboarded: false }))
    expect(importConfig(other, exported).sort()).toEqual(['assistant/config.json', 'projects.json', 'settings.json', 'ssh-connections.json'])
    expect(JSON.parse(readFileSync(join(other, 'settings.json'), 'utf-8'))).toMatchObject({ language: 'fr', onboarded: true })
    expect(JSON.parse(readFileSync(join(other, 'projects.json'), 'utf-8'))[0].name).toBe('shop')
    expect(existsSync(join(other, 'backups'))).toBe(true)
    expect(() => importConfig(other, '{"hello":1}')).toThrow('NOT_AN_EXPORT')
    expect(() => importConfig(other, 'pas du json')).toThrow('NOT_AN_EXPORT')
    // An unknown file name is never written
    importConfig(other, JSON.stringify({ app: 'DevForge', format: 1, files: { 'settings.json': {}, '../evil.json': {} } }))
    expect(existsSync(join(other, '..', 'evil.json'))).toBe(false)
  })
})
