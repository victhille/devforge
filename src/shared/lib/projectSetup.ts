import type { Framework, PackageManager, ProjectCreationOptions, ProjectSetup, SetupFeature, SetupStep } from '../types'

/**
 * v2.2 lot 1: what DevForge does after the framework's own creation command.
 * Pure, so the summary shows the very steps the main process then runs.
 * In written paths, {app} is the Next.js app folder (app or src/app) and {src}
 * the alias root ("" or "src/"); the main process resolves them.
 */

/** Frameworks that get the database and options steps (the others: Git and GitHub only) */
export const SETUP_FRAMEWORKS: Framework[] = ['symfony', 'nextjs', 'laravel']
export const SETUP_FEATURES: SetupFeature[] = ['api', 'auth', 'docker', 'tests', 'ci']
export const DEFAULT_DB_PORT = { postgres: 5432, mysql: 3306 } as const

export const REPO_RE = /^[\w.-]+(\/[\w.-]+)?$/
export const DB_NAME_RE = /^[a-zA-Z_][\w]{0,62}$/

export interface PlanContext {
  /** Local database password; the summary passes a placeholder */
  password: string
  /** Auth.js secret; same */
  secret: string
  lang: 'fr' | 'en'
}

type Opts = Pick<ProjectCreationOptions, 'name' | 'framework' | 'packageManager' | 'typescript' | 'eslint'> & { setup: ProjectSetup }

const LABELS = {
  fr: {
    orm: 'Doctrine (ORM)', compose: 'compose.yaml', envDb: 'DATABASE_URL', ignore: '.gitignore', start: 'Démarrage de la base',
    connection: 'Ajout à la page Base de données', api: 'Première route d\'API', authDeps: 'Sécurité', maker: 'MakerBundle',
    user: 'Entité User', authJs: 'Auth.js', authFiles: 'Configuration Auth.js', docker: 'Docker pour l\'app', testDeps: 'Outils de test',
    firstTest: 'Premier test', ci: 'CI GitHub Actions', prisma: 'Prisma', prismaInit: 'Schéma Prisma', scripts: 'Script de test',
    sanctum: 'API (Sanctum)', fortify: 'Laravel Fortify', fortifyInstall: 'Connexion et inscription',
    gitInit: 'Dépôt Git', gitAdd: 'Fichiers suivis', gitCommit: 'Premier commit', github: 'Dépôt GitHub', vscode: 'Ouverture dans VS Code'
  },
  en: {
    orm: 'Doctrine (ORM)', compose: 'compose.yaml', envDb: 'DATABASE_URL', ignore: '.gitignore', start: 'Starting the database',
    connection: 'Adding it to the Database page', api: 'First API route', authDeps: 'Security', maker: 'MakerBundle',
    user: 'User entity', authJs: 'Auth.js', authFiles: 'Auth.js setup', docker: 'Docker for the app', testDeps: 'Test tools',
    firstTest: 'First test', ci: 'GitHub Actions CI', prisma: 'Prisma', prismaInit: 'Prisma schema', scripts: 'Test script',
    sanctum: 'API (Sanctum)', fortify: 'Laravel Fortify', fortifyInstall: 'Login and registration',
    gitInit: 'Git repository', gitAdd: 'Tracked files', gitCommit: 'First commit', github: 'GitHub repository', vscode: 'Opening in VS Code'
  }
}

export function pmAdd(pm: PackageManager, pkgs: string[], dev = false): string[] {
  if (pm === 'npm') return ['install', ...(dev ? ['--save-dev'] : []), ...pkgs]
  return ['add', ...(dev ? [pm === 'yarn' ? '--dev' : '-D'] : []), ...pkgs]
}

/** Database URL as the app sees it: from this PC, or from the app container */
export function databaseUrl(fw: Framework, s: ProjectSetup, password: string, inDocker = false): string {
  const host = inDocker ? 'database' : fw === 'nextjs' ? 'localhost' : '127.0.0.1'
  const port = inDocker ? DEFAULT_DB_PORT[s.database as 'postgres' | 'mysql'] : s.dbPort
  if (fw === 'laravel') {
    // DB_URL: Laravel reads it over the DB_* lines (used in the app container)
    if (s.database === 'sqlite') return 'sqlite:///database/database.sqlite'
    if (s.database === 'mysql') return `mysql://root:${password}@${host}:${port}/${s.dbName}`
    return `pgsql://app:${password}@${host}:${port}/${s.dbName}`
  }
  if (fw === 'symfony') {
    if (s.database === 'sqlite') return 'sqlite:///%kernel.project_dir%/var/data.db'
    if (s.database === 'mysql') return `mysql://root:${password}@${host}:${port}/${s.dbName}?serverVersion=8.4&charset=utf8mb4`
    return `postgresql://app:${password}@${host}:${port}/${s.dbName}?serverVersion=16&charset=utf8`
  }
  if (s.database === 'sqlite') return 'file:./dev.db'
  if (s.database === 'mysql') return `mysql://root:${password}@${host}:${port}/${s.dbName}`
  return `postgresql://app:${password}@${host}:${port}/${s.dbName}?schema=public`
}

