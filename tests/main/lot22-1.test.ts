import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { describe, expect, it } from 'vitest'
import type { ProjectCreationOptions, ProjectSetup, SetupStep } from '../../src/shared/types'
import { composeFile, databaseUrl, dockerEnv, planSetup, pmAdd, stepCommand } from '../../src/shared/lib/projectSetup'
import { mergeEnv, mergeIgnore, runSetup } from '../../src/main/services/projects/projectSetup'
import { listDbConnections } from '../../src/main/services/database/dbStorage'
import { enableExtensions, requiredExtensions } from '../../src/main/services/projects/phpCheck'
import { tempDir } from '../helpers'

const setup = (s: Partial<ProjectSetup> = {}): ProjectSetup => ({
  database: 'postgres', dbName: 'boutique', dbPort: 5433, features: [], git: false, github: null, openVSCode: false, ...s
})
const opts = (framework: 'symfony' | 'nextjs', s: Partial<ProjectSetup> = {}) => ({
  name: 'boutique', framework, packageManager: 'npm' as const, typescript: true, eslint: true, setup: setup(s)
})
const ctx = { password: 'pw', secret: 'sec', lang: 'fr' as const, composeName: 'boutique-a1b2c3' }
const runs = (steps: SetupStep[]) => steps.filter(s => s.kind === 'run').map(s => stepCommand(s))

describe('v2.2 lot 1: project setup plan', () => {
  it('Symfony + Postgres: Doctrine, .env.local, compose, start, connection', () => {
    const steps = planSetup(opts('symfony'), ctx)
    expect(runs(steps)).toEqual(['npm install', 'composer require symfony/orm-pack', 'docker compose up -d --wait database'])
    const env = steps.find(s => s.kind === 'env' && s.file === '.env.local')
    expect(env).toMatchObject({ vars: { DATABASE_URL: 'postgresql://app:pw@127.0.0.1:5433/boutique?serverVersion=16&charset=utf8' } })
    expect(steps.find(s => s.kind === 'connection')).toMatchObject({ type: 'postgres', port: 5433, user: 'app', database: 'boutique' })
    // The password never lands in a committed file
    const written = steps.flatMap(s => s.kind === 'write' ? s.files.map(f => f.content) : []).join('\n')
    expect(written).not.toContain('pw@')
    expect(steps.find(s => s.kind === 'ignore')).toMatchObject({ lines: ['/.env.docker'] })
    expect(steps.find(s => s.kind === 'env' && s.file === '.env.docker')).toMatchObject({ vars: { POSTGRES_PASSWORD: 'pw' } })
  })

  it('Next.js + MySQL: Prisma with the chosen package manager, root user', () => {
    const steps = planSetup({ ...opts('nextjs', { database: 'mysql', dbPort: 3307 }), packageManager: 'pnpm' }, ctx)
    expect(runs(steps).slice(1, 5)).toEqual(['pnpm add -D prisma@7 dotenv', 'pnpm add @prisma/client@7', 'pnpm add @prisma/adapter-mariadb@7', 'npx prisma init --datasource-provider mysql --output ../{src}generated/prisma --no-skills'])
    expect(steps.find(s => s.kind === 'env' && s.file === '.env')).toMatchObject({ vars: { DATABASE_URL: 'mysql://root:pw@localhost:3307/boutique' } })
  })

  it('SQLite needs no Docker', () => {
    const steps = planSetup(opts('symfony', { database: 'sqlite' }), ctx)
    expect(steps.some(s => s.kind === 'write' && s.files.some(f => f.path === 'compose.yaml'))).toBe(false)
    expect(runs(steps)).not.toContain('docker compose up -d --wait database')
    expect(databaseUrl('nextjs', setup({ database: 'sqlite' }), 'pw')).toBe('file:./dev.db')
  })

  it('options per framework', () => {
    const sf = planSetup(opts('symfony', { database: 'none', features: ['api', 'auth', 'docker', 'tests', 'ci'] }), ctx)
    const files = sf.flatMap(s => s.kind === 'write' ? s.files.map(f => f.path) : [])
    expect(files).toEqual(expect.arrayContaining(['src/Controller/HealthController.php', 'tests/SmokeTest.php', 'Dockerfile', '.github/workflows/ci.yml', 'compose.yaml']))
    expect(runs(sf)).toContain('php bin/console make:user User --identity-property-name=email --with-password --no-interaction')

    const next = planSetup(opts('nextjs', { database: 'none', features: ['api', 'auth', 'tests'] }), ctx)
    expect(next.flatMap(s => s.kind === 'write' ? s.files.map(f => f.path) : [])).toEqual([
      '{app}/api/health/route.ts', '{src}auth.ts', '{app}/api/auth/[...nextauth]/route.ts', 'tests/smoke.test.ts'
    ])
    expect(next.find(s => s.kind === 'scripts')).toMatchObject({ scripts: { test: 'vitest run' } })
    expect(next.find(s => s.kind === 'env' && s.file === '.env.local')).toMatchObject({ vars: { AUTH_SECRET: 'sec' } })
  })

  it('compose: the app reaches the database by its service name', () => {
    const s = setup({ features: ['docker'] })
    const yaml = composeFile('symfony', s)
    expect(yaml).toContain('"127.0.0.1:5433:5432"')
    expect(yaml).toContain('condition: service_healthy')
    expect(dockerEnv('symfony', s, 'pw').DATABASE_URL).toBe('postgresql://app:pw@database:5432/boutique?serverVersion=16&charset=utf8')
  })

  it('Git and GitHub come last, for every framework', () => {
    const steps = planSetup({ ...opts('symfony', { database: 'none', git: true, github: { repo: 'victhille/boutique', private: true }, openVSCode: true }), framework: 'react' }, ctx)
    expect(runs(steps)).toEqual([
      'npm install', 'git init -b main', 'git add -A', 'git commit -m "chore: initial commit (DevForge)"',
      'gh repo create victhille/boutique --private --source . --push', 'code .'
    ])
  })

  it('package manager commands', () => {
    expect(pmAdd('npm', ['a'], true)).toEqual(['install', '--save-dev', 'a'])
    expect(pmAdd('yarn', ['a'], true)).toEqual(['add', '--dev', 'a'])
  })
})

