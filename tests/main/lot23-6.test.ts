import { mkdirSync, writeFileSync } from 'fs'
import { join } from 'path'
import { afterEach, describe, expect, it } from 'vitest'
import type { Project } from '../../src/shared/types'
import { saveProjects, tempDir, userData } from '../helpers'
import { workshopModelsText, workshopOf } from '../../src/main/services/assistant/workshopTools'

const project = (path: string, name = 'site'): Project => ({ id: 'p', name, path, framework: 'nodejs', packageManager: 'npm', favorite: false, createdAt: '', lastOpenedAt: null } as unknown as Project)

/** v2.3 lot 6: Forgy in the three workshops */
describe('v2.3 lot 6: Forgy and the workshops', () => {
  afterEach(() => { delete process.env.DEVFORGE_TEST_NEXTJS })

  it('finds the workshop of a project', () => {
    const lv = tempDir('lv')
    writeFileSync(join(lv, 'composer.json'), JSON.stringify({ require: { 'laravel/framework': '^13.0' } }))
    expect(workshopOf(project(lv))).toBe('laravel')
    const sf = tempDir('sf')
    writeFileSync(join(sf, 'composer.json'), JSON.stringify({ require: { 'symfony/framework-bundle': '7.3.*' } }))
    expect(workshopOf(project(sf))).toBe('symfony')
    const nx = tempDir('nx')
    writeFileSync(join(nx, 'package.json'), JSON.stringify({ dependencies: { next: '16.0.0' } }))
    expect(() => workshopOf(project(nx))).toThrow('has no workshop')
    mkdirSync(join(nx, 'prisma'))
    writeFileSync(join(nx, 'prisma', 'schema.prisma'), 'datasource db {\n  provider = "postgresql"\n}\n')
    expect(workshopOf(project(nx))).toBe('nextjs')
  })

  it('gives Forgy the models and the SQL of what is pending', async () => {
    const dir = tempDir('next')
    mkdirSync(join(dir, 'prisma'))
    writeFileSync(join(dir, 'package.json'), JSON.stringify({ dependencies: { next: '16.0.0' }, devDependencies: { prisma: '7.0.0' } }))
    writeFileSync(join(dir, 'prisma', 'schema.prisma'), 'datasource db {\n  provider = "postgresql"\n}\n\nmodel Note {\n  id    Int    @id @default(autoincrement())\n  texte String\n}\n')
    saveProjects([{ name: 'site', path: dir }])
    const canned = join(userData(), 'nextjs.json')
    writeFileSync(canned, JSON.stringify({
      database: { reachable: true, error: null },
      migrations: [{ version: '20261026090000_revert_catalogue', description: '', executed: false, executedAt: null, file: '', sql: ['DROP TABLE "Produit"'], dangerous: true }]
    }))
    process.env.DEVFORGE_TEST_NEXTJS = canned
    const text = await workshopModelsText(project(dir))
    expect(text).toContain('Next.js (Prisma models)')
    expect(text).toContain('Note (prisma/schema.prisma)\n  texte: string, required')
    expect(text).toContain('Pending migration 20261026090000_revert_catalogue (DROPS DATA):\nDROP TABLE "Produit"')
  })
})
