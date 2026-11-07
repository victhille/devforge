import { mkdirSync, writeFileSync } from 'fs'
import { join } from 'path'
import { describe, expect, it } from 'vitest'
import { findSubProjects, scanDirectory } from '../../src/main/services/projects/projectScanner'
import { configDirs, detectLocal } from '../../src/main/services/database/dbDetect'
import { saveProject } from '../../src/main/services/projects/projectStorage'
import { tempDir } from '../helpers'

/** v3.5 lot 2: a folder holding several projects (backend/ + frontend/) is a group */
const file = (path: string, content = '{}') => { mkdirSync(join(path, '..'), { recursive: true }); writeFileSync(path, content) }
const pkg = (dir: string, deps: Record<string, string>) => file(join(dir, 'package.json'), JSON.stringify({ dependencies: deps }))
const composer = (dir: string, req: Record<string, string>) => file(join(dir, 'composer.json'), JSON.stringify({ require: req }))

describe('v3.5: groups of projects', () => {
  it('finds a back and a front in a folder that is not a project, skipping dependencies and hidden folders', async () => {
    const root = tempDir('scan')
    const fm = join(root, 'FreelanceManager')
    composer(join(fm, 'backend'), { 'symfony/framework-bundle': '7.*' })
    pkg(join(fm, 'frontend'), { react: '^19' })
    pkg(join(fm, 'node_modules', 'left-pad'), {})
    pkg(join(fm, '.cache', 'x'), {})
    file(join(fm, 'compose.yaml'), 'services: {}')
    pkg(join(root, 'blog'), { next: '^16' })

    const found = await scanDirectory(root)
    expect(found.map(p => [p.name, p.framework])).toEqual([['blog', 'nextjs'], ['FreelanceManager', 'group']])
    expect(found[1].subprojects!.map(s => [s.name, s.framework])).toEqual([['backend', 'symfony'], ['frontend', 'react']])
  })

  it('looks two levels deep at most, and keeps a project with sub-folders as one project', async () => {
    const root = tempDir('scan')
    pkg(join(root, 'mono', 'apps', 'web'), { vue: '^3' })
    pkg(join(root, 'mono', 'a', 'b', 'too-deep'), { vue: '^3' })
    pkg(join(root, 'site'), { react: '^19' })
    pkg(join(root, 'site', 'docs'), { vue: '^3' })

    expect((await findSubProjects(join(root, 'mono'))).map(s => s.name)).toEqual(['apps/web'])
    const site = (await scanDirectory(root)).find(p => p.name === 'site')!
    expect(site.framework).toBe('react')
    expect(site.subprojects).toBeUndefined()
  })

  it('finds the database of a group in its back\'s .env, named after the group and the project', async () => {
    const root = tempDir('db')
    const fm = join(root, 'FreelanceManager')
    composer(join(fm, 'backend'), { 'laravel/framework': '^12' })
    file(join(fm, 'backend', '.env'), 'DB_CONNECTION=pgsql\nDB_HOST=127.0.0.1\nDB_PORT=5433\nDB_DATABASE=freelance\nDB_USERNAME=app\n')
    pkg(join(fm, 'frontend'), { react: '^19' })
    saveProject({ id: 'g1', name: 'FreelanceManager', path: fm, framework: 'group', packageManager: 'npm', createdAt: '', lastOpenedAt: null, favorite: false })

    expect((await configDirs({ name: 'FreelanceManager', path: fm, framework: 'group' })).map(d => d.label))
      .toEqual(['FreelanceManager/backend', 'FreelanceManager/frontend'])
    const dbs = await detectLocal()
    expect(dbs).toEqual([expect.objectContaining({ type: 'postgres', port: 5433, database: 'freelance', origin: 'FreelanceManager/backend/.env' })])
  })
})