const serverDb = (s: ProjectSetup) => s.database === 'postgres' || s.database === 'mysql'

/** compose.yaml: the database (Postgres or MySQL) and, with the Docker option, the app */
export function composeFile(fw: Framework, s: ProjectSetup): string {
  const lines = ['services:']
  const envFile = ['    env_file:', '      - path: .env.docker', '        required: false']
  if (s.database === 'postgres') {
    lines.push(
      '  database:', '    image: postgres:16-alpine', '    environment:', `      POSTGRES_DB: ${s.dbName}`, '      POSTGRES_USER: app', ...envFile,
      '    ports:', `      - "127.0.0.1:${s.dbPort}:5432"`, '    volumes:', '      - database_data:/var/lib/postgresql/data',
      '    healthcheck:', `      test: ["CMD", "pg_isready", "-U", "app", "-d", "${s.dbName}"]`, '      interval: 5s', '      timeout: 5s', '      retries: 10'
    )
  } else if (s.database === 'mysql') {
    lines.push(
      '  database:', '    image: mysql:8.4', '    environment:', `      MYSQL_DATABASE: ${s.dbName}`, ...envFile,
      '    ports:', `      - "127.0.0.1:${s.dbPort}:3306"`, '    volumes:', '      - database_data:/var/lib/mysql',
      '    healthcheck:', '      test: ["CMD-SHELL", "mysqladmin ping -h 127.0.0.1 -uroot -p$$MYSQL_ROOT_PASSWORD"]', '      interval: 5s', '      timeout: 5s', '      retries: 20'
    )
  }
  if (s.features.includes('docker')) {
    lines.push('  app:', '    build: .', ...envFile, '    ports:', fw === 'nextjs' ? '      - "3000:3000"' : '      - "8080:80"')
    if (serverDb(s)) lines.push('    depends_on:', '      database:', '        condition: service_healthy')
  }
  if (serverDb(s)) lines.push('', 'volumes:', '  database_data:')
  return lines.join('\n') + '\n'
}

/** .env.docker (never committed): the database password, and the URL the app container uses */
export function dockerEnv(fw: Framework, s: ProjectSetup, password: string): Record<string, string> {
  const vars: Record<string, string> = {}
  if (s.database === 'postgres') vars.POSTGRES_PASSWORD = password
  if (s.database === 'mysql') vars.MYSQL_ROOT_PASSWORD = password
  if (s.features.includes('docker') && s.database !== 'none') {
    vars[fw === 'laravel' ? 'DB_URL' : 'DATABASE_URL'] = s.database === 'sqlite' ? databaseUrl(fw, s, password) : databaseUrl(fw, s, password, true)
  }
  return vars
}

function ciWorkflow(o: Opts): string {
  const head = ['name: CI', '', 'on:', '  push:', '  pull_request:', '', 'jobs:', '  build:', '    runs-on: ubuntu-latest', '    steps:', '      - uses: actions/checkout@v4']
  const tests = o.setup.features.includes('tests')
  if (o.framework === 'symfony') {
    return [...head,
      '      - uses: shivammathur/setup-php@v2', '        with:', "          php-version: '8.4'",
      '      - run: composer install --no-interaction --prefer-dist',
      '      - run: php bin/console lint:container',
      ...(tests ? ['      - run: vendor/bin/phpunit'] : [])
    ].join('\n') + '\n'
  }
  if (o.framework === 'laravel') {
    return [...head,
      '      - uses: shivammathur/setup-php@v2', '        with:', "          php-version: '8.4'",
      '      - run: composer install --no-interaction --prefer-dist',
      '      - run: cp .env.example .env && php artisan key:generate',
      ...(tests ? ['      - run: php artisan test'] : [])
    ].join('\n') + '\n'
  }
  const pm = o.packageManager
  const install = pm === 'npm' ? 'npm ci' : `${pm} install --frozen-lockfile`
  return [...head,
    ...(pm === 'pnpm' ? ['      - uses: pnpm/action-setup@v4'] : []),
    '      - uses: actions/setup-node@v4', '        with:', '          node-version: 22', `          cache: ${pm}`,
    `      - run: ${install}`,
    ...(o.setup.database !== 'none' ? ['      - run: npx prisma generate'] : []),
    ...(o.eslint ? [`      - run: ${pm} run lint`] : []),
    ...(tests ? [`      - run: ${pm} run test`] : []),
    `      - run: ${pm} run build`
  ].join('\n') + '\n'
}

