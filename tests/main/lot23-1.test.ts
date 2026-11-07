import { describe, expect, it } from 'vitest'
import { composeFile, composeName, composeSlug, isDbAuthError, oldVolumes, planSetup } from '../../src/shared/lib/projectSetup'

/** v2.3 lot 1: each project's own Docker database */
describe('v2.3 lot 1: Docker databases of their own', () => {
  const setup = { database: 'postgres' as const, dbName: 'boutique', dbPort: 5433, features: [], git: false, github: null, openVSCode: false }

  it('names compose after the project, with a short id', () => {
    expect(composeSlug('Mon Site 2')).toBe('mon-site-2')
    expect(composeSlug('__')).toBe('projet')
    expect(composeName('Boutique', 'a1b2c3')).toBe('boutique-a1b2c3')
    expect(composeFile('symfony', setup, 'boutique-a1b2c3').startsWith('name: boutique-a1b2c3\n\nservices:\n')).toBe(true)
    expect(composeFile('symfony', setup).startsWith('services:\n')).toBe(true)
    const steps = planSetup({ name: 'boutique', framework: 'nextjs', packageManager: 'npm', typescript: true, eslint: true, setup },
      { password: 'pw', secret: 's', lang: 'fr', composeName: 'boutique-a1b2c3' })
    const compose = steps.find(s => s.kind === 'write' && s.files.some(f => f.path === 'compose.yaml'))
    expect(compose?.kind === 'write' && compose.files[0].content).toContain('name: boutique-a1b2c3')
  })

  it('finds the database an earlier project of this name left', () => {
    const volumes = ['boutique_database_data', 'boutique-0f9e8d_database_data', 'boutique-shop_database_data', 'mon_site_database_data', 'boutique_n8n']
    expect(oldVolumes('Boutique', volumes)).toEqual(['boutique_database_data', 'boutique-0f9e8d_database_data'])
    expect(oldVolumes('Mon Site', volumes)).toEqual(['mon_site_database_data'])
    expect(oldVolumes('atelier', volumes)).toEqual([])
  })

  it('knows a refused password, from Postgres, MySQL or Prisma', () => {
    expect(isDbAuthError('SQLSTATE[08006] [7] FATAL:  password authentication failed for user "app"')).toBe(true)
    expect(isDbAuthError("SQLSTATE[HY000] [1045] Access denied for user 'root'@'172.18.0.1'")).toBe(true)
    expect(isDbAuthError('P1000: Authentication failed against database server')).toBe(true)
    expect(isDbAuthError('SQLSTATE[08006] Connection refused')).toBe(false)
    expect(isDbAuthError(null)).toBe(false)
  })
})