describe('v2.2 lot 1: PHP extensions for Symfony', () => {
  it('needs the driver of the chosen database', () => {
    expect(requiredExtensions('postgres')).toContain('pdo_pgsql')
    expect(requiredExtensions('none')).not.toContain('pdo_pgsql')
    expect(requiredExtensions('none')).toContain('openssl')
  })

  it('uncomments the lines, adds the unknown ones, keeps the rest', () => {
    const ini = '[PHP]\r\nextension_dir = "ext"\r\n;extension=openssl\r\n; extension = php_intl.dll\r\nextension=curl\r\n;extension=zip ; a note\r\n'
    expect(enableExtensions(ini, ['openssl', 'intl', 'curl', 'pdo_pgsql'])).toBe(
      '[PHP]\r\nextension_dir = "ext"\r\nextension=openssl\r\nextension=intl\r\nextension=curl\r\n;extension=zip ; a note\r\n; Added by DevForge\r\nextension=pdo_pgsql\r\n'
    )
    expect(enableExtensions(ini, ['bad name; rm'])).toBe(ini)
  })
})

describe('v2.2 lot 1: running the setup', () => {
  it('merges .env and .gitignore lines', () => {
    expect(mergeEnv('APP_ENV=dev\nDATABASE_URL="old"\n', { DATABASE_URL: 'new', X: '1' })).toBe('APP_ENV=dev\nDATABASE_URL="new"\nX="1"\n')
    expect(mergeIgnore('/vendor/\n', ['/.env.docker'])).toBe('/vendor/\n/.env.docker\n')
    expect(mergeIgnore('/vendor/\n.env.docker\n', ['/.env.docker'])).toBe('/vendor/\n.env.docker\n')
  })

  it('writes the files, skips what exists and saves the connection', async () => {
    const dir = tempDir('sf')
    mkdirSync(join(dir, 'vendor/doctrine/orm'), { recursive: true })
    writeFileSync(join(dir, '.env.local'), 'APP_SECRET=x\n')
    const options = { ...opts('symfony', { database: 'sqlite', features: ['api', 'ci'] }), destination: dir, installDeps: false, initGit: false, openAfter: false } as ProjectCreationOptions
    const lines: string[] = []
    const result = await new Promise<string>(resolve => runSetup(options, dir, 't1', l => lines.push(l.text), r => resolve(r.status)))
    expect(result).toBe('success')
    expect(lines.some(l => l.includes('déjà en place'))).toBe(true)
    expect(readFileSync(join(dir, '.env.local'), 'utf-8')).toBe('APP_SECRET=x\nDATABASE_URL="sqlite:///%kernel.project_dir%/var/data.db"\n')
    expect(existsSync(join(dir, 'src/Controller/HealthController.php'))).toBe(true)
    expect(existsSync(join(dir, '.github/workflows/ci.yml'))).toBe(true)
    expect(listDbConnections()).toEqual([expect.objectContaining({ name: 'boutique', type: 'sqlite', file: join(dir, 'var/data.db') })])
  })
})