function dockerFiles(o: Opts): { path: string; content: string }[] {
  if (o.framework === 'laravel') {
    return [
      { path: 'Dockerfile', content: [
        '# FrankenPHP: Caddy and PHP in one image, serves public/',
        'FROM dunglas/frankenphp:1-php8.4',
        'RUN install-php-extensions pdo_pgsql pdo_mysql intl zip opcache bcmath',
        'COPY --from=composer:2 /usr/bin/composer /usr/bin/composer',
        'ENV SERVER_NAME=:80 APP_ENV=production',
        'WORKDIR /app',
        'COPY . /app',
        'RUN composer install --no-dev --optimize-autoloader',
        ''
      ].join('\n') },
      { path: '.dockerignore', content: ['.git', 'vendor', 'node_modules', '.env', '.env.docker', 'storage/logs/*', ''].join('\n') }
    ]
  }
  if (o.framework === 'symfony') {
    return [
      { path: 'Dockerfile', content: [
        '# FrankenPHP: Caddy and PHP in one image, serves public/',
        'FROM dunglas/frankenphp:1-php8.4',
        'RUN install-php-extensions pdo_pgsql pdo_mysql intl zip opcache',
        'COPY --from=composer:2 /usr/bin/composer /usr/bin/composer',
        'ENV SERVER_NAME=:80 APP_ENV=prod',
        'WORKDIR /app',
        'COPY . /app',
        'RUN composer install --no-dev --optimize-autoloader --no-scripts',
        ''
      ].join('\n') },
      { path: '.dockerignore', content: ['.git', 'vendor', 'var', '.env.local', '.env.docker', ''].join('\n') }
    ]
  }
  const pm = o.packageManager
  const install = pm === 'npm' ? 'npm ci' : `corepack enable && ${pm} install --frozen-lockfile`
  return [
    { path: 'Dockerfile', content: [
      'FROM node:22-alpine',
      'WORKDIR /app',
      'COPY . .',
      `RUN ${install}`,
      ...(o.setup.database !== 'none' ? ['RUN npx prisma generate'] : []),
      `RUN ${pm} run build`,
      'EXPOSE 3000',
      `CMD ["${pm}", "run", "start"]`,
      ''
    ].join('\n') },
    { path: '.dockerignore', content: ['.git', 'node_modules', '.next', '.env*', ''].join('\n') }
  ]
}

const SF_HEALTH = `<?php

namespace App\\Controller;

use Symfony\\Bundle\\FrameworkBundle\\Controller\\AbstractController;
use Symfony\\Component\\HttpFoundation\\JsonResponse;
use Symfony\\Component\\Routing\\Attribute\\Route;

final class HealthController extends AbstractController
{
    #[Route('/api/health', name: 'api_health', methods: ['GET'])]
    public function __invoke(): JsonResponse
    {
        return $this->json(['status' => 'ok']);
    }
}
`

const SF_TEST = `<?php

namespace App\\Tests;

use Symfony\\Bundle\\FrameworkBundle\\Test\\KernelTestCase;

final class SmokeTest extends KernelTestCase
{
    public function testTheKernelBoots(): void
    {
        self::bootKernel();
        $this->assertSame('test', self::$kernel->getEnvironment());
    }
}
`

