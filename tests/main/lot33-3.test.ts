import { mkdirSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { afterEach, describe, expect, it } from 'vitest'
import { tempDir } from '../helpers'
import { fitsRange } from '@shared/lib/packages'
import {
  composerCommands, composerUpdate, isSail, listComposerManifests, newestStable, parseComposerAudit
} from '../../src/main/services/packages/composerPackages'

/** v3.3 lot 3: a project's Composer packages, main side */
const json = (path: string, data: unknown) => writeFileSync(path, JSON.stringify(data))

function laravel(): string {
  const root = tempDir('composer')
  json(join(root, 'composer.json'), {
    name: 'acme/shop',
    require: { php: '^8.2', 'ext-pdo': '*', 'laravel/framework': '^11.0', 'guzzlehttp/guzzle': '^7.2' },
    'require-dev': { 'phpunit/phpunit': '^10.5' }
  })
  writeFileSync(join(root, 'composer.lock'), '{}')
  mkdirSync(join(root, 'vendor', 'composer'), { recursive: true })
  json(join(root, 'vendor', 'composer', 'installed.json'), { packages: [{ name: 'laravel/framework', version: 'v11.9.2' }, { name: 'phpunit/phpunit', version: '10.5.20' }] })
  return root
}

afterEach(() => { delete process.env.DEVFORGE_TEST_PACKAGES })

describe('v3.3 lot 3: Composer packages', () => {
  it('reads composer.json and what is installed, without the platform (php, ext-*)', () => {
    const [m] = listComposerManifests(laravel())
    expect(m).toMatchObject({ dir: '', file: 'composer.json', name: 'acme/shop', manager: 'composer' })
    expect(m.packages).toEqual([
      { name: 'guzzlehttp/guzzle', wanted: '^7.2', installed: null, dev: false },
      { name: 'laravel/framework', wanted: '^11.0', installed: '11.9.2', dev: false },
      { name: 'phpunit/phpunit', wanted: '^10.5', installed: '10.5.20', dev: true }
    ])
  })

  it('takes the newest stable version from Packagist, and understands Composer ranges', () => {
    expect(newestStable([{ version: 'v12.0.0-RC1' }, { version: 'dev-main' }, { version: 'v11.31.0' }, { version: 'v11.30.0' }])).toBe('11.31.0')
    expect(newestStable([{ version: 'dev-master' }])).toBeNull()
    expect(fitsRange('8.1.0', '^7.0|^8.0')).toBe(true)
    expect(fitsRange('8.1.0', '^7.0 || ^8.0')).toBe(true)
    expect(fitsRange('11.2.0', '^11.0@stable')).toBe(true)
    expect(fitsRange('12.0.0', '^11.0')).toBe(false)
  })

  it('reads composer audit, an empty one included', () => {
    expect(parseComposerAudit(JSON.stringify({
      advisories: { 'guzzlehttp/guzzle': [{ severity: 'high' }, { severity: null }], 'symfony/http-kernel': { 0: { severity: 'critical' } } }
    }))).toEqual({ total: 3, bySeverity: { info: 0, low: 0, moderate: 1, high: 1, critical: 1 }, packages: { 'guzzlehttp/guzzle': 'high', 'symfony/http-kernel': 'critical' } })
    expect(parseComposerAudit(JSON.stringify({ advisories: [], abandoned: [] }))).toMatchObject({ total: 0, packages: {} })
    expect(parseComposerAudit('nope')).toBeNull()
  })

  it('builds the commands, on this PC or in Sail\'s container, names checked', () => {
    const u = [
      { name: 'guzzlehttp/guzzle', dev: false, target: 'compatible' as const },
      { name: 'laravel/framework', dev: false, target: 'latest' as const },
      { name: 'phpunit/phpunit', dev: true, target: 'latest' as const },
      { name: 'evil/x;rm', dev: false, target: 'latest' as const }
    ]
    const latest = { 'laravel/framework': '12.1.0', 'phpunit/phpunit': '11.4.0', 'evil/x;rm': '1.0.0' }
    expect(composerCommands(u, latest)).toEqual([
      'composer update guzzlehttp/guzzle --with-dependencies --no-interaction',
      'composer require laravel/framework:^12.1.0 --no-interaction',
      'composer require phpunit/phpunit:^11.4.0 --dev --no-interaction'
    ])
    expect(composerCommands(u.slice(0, 1), {}, true)).toEqual(['docker compose exec -T -u sail laravel.test composer update guzzlehttp/guzzle --with-dependencies --no-interaction'])
    // No known latest version: nothing to require
    expect(composerCommands([{ name: 'a/b', dev: false, target: 'latest' }], {})).toEqual([])
  })

  it('knows a Sail project, and puts composer.json back when the update fails', async () => {
    const root = laravel()
    expect(isSail(root)).toBe(false)
    writeFileSync(join(root, 'compose.yaml'), 'services:\n    laravel.test:\n        image: sail-8.3/app\n')
    expect(isSail(root)).toBe(true)

    const data = join(tempDir('t'), 'packages.json')
    process.env.DEVFORGE_TEST_PACKAGES = data
    json(data, { update: `node -e "require('fs').writeFileSync('composer.json','broken');process.exit(1)"` })
    const before = readFileSync(join(root, 'composer.json'), 'utf-8')
    const lines: string[] = []
    expect(await composerUpdate(root, [{ name: 'guzzlehttp/guzzle', dev: false, target: 'compatible' }], l => lines.push(l))).toEqual({ ok: false, restored: true })
    expect(readFileSync(join(root, 'composer.json'), 'utf-8')).toBe(before)
    expect(lines.join('\n')).toContain('composer.json and composer.lock put back')
  })
})
