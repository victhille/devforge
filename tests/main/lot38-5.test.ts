import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { describe, expect, it } from 'vitest'
import { DEFAULT_EXCLUDE, isExcluded, isSecretFile, packFiles, parseExclude, renameIn, unpackFiles } from '@shared/lib/userTemplates'
import { planSetup } from '@shared/lib/projectSetup'
import { extractTemplate, listTemplates, previewTemplate, refreshTemplate, removeTemplate, renameTemplate, saveTemplate } from '../../src/main/services/projects/userTemplates'
import { tempDir } from '../helpers'

/** v3.8 lot 5: my project templates */

describe('what a template leaves out', () => {
  it('never takes a .env, but keeps the examples', () => {
    for (const f of ['.env', '.env.local', '.env.production', '.env.prod.local']) expect(isSecretFile(f)).toBe(true)
    for (const f of ['.env.example', '.env.sample', '.envrc.md', 'env.ts']) expect(isSecretFile(f)).toBe(false)
    expect(isExcluded('config/.env.local', [])).toBe(true)
    expect(isExcluded('.env.example', DEFAULT_EXCLUDE)).toBe(false)
  })

  it('matches a name anywhere, a glob, or a path', () => {
    expect(isExcluded('node_modules/react/index.js', DEFAULT_EXCLUDE)).toBe(true)
    expect(isExcluded('packages/app/node_modules/x.js', DEFAULT_EXCLUDE)).toBe(true)
    expect(isExcluded('var/cache/dev/a.php', DEFAULT_EXCLUDE)).toBe(true)
    expect(isExcluded('src/var/cache.ts', DEFAULT_EXCLUDE)).toBe(false)
    expect(isExcluded('logs/app.log', ['*.log'])).toBe(true)
    expect(isExcluded('src/build.ts', DEFAULT_EXCLUDE)).toBe(false)
    expect(parseExclude(' node_modules \n\n/dist/, *.log\nnode_modules\nvar\\cache')).toEqual(['node_modules', 'dist', '*.log', 'var/cache'])
  })
})

describe('the project name, replaced', () => {
  it('in package.json and its lock, keeping the indentation', () => {
    expect(renameIn('package.json', '{\n    "name": "starter",\n    "version": "1.0.0"\n}\n', 'starter', 'My-Shop')).toBe('{\n    "name": "my-shop",\n    "version": "1.0.0"\n}\n')
    const lock = renameIn('package-lock.json', JSON.stringify({ name: 'starter', packages: { '': { name: 'starter' } } }), 'starter', 'shop')
    expect(JSON.parse(lock!)).toEqual({ name: 'shop', packages: { '': { name: 'shop' } } })
  })

  it('in composer.json, pyproject.toml, Cargo.toml and the README title, only where it named the project', () => {
    expect(JSON.parse(renameIn('composer.json', '{"name": "acme/starter"}', 'starter', 'shop')!).name).toBe('acme/shop')
    expect(renameIn('composer.json', '{"name": "acme/other"}', 'starter', 'shop')).toBeNull()
    expect(renameIn('pyproject.toml', '[project]\nname = "starter"\nversion = "0.1"\n', 'starter', 'shop')).toBe('[project]\nname = "shop"\nversion = "0.1"\n')
    expect(renameIn('Cargo.toml', '[package]\nname = "starter"\n', 'starter', 'my-shop')).toBe('[package]\nname = "my_shop"\n')
    expect(renameIn('README.md', '# Starter API\n\nstarter is great', 'starter', 'shop')).toBe('# shop API\n\nstarter is great')
    expect(renameIn('README.md', '# Something else', 'starter', 'shop')).toBeNull()
    expect(renameIn('src/index.ts', 'starter', 'starter', 'shop')).toBeNull()
  })
})

describe('the archive', () => {
  it('packs and unpacks files, bytes as they are', () => {
    const files = [{ path: 'a.txt', data: new TextEncoder().encode('héllo') }, { path: 'img/x.bin', data: new Uint8Array([0, 255, 7]) }, { path: 'empty', data: new Uint8Array() }]
    const back = unpackFiles(packFiles(files))
    expect(back.map(f => [f.path, [...f.data]])).toEqual(files.map(f => [f.path, [...f.data]]))
  })

  it('refuses a path that would leave the folder', () => {
    for (const path of ['../evil', 'a/../../b', '/etc/x', 'C:/x', 'a\\b']) {
      expect(() => unpackFiles(packFiles([{ path, data: new Uint8Array([1]) }]))).toThrow(/Unsafe/)
    }
    expect(() => unpackFiles(new Uint8Array([0, 0, 0, 2, 123, 125]))).toThrow(/Not a DevForge template/)
  })
})