function symfonySteps(o: Opts, ctx: PlanContext): SetupStep[] {
  const s = o.setup, l = LABELS[ctx.lang], steps: SetupStep[] = []
  const has = (f: SetupFeature) => s.features.includes(f)
  if (s.database !== 'none') {
    steps.push({ kind: 'run', label: l.orm, exe: 'composer', args: ['require', 'symfony/orm-pack'], skipIf: 'vendor/doctrine/orm' })
    steps.push({ kind: 'env', label: l.envDb, file: '.env.local', vars: { DATABASE_URL: databaseUrl('symfony', s, ctx.password) } })
  }
  if (has('api')) steps.push({ kind: 'write', label: l.api, files: [{ path: 'src/Controller/HealthController.php', content: SF_HEALTH }] })
  if (has('auth')) {
    steps.push({ kind: 'run', label: l.authDeps, exe: 'composer', args: ['require', 'symfony/security-bundle'], skipIf: 'vendor/symfony/security-bundle' })
    steps.push({ kind: 'run', label: l.maker, exe: 'composer', args: ['require', '--dev', 'symfony/maker-bundle'], skipIf: 'vendor/symfony/maker-bundle' })
    steps.push({ kind: 'run', label: l.user, exe: 'php', args: ['bin/console', 'make:user', 'User', ...(s.database !== 'none' ? ['--is-entity'] : []), '--identity-property-name=email', '--with-password', '--no-interaction'], optional: true })
  }
  if (has('tests')) {
    steps.push({ kind: 'run', label: l.testDeps, exe: 'composer', args: ['require', '--dev', 'symfony/test-pack'], skipIf: 'vendor/phpunit/phpunit' })
    steps.push({ kind: 'write', label: l.firstTest, files: [{ path: 'tests/SmokeTest.php', content: SF_TEST }] })
  }
  return steps
}

/** Laravel reads DB_* from .env (never committed): the skeleton starts on SQLite */
export function laravelEnv(s: ProjectSetup, password: string): Record<string, string> {
  if (s.database === 'sqlite') return { DB_CONNECTION: 'sqlite' }
  const mysql = s.database === 'mysql'
  return {
    DB_CONNECTION: mysql ? 'mysql' : 'pgsql', DB_HOST: '127.0.0.1', DB_PORT: String(s.dbPort),
    DB_DATABASE: s.dbName, DB_USERNAME: mysql ? 'root' : 'app', DB_PASSWORD: password
  }
}

function laravelSteps(o: Opts, ctx: PlanContext): SetupStep[] {
  const s = o.setup, l = LABELS[ctx.lang], steps: SetupStep[] = []
  const has = (f: SetupFeature) => s.features.includes(f)
  if (s.database !== 'none') steps.push({ kind: 'env', label: l.envDb, file: '.env', vars: laravelEnv(s, ctx.password) })
  // routes/api.php and Sanctum; the tables come with the first migration in the workshop
  if (has('api')) steps.push({ kind: 'run', label: l.sanctum, exe: 'php', args: ['artisan', 'install:api', '--without-migration-prompt', '--no-interaction'], skipIf: 'routes/api.php' })
  if (has('auth')) {
    steps.push({ kind: 'run', label: l.fortify, exe: 'composer', args: ['require', 'laravel/fortify'], skipIf: 'vendor/laravel/fortify' })
    steps.push({ kind: 'run', label: l.fortifyInstall, exe: 'php', args: ['artisan', 'fortify:install', '--no-interaction'], skipIf: 'config/fortify.php' })
  }
  // tests: the skeleton already has PHPUnit and two tests
  return steps
}

function nextSteps(o: Opts, ctx: PlanContext): SetupStep[] {
  const s = o.setup, l = LABELS[ctx.lang], pm = o.packageManager, steps: SetupStep[] = []
  const has = (f: SetupFeature) => s.features.includes(f)
  const ext = o.typescript ? 'ts' : 'js'
  if (s.database !== 'none') {
    const provider = s.database === 'postgres' ? 'postgresql' : s.database
    steps.push({ kind: 'run', label: l.prisma, exe: pm, args: pmAdd(pm, ['prisma', 'dotenv'], true) })
    steps.push({ kind: 'run', label: l.prisma, exe: pm, args: pmAdd(pm, ['@prisma/client']) })
    steps.push({ kind: 'run', label: l.prismaInit, exe: 'npx', args: ['prisma', 'init', '--datasource-provider', provider], skipIf: 'prisma/schema.prisma' })
    steps.push({ kind: 'env', label: l.envDb, file: '.env', vars: { DATABASE_URL: databaseUrl('nextjs', s, ctx.password) } })
  }
  if (has('api')) {
    steps.push({ kind: 'write', label: l.api, files: [{ path: `{app}/api/health/route.${ext}`, content: "export function GET() {\n  return Response.json({ status: 'ok' })\n}\n" }] })
  }
  if (has('auth')) {
    steps.push({ kind: 'run', label: l.authJs, exe: pm, args: pmAdd(pm, ['next-auth@beta']) })
    steps.push({ kind: 'write', label: l.authFiles, files: [
      { path: `{src}auth.${ext}`, content: "import NextAuth from 'next-auth'\n\n// Add providers here (GitHub, Google, Credentials…)\nexport const { handlers, auth, signIn, signOut } = NextAuth({ providers: [] })\n" },
      { path: `{app}/api/auth/[...nextauth]/route.${ext}`, content: "import { handlers } from '@/auth'\n\nexport const { GET, POST } = handlers\n" }
    ] })
    steps.push({ kind: 'env', label: 'AUTH_SECRET', file: '.env.local', vars: { AUTH_SECRET: ctx.secret } })
  }
  if (has('tests')) {
    steps.push({ kind: 'run', label: l.testDeps, exe: pm, args: pmAdd(pm, ['vitest', '@types/node@24'], true) })
    steps.push({ kind: 'write', label: l.firstTest, files: [{ path: `tests/smoke.test.${ext}`, content: "import { expect, test } from 'vitest'\n\ntest('the test setup works', () => {\n  expect(1 + 1).toBe(2)\n})\n" }] })
    steps.push({ kind: 'scripts', label: l.scripts, scripts: { test: 'vitest run' } })
  }
  return steps
}

