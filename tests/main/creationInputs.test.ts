import { describe, expect, it } from 'vitest'
import { join } from 'path'
import { createProject } from '../../src/main/services/projects/projectCreator'
import { isPackageSpec } from '@shared/lib/packages'
import { REPO_RE } from '@shared/lib/projectSetup'
import { PROJECT_LIBRARIES } from '@shared/data/projectLibraries'
import { tempDir } from '../helpers'

/**
 * A new project's libraries, GitHub repository and stack go into commands run through a shell, a
 * compose.yaml started at once, its .env files and its welcome page. The window only offers its
 * catalog and checks its fields, but the main process does not rely on it: what a window or a
 * template sends is checked again before anything runs.
 */
const nowhere = () => join(tempDir(), 'missing')
const SETUP = { database: 'postgres', dbName: 'shop', dbPort: 5432, features: ['api'], git: true, github: null, openVSCode: false }
const create = (options: Record<string, unknown>) => () => createProject(
  { name: 'shop', framework: 'react', packageManager: 'npm', destination: nowhere(), ...options } as never,
  () => {}, () => {}
)
const withSetup = (setup: Record<string, unknown>) => create({ setup: { ...SETUP, ...setup } })

describe('the packages a new project installs', () => {
  it('takes a name, with a version or not', () => {
    for (const spec of ['zod', '@prisma/client@7', 'prisma@7', 'next-auth@beta', '@types/node@24']) expect(isPackageSpec(spec)).toBe(true)
  })

  it('refuses anything a shell would read, and what is not a string', () => {
    for (const spec of ['x & calc', 'zod@1 & calc', 'zod@^1', 'zod@>1', 'a|b', 'zod@', '-g', 'Zod', '', 42, null]) expect(isPackageSpec(spec)).toBe(false)
  })

  it('refuses what npm would read as a folder or a file instead of a package', () => {
    for (const spec of ['zod@..', 'zod@.', 'zod@-1', 'evil.tgz', 'evil.tar', 'evil.tar.gz', 'evil.tar-gz', 'zod@evil.tgz', 'zod@x.tar']) expect(isPackageSpec(spec)).toBe(false)
  })

  it('lets every library of the catalog through', () => {
    const specs = PROJECT_LIBRARIES.flatMap(l => [...l.packages, ...(l.devPackages ?? [])])
    expect(specs.filter(s => !isPackageSpec(s))).toEqual([])
  })
})

describe('the GitHub repository of a new project', () => {
  it('is a name or owner/name, never an option', () => {
    for (const repo of ['shop', 'me/shop', 'me/.github', 'my_org/shop.v2']) expect(REPO_RE.test(repo)).toBe(true)
    for (const repo of ['--clone', 'me/-x', 'a & calc', 'a/b/c', '']) expect(REPO_RE.test(repo)).toBe(false)
  })
})

describe('create-project checks what the window sent', () => {
  it('refuses a library that is not a package, and a list that is not one', () => {
    expect(create({ libraries: ['zod', 'x & calc'] })).toThrow('Invalid library "x & calc"')
    expect(create({ devLibraries: ['a|b'] })).toThrow('Invalid library "a|b"')
    expect(create({ libraries: 'zod' })).toThrow('Invalid library list')
  })

  it('refuses a repository that is not one', () => {
    expect(withSetup({ github: { repo: 'a & calc', private: true } })).toThrow('Invalid GitHub repository "a & calc"')
    expect(withSetup({ github: { repo: '--clone', private: true } })).toThrow('Invalid GitHub repository')
    expect(withSetup({ github: { private: true } })).toThrow('Invalid GitHub repository')
  })

  it('refuses a stack that would write into compose.yaml, the .env files or the welcome page', () => {
    expect(withSetup({ database: 'oracle' })).toThrow('Invalid database "oracle"')
    expect(withSetup({ dbName: 'shop"\n    privileged: true' })).toThrow('Invalid database name')
    expect(withSetup({ dbPort: '1:1"\n    privileged: true' })).toThrow('Invalid database port')
    expect(withSetup({ dbPort: 70000 })).toThrow('Invalid database port')
    expect(withSetup({ appPort: '{process.exit()}' })).toThrow('Invalid app port')
    expect(withSetup({ features: ['api', 'rm'] })).toThrow('Invalid project features')
    expect(withSetup({ features: 'api' })).toThrow('Invalid project features')
    expect(withSetup({ apiUrl: ['http://x'] })).toThrow('Invalid API address')
    expect(withSetup({ apiUrl: "http://x'+require('child_process')" })).toThrow('Invalid API address')
  })

  it('refuses a project name read as an option', () => {
    expect(create({ name: '--yes' })).toThrow('Invalid project name "--yes"')
    expect(create({ name: '-g' })).toThrow('Invalid project name')
    expect(create({ name: ['shop'] })).toThrow('Invalid project name')
  })

  it('goes on with valid ones, up to the next check', () => {
    const next = 'Destination directory does not exist'
    expect(create({ libraries: ['zod', '@prisma/client@7'], devLibraries: ['vitest'] })).toThrow(next)
    expect(withSetup({ github: { repo: 'me/shop', private: true } })).toThrow(next)
    // No database server: its name and port are not used, the window sends 0
    expect(withSetup({ database: 'sqlite', dbName: '', dbPort: 0 })).toThrow(next)
    expect(withSetup({ database: 'mysql', dbPort: 3307, appPort: 8000, features: [] })).toThrow(next)
  })
})
