import { packageName } from '../data/projectLibraries'
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
  /** compose.yaml's project name (its own Docker volumes); the summary passes a placeholder */
  composeName: string
  lang: 'fr' | 'en'
}

type Opts = Pick<ProjectCreationOptions, 'name' | 'framework' | 'packageManager' | 'typescript' | 'eslint' | 'libraries' | 'devLibraries'> & { setup: ProjectSetup }

const LABELS = {
  fr: {
    orm: 'Doctrine (ORM)', compose: 'compose.yaml', envDb: 'DATABASE_URL', ignore: '.gitignore', start: 'Démarrage de la base',
    connection: 'Ajout à la page Base de données', api: 'Première route d\'API', authDeps: 'Sécurité', maker: 'MakerBundle',
    user: 'Entité User', authJs: 'Auth.js', authFiles: 'Configuration Auth.js', docker: 'Docker pour l\'app', testDeps: 'Outils de test',
    firstTest: 'Premier test', ci: 'CI GitHub Actions', prisma: 'Prisma', prismaInit: 'Schéma Prisma', scripts: 'Script de test',
    sanctum: 'API (Sanctum)', fortify: 'Laravel Fortify', fortifyInstall: 'Connexion et inscription',
    sail: 'Laravel Sail', sailInstall: 'Conteneurs Sail', sailInitScript: 'Base « testing » de Sail retirée (illisible hors WSL)', sailStart: 'Démarrage de Sail (construction de l\'image)',
    gitInit: 'Dépôt Git', gitAdd: 'Fichiers suivis', gitCommit: 'Premier commit', github: 'Dépôt GitHub', vscode: 'Ouverture dans VS Code',
    install: 'Installation des dépendances', tailwindDeps: 'Tailwind CSS (plugin)', tailwind: 'Configuration de Tailwind CSS',
    migrate: 'Tables de la base (migrations)', apiTokens: 'Jetons d\'API sur User (HasApiTokens)',
    prismaAdapter: 'Pilote de base pour Prisma', prismaClient: 'Client Prisma (lib/prisma)', entry: 'Point d\'entrée', startScripts: 'Scripts dev et start'
  },
  en: {
    orm: 'Doctrine (ORM)', compose: 'compose.yaml', envDb: 'DATABASE_URL', ignore: '.gitignore', start: 'Starting the database',
    connection: 'Adding it to the Database page', api: 'First API route', authDeps: 'Security', maker: 'MakerBundle',
    user: 'User entity', authJs: 'Auth.js', authFiles: 'Auth.js setup', docker: 'Docker for the app', testDeps: 'Test tools',
    firstTest: 'First test', ci: 'GitHub Actions CI', prisma: 'Prisma', prismaInit: 'Prisma schema', scripts: 'Test script',
    sanctum: 'API (Sanctum)', fortify: 'Laravel Fortify', fortifyInstall: 'Login and registration',
    sail: 'Laravel Sail', sailInstall: 'Sail containers', sailInitScript: 'Sail\'s "testing" database removed (unreadable outside WSL)', sailStart: 'Starting Sail (building the image)',
    gitInit: 'Git repository', gitAdd: 'Tracked files', gitCommit: 'First commit', github: 'GitHub repository', vscode: 'Opening in VS Code',
    install: 'Installing dependencies', tailwindDeps: 'Tailwind CSS (plugin)', tailwind: 'Tailwind CSS setup',
    migrate: 'Database tables (migrations)', apiTokens: 'API tokens on User (HasApiTokens)',
    prismaAdapter: 'Database driver for Prisma', prismaClient: 'Prisma client (lib/prisma)', entry: 'Entry point', startScripts: 'dev and start scripts'
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

/** Docker's name for a project: lowercase, digits, - and _ (MonSite 2 → monsite-2) */
export function composeSlug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^[^a-z0-9]+|-+$/g, '') || 'projet'
}

/**
 * compose.yaml's name: the project's name and a short id, so a project
 * created again under the same name gets new volumes, not the old database
 * (which keeps its old password)
 */
export const composeName = (name: string, id: string) => `${composeSlug(name)}-${id}`

/** Database volumes an earlier project of this name left: "boutique_database_data", "boutique-a1b2c3_database_data" */
export function oldVolumes(name: string, volumes: string[]): string[] {
  const slug = composeSlug(name).replace(/[-_]/g, '[-_]')
  const re = new RegExp(`^${slug}(-[0-9a-f]{6})?_database_data$`)
  return volumes.filter(v => re.test(v))
}

