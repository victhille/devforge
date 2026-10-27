import { mkdirSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { afterEach, describe, expect, it } from 'vitest'
import { tempDir } from '../helpers'
import {
  findManifestDirs, latestVersions, listManifests, managerOf, manifestDir, parseAudit, parseYarnAudit, update, updateCommands
} from '../../src/main/services/packages/npmPackages'

/** v3.3 lot 2: a project's npm packages, main side */
const json = (path: string, data: unknown) => writeFileSync(path, JSON.stringify(data))

function monorepo(): string {
  const root = tempDir('pkgs')
  json(join(root, 'package.json'), { name: 'shop', dependencies: { react: '^18.2.0' }, devDependencies: { vitest: '^1.0.0' }, packageManager: 'pnpm@9.0.0' })
  writeFileSync(join(root, 'pnpm-lock.yaml'), 'lockfileVersion: 9\n')
  mkdirSync(join(root, 'node_modules', 'react'), { recursive: true })
  json(join(root, 'node_modules', 'react', 'package.json'), { version: '18.2.0' })
  mkdirSync(join(root, 'apps', 'web'), { recursive: true })
  json(join(root, 'apps', 'web', 'package.json'), { name: 'web', dependencies: { react: '^18.0.0', '@types/node': '^20.0.0', 'bad name': '1.0.0' } })
  // Never read: dependencies of dependencies
  mkdirSync(join(root, 'node_modules', 'react', 'node_modules'), { recursive: true })
  json(join(root, 'node_modules', 'react', 'node_modules', 'package.json'), { name: 'deep' })
  return root
}

afterEach(() => { delete process.env.DEVFORGE_TEST_PACKAGES })

describe('v3.3 lot 2: npm packages', () => {
  it('finds every package.json but node_modules, with what is installed (hoisted too)', () => {
    const root = monorepo()
    expect(findManifestDirs(root).map(d => d.slice(root.length).replace(/\\/g, '/'))).toEqual(['', '/apps/web'])
    const [top, web] = listManifests(root)
    expect(top).toMatchObject({ dir: '', file: 'package.json', name: 'shop', manager: 'pnpm' })
    expect(top.packages).toEqual([
      { name: 'react', wanted: '^18.2.0', installed: '18.2.0', dev: false },
      { name: 'vitest', wanted: '^1.0.0', installed: null, dev: true }
    ])
    // The workspace's react is the root's (hoisted); a bad name is left out; the manager comes from the root's lockfile
    expect(web).toMatchObject({ dir: 'apps/web', name: 'web', manager: 'pnpm' })
    expect(web.packages.map(p => [p.name, p.installed])).toEqual([['@types/node', null], ['react', '18.2.0']])
  })

  it('picks the manager from the lockfile', () => {
    const root = tempDir('mgr')
    json(join(root, 'package.json'), {})
    expect(managerOf(root, root)).toBe('npm')
    writeFileSync(join(root, 'yarn.lock'), '')
    expect(managerOf(root, root)).toBe('yarn')
  })

  it('refuses a folder outside the project, or without a package.json', () => {
    const root = monorepo()
    expect(manifestDir(root, 'apps/web')).toBe(join(root, 'apps', 'web'))
    expect(() => manifestDir(root, '..')).toThrow('Invalid folder')
    expect(() => manifestDir(root, 'apps')).toThrow('No package.json')
  })

  it('reads the audit reports of npm, pnpm and yarn 1', () => {
    const npm = parseAudit(JSON.stringify({
      vulnerabilities: { lodash: { severity: 'high' }, minimist: { severity: 'low' } },
      metadata: { vulnerabilities: { info: 0, low: 1, moderate: 0, high: 1, critical: 0, total: 2 } }
    }))
    expect(npm).toEqual({ total: 2, bySeverity: { info: 0, low: 1, moderate: 0, high: 1, critical: 0 }, packages: { lodash: 'high', minimist: 'low' } })
    const pnpm = parseAudit(JSON.stringify({
      advisories: { 1: { module_name: 'axios', severity: 'moderate' }, 2: { module_name: 'axios', severity: 'critical' } },
      metadata: { vulnerabilities: { info: 0, low: 0, moderate: 1, high: 0, critical: 1 } }
    }))
    expect(pnpm?.packages).toEqual({ axios: 'critical' })
    expect(pnpm?.total).toBe(2)
    const yarn = parseYarnAudit([
      JSON.stringify({ type: 'auditAdvisory', data: { advisory: { module_name: 'ws', severity: 'high' } } }),
      JSON.stringify({ type: 'auditSummary', data: { vulnerabilities: { info: 0, low: 0, moderate: 0, high: 1, critical: 0 } } })
    ].join('\n'))
    expect(yarn).toMatchObject({ total: 1, packages: { ws: 'high' } })
    expect(parseAudit('not json')).toBeNull()
    expect(parseYarnAudit('')).toBeNull()
  })

  it('builds each manager\'s commands, dependencies and dev ones apart, names checked', () => {
    const u = [
      { name: 'react', dev: false, target: 'compatible' as const },
      { name: 'vite', dev: true, target: 'latest' as const },
      { name: 'next', dev: false, target: 'latest' as const },
      { name: 'x;evil', dev: false, target: 'latest' as const }
    ]
    expect(updateCommands('npm', u)).toEqual(['npm update react', 'npm install next@latest', 'npm install vite@latest --save-dev'])
    expect(updateCommands('pnpm', u)).toEqual(['pnpm update react', 'pnpm add next@latest', 'pnpm add vite@latest -D'])
    expect(updateCommands('yarn', u)).toEqual(['yarn upgrade react', 'yarn add next@latest', 'yarn add vite@latest --dev'])
    expect(updateCommands('yarn', u, true)).toEqual(['yarn up -R react', 'yarn up next@latest', 'yarn up vite@latest'])
    expect(updateCommands('npm', [])).toEqual([])
  })

  it('tells Forgy what is behind, and how (v3.3 lot 4)', async () => {
    const root = monorepo()
    const data = join(tempDir('t'), 'packages.json')
    json(data, { latest: { react: '18.3.1', vitest: '2.0.0', '@types/node': '22.0.0' }, audit: { total: 1, bySeverity: { info: 0, low: 0, moderate: 0, high: 1, critical: 0 }, packages: { react: 'high' } } })
    process.env.DEVFORGE_TEST_PACKAGES = data
    const { packagesReport } = await import('../../src/main/services/assistant/packageTools')
    const report = await packagesReport({ id: 'p', name: 'Shop', path: root } as never, true)
    expect(report).toContain('package.json (pnpm): 2 packages, 2 to look at')
    expect(report).toContain('- react 18.2.0 → 18.3.1 (minor, within its range)')
    expect(report).toContain('- vitest: not installed (wants ^1.0.0, latest 2.0.0)')
    expect(report).toContain('apps/web/package.json (pnpm)')
    expect(report).toContain('Vulnerabilities: 1 (high 1) — react: high')
  })

  it('gives the latest versions; puts the manifest back when the update fails', async () => {
    const root = monorepo()
    const data = join(tempDir('t'), 'packages.json')
    const write = (o: object) => json(data, o)
    process.env.DEVFORGE_TEST_PACKAGES = data

    write({ latest: { react: '19.0.0' } })
    expect(await latestVersions(root, ['react', 'vitest', 'bad name'])).toEqual({ react: '19.0.0', vitest: null })

    const before = readFileSync(join(root, 'package.json'), 'utf-8')
    // A command that breaks package.json, then fails
    write({ update: `node -e "require('fs').writeFileSync('package.json','broken');process.exit(1)"` })
    const lines: string[] = []
    expect(await update(root, root, 'pnpm', [{ name: 'react', dev: false, target: 'latest' }], l => lines.push(l))).toEqual({ ok: false, restored: true })
    expect(readFileSync(join(root, 'package.json'), 'utf-8')).toBe(before)
    expect(lines.join('\n')).toContain('put back')

    write({ update: 'node -e "process.exit(0)"' })
    // Success says where the files were saved: Forgy's undo uses it
    expect(await update(root, root, 'pnpm', [{ name: 'react', dev: false, target: 'latest' }], () => {})).toMatchObject({ ok: true, restored: false, backup: { files: ['package.json', 'pnpm-lock.yaml'] } })
  })
})
