import { describe, expect, it } from 'vitest'
import { isSailCompose, laravelCommandLine } from '../../src/shared/lib/laravelCommands'
import { planSetup, sailEnv, stepCommand } from '../../src/shared/lib/projectSetup'

/** v2.3 lot 5: Laravel Sail, driven through docker compose */
describe('v2.3 lot 5: Laravel Sail', () => {
  it('runs PHP in the app container, starts and stops with docker compose', () => {
    expect(laravelCommandLine('migrate', '', true)).toBe('docker compose exec -T -u sail laravel.test php artisan migrate --no-interaction')
    expect(laravelCommandLine('composer:install', '', true)).toBe('docker compose exec -T -u sail laravel.test composer install --no-interaction')
    expect(laravelCommandLine('db:start', '', true)).toBe('docker compose up -d --wait')
    expect(laravelCommandLine('serve', '', true)).toBe('docker compose up -d --wait')
    expect(laravelCommandLine('sail:stop', '', true)).toBe('docker compose stop')
    expect(laravelCommandLine('serve')).toBe('php artisan serve')
    expect(laravelCommandLine('db:start')).toBe('docker compose up -d --wait database')
  })

  it('knows a Sail compose file', () => {
    expect(isSailCompose("services:\n    laravel.test:\n        build:\n")).toBe(true)
    expect(isSailCompose("services:\n  database:\n    image: postgres\n")).toBe(false)
  })

  it('.env for Sail: the service as host, the chosen ports, the user of the containers', () => {
    const s = { database: 'postgres' as const, dbName: 'escale', dbPort: 5482, appPort: 8091, features: ['docker' as const], git: false, github: null, openVSCode: false }
    expect(sailEnv(s, 'pw')).toEqual({
      DB_CONNECTION: 'pgsql', DB_HOST: 'pgsql', DB_PORT: '5432', DB_DATABASE: 'escale', DB_USERNAME: 'app', DB_PASSWORD: 'pw',
      FORWARD_DB_PORT: '5482', APP_PORT: '8091', WWWUSER: '1000', WWWGROUP: '1000'
    })
    expect(sailEnv({ ...s, database: 'sqlite' }, 'pw')).toEqual({ DB_CONNECTION: 'sqlite', APP_PORT: '8091', WWWUSER: '1000', WWWGROUP: '1000' })
  })

  it('creation with Docker: Sail in place of DevForge\'s compose.yaml, its testing database left out', () => {
    const steps = planSetup({
      name: 'escale', framework: 'laravel', packageManager: 'npm', typescript: false, eslint: false,
      setup: { database: 'mysql', dbName: 'escale', dbPort: 3307, appPort: 8091, features: ['docker'], git: false, github: null, openVSCode: false }
    }, { password: 'pw', secret: 's', lang: 'fr', composeName: 'escale-a1b2c3' })
    const lines = steps.map(stepCommand)
    expect(lines).toContain('composer require laravel/sail --dev')
    expect(lines).toContain('php artisan sail:install --with=mysql --no-interaction')
    expect(lines).toContain('− /docker-entrypoint-initdb.d/ → compose.yaml')
    expect(lines).toContain('docker compose up -d --wait')
    expect(lines.join('\n')).not.toContain('+ compose.yaml')
    expect(lines.join('\n')).not.toContain('.env.docker')
    // DB_* written after sail:install, which writes its own
    const order = (kind: string) => steps.findIndex(s => s.kind === kind || ('args' in s && s.args.includes('sail:install')))
    expect(steps.findIndex(s => s.kind === 'env' && s.file === '.env')).toBeGreaterThan(order('sail:install'))
  })
})