/** The database refuses the user or password (Postgres, MySQL), in any workshop */
export const isDbAuthError = (error: string | null | undefined) =>
  !!error && /password authentication failed|Access denied for user|P1000|Authentication failed against database/i.test(error)

/** compose.yaml: the database (Postgres or MySQL) and, with the Docker option, the app */
export function composeFile(fw: Framework, s: ProjectSetup, name?: string): string {
  const lines = [...(name ? [`name: ${name}`, ''] : []), 'services:']
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

/**
 * Sail's .env (v2.3 lot 5): the app reaches its database by the service's
 * name; the ports on this PC are the ones chosen here; WWWUSER and WWWGROUP
 * are what Sail's script would give (DevForge drives docker compose itself).
 */
export function sailEnv(s: ProjectSetup, password: string): Record<string, string> {
  const vars: Record<string, string> = { APP_PORT: String(s.appPort ?? 8000), WWWUSER: '1000', WWWGROUP: '1000' }
  if (s.database === 'sqlite') return { DB_CONNECTION: 'sqlite', ...vars }
  if (!serverDb(s)) return vars
  const mysql = s.database === 'mysql'
  return {
    DB_CONNECTION: mysql ? 'mysql' : 'pgsql', DB_HOST: mysql ? 'mysql' : 'pgsql', DB_PORT: mysql ? '3306' : '5432',
    DB_DATABASE: s.dbName, DB_USERNAME: 'app', DB_PASSWORD: password, FORWARD_DB_PORT: String(s.dbPort), ...vars
  }
}

/** Laravel with the Docker option: Sail, in place of DevForge's compose.yaml */
export const usesSail = (o: Pick<Opts, 'framework' | 'setup'>) => o.framework === 'laravel' && o.setup.features.includes('docker')

function laravelSteps(o: Opts, ctx: PlanContext): SetupStep[] {
  const s = o.setup, l = LABELS[ctx.lang], steps: SetupStep[] = []
  const has = (f: SetupFeature) => s.features.includes(f)
  if (usesSail(o)) {
    steps.push({ kind: 'run', label: l.sail, exe: 'composer', args: ['require', 'laravel/sail', '--dev'], skipIf: 'vendor/laravel/sail' })
    const service = s.database === 'mysql' ? 'mysql' : s.database === 'postgres' ? 'pgsql' : 'none'
    steps.push({ kind: 'run', label: l.sailInstall, exe: 'php', args: ['artisan', 'sail:install', `--with=${service}`, '--no-interaction'], skipIf: 'compose.yaml' })
    // Its script that makes a "testing" database is mounted as one file: outside WSL, the database cannot read it and stops
    if (serverDb(s)) steps.push({ kind: 'drop-lines', label: l.sailInitScript, file: 'compose.yaml', match: '/docker-entrypoint-initdb.d/' })
    // After sail:install, which writes its own DB_* lines
    steps.push({ kind: 'env', label: 'DB_*', file: '.env', vars: sailEnv(s, ctx.password) })
  } else if (s.database !== 'none') steps.push({ kind: 'env', label: 'DB_*', file: '.env', vars: laravelEnv(s, ctx.password) })
  // routes/api.php and Sanctum; the tables come with the first migration in the workshop
  if (has('api')) {
    steps.push({ kind: 'run', label: l.sanctum, exe: 'php', args: ['artisan', 'install:api', '--without-migration-prompt', '--no-interaction'], skipIf: 'routes/api.php' })
    // What install:api asks to do by hand
    steps.push({ kind: 'add-trait', label: l.apiTokens, file: 'app/Models/User.php', trait: 'Laravel\\Sanctum\\HasApiTokens' })
  }
  if (has('auth')) {
    steps.push({ kind: 'run', label: l.fortify, exe: 'composer', args: ['require', 'laravel/fortify'], skipIf: 'vendor/laravel/fortify' })
    steps.push({ kind: 'run', label: l.fortifyInstall, exe: 'php', args: ['artisan', 'fortify:install', '--no-interaction'], skipIf: 'config/fortify.php' })
  }
  // tests: the skeleton already has PHPUnit and two tests
  return steps
}

/**
 * Prisma 7 talks to the database through a driver adapter; versions pinned to 7
 * (the "latest" tag is Prisma 8's release candidate, with another init)
 */
const PRISMA_ADAPTERS = {
  postgres: { packages: ['@prisma/adapter-pg@7', 'pg'], name: 'PrismaPg', from: '@prisma/adapter-pg', arg: 'process.env.DATABASE_URL', wrap: (a: string) => `{ connectionString: ${a} }` },
  mysql:    { packages: ['@prisma/adapter-mariadb@7'], name: 'PrismaMariaDb', from: '@prisma/adapter-mariadb', arg: "process.env.DATABASE_URL!.replace(/^mysql:/, 'mariadb:')", wrap: (a: string) => a },
  sqlite:   { packages: ['@prisma/adapter-better-sqlite3@7'], name: 'PrismaBetterSqlite3', from: '@prisma/adapter-better-sqlite3', arg: 'process.env.DATABASE_URL!', wrap: (a: string) => `{ url: ${a} }` }
}

/** lib/prisma: one client for the app (Next.js reloads its modules in development), generated in {src}generated/prisma */
export function prismaClientFile(db: keyof typeof PRISMA_ADAPTERS, typescript: boolean): string {
  const a = PRISMA_ADAPTERS[db]
  const arg = typescript ? a.arg : a.arg.replace('!', '')
  return [
    "import { PrismaClient } from '../generated/prisma/client'",
    `import { ${a.name} } from '${a.from}'`,
    '',
    `const globalForPrisma = globalThis${typescript ? ' as unknown as { prisma?: PrismaClient }' : ''}`,
    '',
    `export const prisma = globalForPrisma.prisma ?? new PrismaClient({ adapter: new ${a.name}(${a.wrap(arg)}) })`,
    '',
    "if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma",
    ''
  ].join('\n')
}

function nextSteps(o: Opts, ctx: PlanContext): SetupStep[] {
  const s = o.setup, l = LABELS[ctx.lang], pm = o.packageManager, steps: SetupStep[] = []
  const has = (f: SetupFeature) => s.features.includes(f)
  const ext = o.typescript ? 'ts' : 'js'
  if (s.database !== 'none') {
    const provider = s.database === 'postgres' ? 'postgresql' : s.database
    const db = s.database as keyof typeof PRISMA_ADAPTERS
    steps.push({ kind: 'run', label: l.prisma, exe: pm, args: pmAdd(pm, ['prisma@7', 'dotenv'], true) })
    steps.push({ kind: 'run', label: l.prisma, exe: pm, args: pmAdd(pm, ['@prisma/client@7']) })
    steps.push({ kind: 'run', label: l.prismaAdapter, exe: pm, args: pmAdd(pm, PRISMA_ADAPTERS[db].packages) })
    // --no-skills: otherwise about 200 AI-agent files (.claude, .windsurf…) land in the first commit
    steps.push({ kind: 'run', label: l.prismaInit, exe: 'npx', args: ['prisma', 'init', '--datasource-provider', provider, '--output', '../{src}generated/prisma', '--no-skills'], skipIf: 'prisma/schema.prisma' })
    steps.push({ kind: 'env', label: l.envDb, file: '.env', vars: { DATABASE_URL: databaseUrl('nextjs', s, ctx.password) } })
    steps.push({ kind: 'ignore', label: l.ignore, lines: ['/{src}generated/prisma'] })
    steps.push({ kind: 'run', label: l.prismaClient, exe: 'npx', args: ['prisma', 'generate'], optional: true })
    steps.push({ kind: 'write', label: l.prismaClient, files: [{ path: `{src}lib/prisma.${ext}`, content: prismaClientFile(db, o.typescript) }] })
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

const NODE_ENTRY = "// Entry point: npm run dev restarts it on every change\nconsole.log('Hello from Node.js ' + process.version)\n"

/** Tailwind 4 through Vite's plugin; create-next-app --yes brings Tailwind already set up (its own Turbopack plugin) */
const TAILWIND_VITE: Framework[] = ['react', 'vue']

/** What .gitignore must have before the first commit (the templates' own files may lack it: npm init writes none) */
export function ignoreLines(fw: Framework): string[] {
  if (fw === 'empty') return []
  if (fw === 'symfony' || fw === 'laravel' || fw === 'php') return ['/vendor', '/node_modules']
  if (fw === 'nextjs') return ['/node_modules']
  return ['/node_modules', '/dist', '.env', '*.log']
}

/** Steps for any framework, right after its creation: dependencies, a starting point, the libraries' setup */
function commonSteps(o: Opts, ctx: PlanContext): SetupStep[] {
  const l = LABELS[ctx.lang], pm = o.packageManager, steps: SetupStep[] = []
  const has = (list: string[] | undefined, pkg: string) => !!list?.some(p => packageName(p) === pkg)
  // Laravel and Vite templates come without node_modules ('vite' is not recognized…)
  if (o.framework !== 'nodejs' && o.framework !== 'empty') {
    steps.push({ kind: 'run', label: l.install, exe: pm, args: ['install'], skipIf: 'node_modules', onlyIf: 'package.json' })
  }
  if (o.framework === 'nodejs') {
    steps.push({ kind: 'write', label: l.entry, files: [{ path: 'index.js', content: NODE_ENTRY }] })
    steps.push({ kind: 'scripts', label: l.startScripts, scripts: { start: 'node index.js', dev: 'node --watch index.js', test: 'node --test' } })
    if (has(o.libraries, '@prisma/client')) {
      steps.push({ kind: 'run', label: l.prismaInit, exe: 'npx', args: ['prisma', 'init', '--datasource-provider', 'postgresql', '--output', '../generated/prisma', '--no-skills'], skipIf: 'prisma/schema.prisma' })
      steps.push({ kind: 'ignore', label: l.ignore, lines: ['/generated/prisma'] })
    }
  }
  // Supabase: the keys it reads, empty, in a committed .env.example
  if (has(o.libraries, '@supabase/supabase-js')) {
    const prefix = o.framework === 'nextjs' ? 'NEXT_PUBLIC_' : o.framework === 'react' || o.framework === 'vue' ? 'VITE_' : ''
    steps.push({ kind: 'env', label: '.env.example', file: '.env.example', vars: { [`${prefix}SUPABASE_URL`]: '', [`${prefix}SUPABASE_ANON_KEY`]: '' } })
  }
  if (TAILWIND_VITE.includes(o.framework) && has(o.devLibraries, 'tailwindcss')) {
    steps.push({ kind: 'run', label: l.tailwindDeps, exe: pm, args: pmAdd(pm, ['@tailwindcss/vite'], true), skipIf: 'node_modules/@tailwindcss/vite' })
    steps.push({ kind: 'tailwind', label: l.tailwind })
  }
  return steps
}

/** Every step after the framework's creation, in order */
export function planSetup(o: Opts, ctx: PlanContext): SetupStep[] {
  const s = o.setup, l = LABELS[ctx.lang], steps: SetupStep[] = commonSteps(o, ctx)
  if (SETUP_FRAMEWORKS.includes(o.framework)) {
    steps.push(...(o.framework === 'symfony' ? symfonySteps(o, ctx) : o.framework === 'laravel' ? laravelSteps(o, ctx) : nextSteps(o, ctx)))
    const docker = s.features.includes('docker')
    const sail = usesSail(o)
    if (!sail && (serverDb(s) || docker)) {
      steps.push({ kind: 'ignore', label: l.ignore, lines: ['/.env.docker'] })
      steps.push({ kind: 'env', label: '.env.docker', file: '.env.docker', vars: dockerEnv(o.framework, s, ctx.password) })
      steps.push({ kind: 'write', label: l.compose, files: [{ path: 'compose.yaml', content: composeFile(o.framework, s, ctx.composeName || undefined) }] })
    }
    if (docker && !sail) steps.push({ kind: 'write', label: l.docker, files: dockerFiles(o) })
    if (s.features.includes('ci')) steps.push({ kind: 'write', label: l.ci, files: [{ path: '.github/workflows/ci.yml', content: ciWorkflow(o) }] })
    // Sail: the app's image is built the first time (a few minutes)
    if (sail) steps.push({ kind: 'run', label: l.sailStart, exe: 'docker', args: ['compose', 'up', '-d', '--wait'], optional: true })
    else if (serverDb(s)) {
      steps.push({ kind: 'run', label: l.start, exe: 'docker', args: ['compose', 'up', '-d', '--wait', 'database'], optional: true })
    }
    // Laravel migrated its SQLite database at creation: the chosen one starts empty
    if (o.framework === 'laravel' && serverDb(s)) {
      steps.push(sail
        ? { kind: 'run', label: l.migrate, exe: 'docker', args: ['compose', 'exec', '-T', 'laravel.test', 'php', 'artisan', 'migrate', '--force'], optional: true }
        : { kind: 'run', label: l.migrate, exe: 'php', args: ['artisan', 'migrate', '--force'], optional: true })
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
    const lines = ignoreLines(o.framework)
    if (lines.length) steps.push({ kind: 'ignore', label: l.ignore, lines })
    steps.push({ kind: 'run', label: l.gitInit, exe: 'git', args: ['init', '-b', 'main'], skipIf: '.git' })
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
    case 'drop-lines': return `− ${step.match} → ${step.file}`
    case 'connection': return step.label
    case 'add-trait':  return `use ${step.trait.split('\\').pop()} → ${step.file}`
    case 'tailwind':   return 'vite.config + @import "tailwindcss"'
  }
}
