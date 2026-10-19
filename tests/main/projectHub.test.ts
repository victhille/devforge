import { mkdirSync, writeFileSync } from 'fs'
import { join } from 'path'
import { beforeEach, describe, expect, it } from 'vitest'
import { saveProjects, tempDir, userData } from '../helpers'
import { getActiveProject, getProjectHub, linkResource, setActiveProject } from '../../src/main/services/projects/projectHub'

const write = (path: string, data: unknown) => writeFileSync(path, typeof data === 'string' ? data : JSON.stringify(data))

describe('project hub', () => {
  let dir: string
  beforeEach(() => {
    dir = tempDir('shop')
    write(join(dir, '.env'), 'PORT=4321\nDATABASE_URL=postgres://app:secret@localhost:5432/shop\n')
    write(join(dir, '.env.example'), 'PORT=\n')
    mkdirSync(join(dir, 'storage', 'logs'), { recursive: true })
    write(join(dir, 'storage', 'logs', 'laravel.log'), 'boot\n')
    write(join(dir, 'data.sqlite'), '')
    saveProjects([{ name: 'Shop', path: dir }])
    write(join(userData(), 'databases.json'), [
      { id: 'pg-shop', name: 'Shop DB', type: 'postgres', host: 'localhost', port: 5432, database: 'shop', color: '' },
      { id: 'pg-other', name: 'Other', type: 'postgres', host: 'localhost', port: 5432, database: 'other', color: '' },
      { id: 'lite', name: 'Local file', type: 'sqlite', file: join(dir, 'data.sqlite'), color: '' }
    ])
    write(join(userData(), 'domains.json'), [
      { id: 'd1', domain: 'shop.test', port: 4321, enabled: true },
      { id: 'd2', domain: 'other.test', port: 9000, enabled: true }
    ])
    write(join(userData(), 'deploy.json'), { targets: [{ id: 't1', name: 'Prod', connectionId: 's', remotePath: '/srv', script: 'ls', projectPath: dir }], runs: [] })
    write(join(userData(), 'project-links.json'), {})
  })

  it('finds what belongs to the project, never the .env values', async () => {
    const hub = await getProjectHub('p0')
    expect(hub.project.name).toBe('Shop')
    expect(hub.databases.map(d => d.id).sort()).toEqual(['lite', 'pg-shop'])
    expect(hub.databases.every(d => d.origin === 'auto')).toBe(true)
    expect(hub.logs.map(l => l.path)).toEqual([join(dir, 'storage', 'logs', 'laravel.log')])
    expect(hub.ports).toEqual([{ port: 4321, source: '.env PORT' }])
    expect(hub.domains.map(d => d.domain)).toEqual(['shop.test'])
    expect(hub.deployTargets).toEqual([{ id: 't1', name: 'Prod' }])
    expect(hub.envFiles).toEqual(expect.arrayContaining([{ name: '.env', keys: 2 }]))
    expect(JSON.stringify(hub)).not.toContain('secret')
  })

  it('lets the user untie a found resource and tie another one', async () => {
    let hub = await linkResource('p0', 'databases', 'pg-shop', false)
    expect(hub.databases.map(d => d.id)).toEqual(['lite'])
    expect(hub.hidden.databases).toEqual(['pg-shop'])

    hub = await linkResource('p0', 'databases', 'pg-other', true)
    expect(hub.databases.find(d => d.id === 'pg-other')?.origin).toBe('manual')

    // Tying the hidden one again brings it back as found
    hub = await linkResource('p0', 'databases', 'pg-shop', true)
    expect(hub.databases.find(d => d.id === 'pg-shop')?.origin).toBe('auto')
    expect(hub.hidden.databases).toEqual([])

    await expect(linkResource('p0', 'secrets' as never, 'x', true)).rejects.toThrow()
    await expect(getProjectHub('nope')).rejects.toThrow()
  })

  it('remembers the active project and forgets a removed one', () => {
    expect(getActiveProject()).toBeNull()
    setActiveProject('p0')
    expect(getActiveProject()).toBe('p0')
    expect(() => setActiveProject('nope')).toThrow()
    saveProjects([])
    expect(getActiveProject()).toBeNull()
    setActiveProject(null)
    expect(getActiveProject()).toBeNull()
  })
})