describe('the plan of a project from a template', () => {
  const setup = { database: 'none' as const, dbName: '', dbPort: 0, features: [], git: true, github: { repo: 'shop', private: true }, openVSCode: true }
  const base = { name: 'shop', framework: 'symfony' as const, packageManager: 'pnpm' as const, typescript: false, eslint: false, setup, template: 'tpl' }
  const ctx = { password: 'x', secret: 'y', lang: 'fr' as const, composeName: '' }

  it('installs its dependencies, then a new Git history, GitHub and the IDE, nothing of the framework', () => {
    const steps = planSetup(base, ctx)
    const cmds = steps.filter(s => s.kind === 'run').map(s => s.kind === 'run' ? `${s.exe} ${s.args.join(' ')}` : '')
    expect(cmds).toEqual(['pnpm install', 'composer install', 'git init -b main', 'git add -A', 'git commit -m "chore: initial commit (DevForge)"', 'gh repo create shop --private --source . --push', 'code .'])
    expect(steps.find(s => s.kind === 'run' && s.exe === 'git' && s.args[0] === 'init')).toMatchObject({ skipIf: '.git' })
    expect(planSetup({ ...base, installDeps: false }, ctx).some(s => s.kind === 'run' && s.args[0] === 'install')).toBe(false)
  })
})

describe('templates kept in DevForge data', () => {
  it('saves a project without node_modules, .git or .env; creates a renamed copy; updates, renames, deletes', async () => {
    const project = join(tempDir('tpl'), 'starter')
    const put = (p: string, s: string) => { mkdirSync(join(project, p, '..'), { recursive: true }); writeFileSync(join(project, p), s) }
    put('package.json', '{\n  "name": "starter",\n  "scripts": { "start": "node index.js" }\n}\n')
    put('index.js', 'console.log("hi")')
    put('README.md', '# starter\n')
    put('.env', 'SECRET=1')
    put('.env.local', 'SECRET=2')
    put('.env.example', 'SECRET=')
    put('node_modules/dep/index.js', 'x')
    put('.git/HEAD', 'ref: refs/heads/main')
    put('src/app.ts', 'export {}')

    const preview = await previewTemplate(project, DEFAULT_EXCLUDE)
    expect(preview).toMatchObject({ files: 5, tooBig: false })
    expect(preview.skipped).toEqual(['.env', '.env.local', '.git', 'node_modules'])

    const tpl = await saveTemplate({ projectPath: project, name: 'Node starter', description: 'API', framework: 'nodejs', packageManager: 'npm', exclude: DEFAULT_EXCLUDE })
    expect(tpl).toMatchObject({ name: 'Node starter', sourceName: 'starter', files: 5 })
    expect(listTemplates().map(t => t.id)).toContain(tpl.id)

    const dest = join(tempDir('tpl-out'), 'my-shop')
    expect(await extractTemplate(tpl.id, dest, 'my-shop')).toBe(5)
    expect(JSON.parse(readFileSync(join(dest, 'package.json'), 'utf-8')).name).toBe('my-shop')
    expect(readFileSync(join(dest, 'README.md'), 'utf-8')).toBe('# my-shop\n')
    expect(readFileSync(join(dest, '.env.example'), 'utf-8')).toBe('SECRET=')
    for (const gone of ['.env', '.env.local', 'node_modules', '.git']) expect(existsSync(join(dest, gone))).toBe(false)
    expect(existsSync(join(dest, 'src/app.ts'))).toBe(true)

    put('src/new.ts', 'export const x = 1')
    expect((await refreshTemplate(tpl.id)).files).toBe(6)
    renameTemplate(tpl.id, 'Node API', 'With tests')
    expect(listTemplates().find(t => t.id === tpl.id)).toMatchObject({ name: 'Node API', description: 'With tests' })
    removeTemplate(tpl.id)
    expect(listTemplates().some(t => t.id === tpl.id)).toBe(false)
  })
})