/** Every step after the framework's creation, in order */
export function planSetup(o: Opts, ctx: PlanContext): SetupStep[] {
  const s = o.setup, l = LABELS[ctx.lang], steps: SetupStep[] = []
  if (SETUP_FRAMEWORKS.includes(o.framework)) {
    steps.push(...(o.framework === 'symfony' ? symfonySteps(o, ctx) : o.framework === 'laravel' ? laravelSteps(o, ctx) : nextSteps(o, ctx)))
    const docker = s.features.includes('docker')
    if (serverDb(s) || docker) {
      steps.push({ kind: 'ignore', label: l.ignore, lines: ['/.env.docker'] })
      steps.push({ kind: 'env', label: '.env.docker', file: '.env.docker', vars: dockerEnv(o.framework, s, ctx.password) })
      steps.push({ kind: 'write', label: l.compose, files: [{ path: 'compose.yaml', content: composeFile(o.framework, s) }] })
    }
    if (docker) steps.push({ kind: 'write', label: l.docker, files: dockerFiles(o) })
    if (s.features.includes('ci')) steps.push({ kind: 'write', label: l.ci, files: [{ path: '.github/workflows/ci.yml', content: ciWorkflow(o) }] })
    if (serverDb(s)) {
      steps.push({ kind: 'run', label: l.start, exe: 'docker', args: ['compose', 'up', '-d', '--wait', 'database'], optional: true })
    }
    if (s.database !== 'none') {
      const sqliteFile = { symfony: 'var/data.db', laravel: 'database/database.sqlite' }[o.framework as string] ?? 'prisma/dev.db'
      steps.push({
        kind: 'connection', label: l.connection, type: s.database as 'postgres' | 'mysql' | 'sqlite',
        port: s.dbPort, user: s.database === 'mysql' ? 'root' : 'app', database: s.dbName,
        ...(s.database === 'sqlite' ? { file: sqliteFile } : {})
      })
    }
  }
  if (s.git || s.github) {
    steps.push({ kind: 'run', label: l.gitInit, exe: 'git', args: ['init'], skipIf: '.git' })
    steps.push({ kind: 'run', label: l.gitAdd, exe: 'git', args: ['add', '-A'] })
    steps.push({ kind: 'run', label: l.gitCommit, exe: 'git', args: ['commit', '-m', '"chore: initial commit (DevForge)"'], optional: true })
  }
  if (s.github) {
    steps.push({ kind: 'run', label: l.github, exe: 'gh', args: ['repo', 'create', s.github.repo, s.github.private ? '--private' : '--public', '--source', '.', '--push'], optional: true })
  }
  if (s.openVSCode) steps.push({ kind: 'run', label: l.vscode, exe: 'code', args: ['.'], optional: true })
  return steps
}

/** One line per step for the summary: the command, or what is written */
export function stepCommand(step: SetupStep): string {
  switch (step.kind) {
    case 'run':        return `${step.exe} ${step.args.join(' ')}`
    case 'write':      return step.files.map(f => `+ ${f.path}`).join('\n')
    case 'env':        return `${Object.keys(step.vars).join(', ')} → ${step.file}`
    case 'ignore':     return `${step.lines.join(' ')} → .gitignore`
    case 'scripts':    return Object.entries(step.scripts).map(([k, v]) => `"${k}": "${v}" → package.json`).join('\n')
    case 'connection': return step.label
  }
}
