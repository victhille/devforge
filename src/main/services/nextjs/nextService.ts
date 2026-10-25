import { app } from 'electron'
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { dirname, join, relative } from 'path'
import type { CommandResult, LogLine, NextCommand, NextInspect, NextRevertResult, NextRoute, SfApiConfig, SfEntityDraft, SfMigration, SfWriteResult } from '@shared/types'
import { ADAPTER, nextCommand } from '@shared/lib/nextCommands'
import { assertSafeDir, isInsideProject } from '../../lib/safe'
import { quote, runCapture, runFile } from '../../lib/exec'
import { commandRunner } from '../system/commandRunner'
import { checkDraft } from '../symfony/sfEntityWriter'
import { isDangerous } from '../symfony/sfInspect'
import { OPERATIONS } from '../symfony/sfApi'
import { parseSchema, toEntities, writeModel as writePrismaModel } from './prismaSchema'
import { cleanDiff, createDatabaseSql, databaseName, dropDatabaseSql, findConfig, prismaStamp, revertConfig, revertFolder, revertMigration, shadowUrl } from './prismaRevert'
import { GENERATED_MARK, prismaClientFile, routeFiles, routeFolder, seedFile } from './nextFiles'

type LogCb = (log: LogLine) => void
type ResultCb = (result: CommandResult) => void

/** A saved DevForge project: the workshop reads and writes only there */
function projectDir(path: unknown): string {
  const dir = assertSafeDir(path)
  if (!isInsideProject(dir)) throw new Error('NOT_A_PROJECT')
  return dir
}

const read = (file: string) => existsSync(file) ? readFileSync(file, 'utf-8') : ''
function write(file: string, content: string): void {
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, content)
}
/** An import path from a file to another (no extension), always ./ or ../ */
function importPath(fromFile: string, to: string): string {
  const r = relative(dirname(fromFile), to).replace(/\\/g, '/')
  return r.startsWith('.') ? r : `./${r}`
}

// ─── The project's layout ─────────────────────────────────────────────────────

function pkg(dir: string): { dependencies?: Record<string, string>; devDependencies?: Record<string, string> } {
  try { return JSON.parse(read(join(dir, 'package.json')) || '{}') } catch { return {} }
}
const pmOf = (dir: string) => existsSync(join(dir, 'pnpm-lock.yaml')) ? 'pnpm' as const : existsSync(join(dir, 'yarn.lock')) ? 'yarn' as const : 'npm' as const
const installed = (dir: string, name: string) => existsSync(join(dir, 'node_modules', ...name.split('/'), 'package.json'))

function layout(dir: string) {
  const base = existsSync(join(dir, 'src', 'app')) ? join(dir, 'src') : dir
  const ts = existsSync(join(dir, 'tsconfig.json'))
  const schemaFile = join(dir, 'prisma', 'schema.prisma')
  const schema = existsSync(schemaFile) ? parseSchema(read(schemaFile)) : null
  let version: number | null
  try { version = Number(JSON.parse(read(join(dir, 'node_modules', 'prisma', 'package.json'))).version.split('.')[0]) } catch {
    const spec = pkg(dir).devDependencies?.prisma ?? pkg(dir).dependencies?.prisma
    version = spec ? Number(spec.replace(/^\D*/, '').split('.')[0]) || null : null
  }
  const lib = join(base, 'lib', `prisma.${ts ? 'ts' : 'js'}`)
  // The generated client: Prisma 7 writes it in the project (output), older ones in node_modules
  const clientAt = schema?.output
    ? join(dir, 'prisma', schema.output, schema.generator === 'prisma-client' ? 'client' : '')
    : null
  return { base, appDir: join(base, 'app'), ts, schemaFile, schema, version, lib, clientAt }
}

const clientImport = (from: string, l: ReturnType<typeof layout>) => l.clientAt ? importPath(from, l.clientAt) : '@prisma/client'
const libImport = (from: string, l: ReturnType<typeof layout>) => importPath(from, l.lib.replace(/\.(ts|js)$/, ''))

/**
 * End-to-end tests of the workshop: DEVFORGE_TEST_NEXTJS names a JSON file
 * { database, migrations } used instead of Prisma's CLI; the schema is still
 * read from the disk. Ignored in the installed app.
 */
function testData<K extends 'database' | 'migrations'>(key: K): { database: NextInspect['status']['database']; migrations: SfMigration[] }[K] | undefined {
  const file = process.env.DEVFORGE_TEST_NEXTJS
  if (!file || app.isPackaged) return undefined
  try { return JSON.parse(readFileSync(file, 'utf-8'))[key] } catch { return undefined }
}

// ─── Reading ──────────────────────────────────────────────────────────────────

/** `prisma migrate status`: which migrations ran, whether the database answers */
function parseMigrateStatus(out: string): { reachable: boolean; pending: string[]; error: string | null } {
  const pending: string[] = []
  const m = out.match(/have not yet been applied:\s*\n([\s\S]*?)(\n\s*\n|$)/)
  if (m) for (const line of m[1].split('\n')) { const name = line.trim(); if (/^\d{14}_\w+$/.test(name)) pending.push(name) }
  const error = out.match(/(P1\d{3}[^\n]*)/)?.[1] ?? out.match(/Error: ([^\n]+)/)?.[1] ?? null
  return { reachable: !/P100[0-3]|Can't reach database|ECONNREFUSED/i.test(out), pending, error: /P100[0-3]|Can't reach|ECONNREFUSED/i.test(out) ? error : null }
}

export async function inspect(projectPath: string): Promise<NextInspect> {
  const dir = projectDir(projectPath)
  const l = layout(dir)
  const deps = { ...pkg(dir).dependencies, ...pkg(dir).devDependencies }
  const provider = l.schema?.provider ?? null
  const status: NextInspect['status'] = {
    prisma: !!deps.prisma && !!l.schema, provider, prismaVersion: l.version,
    client: installed(dir, '@prisma/client') && (!(l.version && l.version >= 7) || !provider || !ADAPTER[provider] || installed(dir, ADAPTER[provider].pkg)),
    libPrisma: existsSync(l.lib),
    database: { reachable: false, error: null },
    composeDatabase: /^\s{2}database:\s*$/m.test(read(join(dir, 'compose.yaml'))),
    seedTools: installed(dir, 'tsx') && installed(dir, '@faker-js/faker'),
    authjs: installed(dir, 'next-auth'),
    packageManager: pmOf(dir), typescript: l.ts
  }
  if (!l.schema) return { status, entities: [], migrations: [] }
  const canned = testData('database')
  if (canned) return { status: { ...status, database: canned }, entities: toEntities(l.schema), migrations: testData('migrations') ?? [] }

  const migDir = join(dir, 'prisma', 'migrations')
  const names = existsSync(migDir) ? readdirSync(migDir).filter(n => /^\d{14}_/.test(n) && statSync(join(migDir, n)).isDirectory()) : []
  const st = await runCapture('npx prisma migrate status', { cwd: dir, timeout: 90_000 })
  const parsed = parseMigrateStatus(`${st.stdout}\n${st.stderr}`)
  status.database = { reachable: parsed.reachable, error: parsed.error }
  const migrations: SfMigration[] = names.map(name => {
    const sql = read(join(migDir, name, 'migration.sql')).split(/;\s*\n/).map(s => s.replace(/^--.*$/gm, '').trim()).filter(Boolean)
    return {
      version: name, description: name.slice(15).replace(/_/g, ' '), executed: parsed.reachable && !parsed.pending.includes(name),
      executedAt: null, file: `prisma/migrations/${name}/migration.sql`, sql, dangerous: isDangerous(sql)
    }
  }).sort((a, b) => b.version.localeCompare(a.version))
  return { status, entities: toEntities(l.schema), migrations }
}

/** Pages and API routes of the App Router, read from the files */
export async function routes(projectPath: string): Promise<NextRoute[]> {
  const dir = projectDir(projectPath)
  const { appDir } = layout(dir)
  const out: NextRoute[] = []
  const walk = (folder: string) => {
    let entries: string[]
    try { entries = readdirSync(folder) } catch { return }
    for (const name of entries) {
      const full = join(folder, name)
      if (statSync(full).isDirectory()) { if (name !== 'node_modules' && name !== 'generated' && !name.startsWith('_')) walk(full); continue }
      const m = name.match(/^(page|route)\.(tsx?|jsx?)$/)
      if (!m) continue
      const path = '/' + relative(appDir, folder).replace(/\\/g, '/').split('/').filter(seg => seg && !/^\(.*\)$/.test(seg)).join('/')
      const src = read(full)
      const methods = m[1] === 'route'
        ? [...new Set([...src.matchAll(/export\s+(?:async\s+)?function\s+(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\b/g), ...src.matchAll(/export\s+const\s+\{([^}]*)\}/g)]
          .flatMap(x => x[1].split(',').map(s => s.trim().split(/\s/)[0])).filter(x => /^(GET|POST|PUT|PATCH|DELETE)$/.test(x)))]
        : []
      out.push({ path: path === '/' ? '/' : path, methods, kind: m[1] === 'route' ? 'api' : 'page', file: relative(dir, full).replace(/\\/g, '/') })
    }
  }
  walk(appDir)
  return out.sort((a, b) => a.path.localeCompare(b.path))
}

// ─── Commands ─────────────────────────────────────────────────────────────────

export function run(projectPath: string, command: NextCommand, arg: string | undefined, onLog: LogCb, onResult: ResultCb): string {
  const dir = projectDir(projectPath)
  const c = nextCommand(command, pmOf(dir), command === 'install:client' ? layout(dir).schema?.provider ?? '' : arg)
  return commandRunner.run({ executable: c.exe, args: c.args, cwd: dir, onLog, onResult })
}

// ─── Writing ──────────────────────────────────────────────────────────────────

const rel = (dir: string, file: string) => relative(dir, file).replace(/\\/g, '/')

export function writeModel(projectPath: string, draft: SfEntityDraft): SfWriteResult {
  const dir = projectDir(projectPath)
  const l = layout(dir)
  if (!l.schema) throw new Error('NEEDS:install:prisma')
  const error = checkDraft(draft, l.schema.models.map(m => m.name))
  if (error) throw new Error(error)
  write(l.schemaFile, writePrismaModel(read(l.schemaFile), draft))
  return { created: [], changed: ['prisma/schema.prisma'], removed: [] }
}

export function writePrismaClient(projectPath: string): SfWriteResult {
  const dir = projectDir(projectPath)
  const l = layout(dir)
  if (!l.schema) throw new Error('NEEDS:install:prisma')
  const existing = read(l.lib)
  if (existing && !existing.includes(GENERATED_MARK)) throw new Error(`HAND_EDITED:${rel(dir, l.lib)}`)
  const content = prismaClientFile(l.schema.provider, l.version ?? 6, clientImport(l.lib, l), l.ts)
  write(l.lib, content)
  return { created: existing ? [] : [rel(dir, l.lib)], changed: existing ? [rel(dir, l.lib)] : [], removed: [] }
}

const apiConfigFile = (dir: string) => join(dir, '.devforge', 'api.json')

export function apiConfig(projectPath: string): SfApiConfig | null {
  try { return JSON.parse(read(apiConfigFile(projectDir(projectPath)))) as SfApiConfig } catch { return null }
}

export function applyApi(projectPath: string, config: SfApiConfig): SfWriteResult {
  const dir = projectDir(projectPath)
  const l = layout(dir)
  if (!l.schema) throw new Error('NEEDS:install:prisma')
  if (!existsSync(l.lib)) throw new Error('NEEDS:lib')
  const result: SfWriteResult = { created: [], changed: [], removed: [] }
  const put = (file: string, content: string | null) => {
    const old = read(file)
    if (old && !old.includes(GENERATED_MARK)) { if (content !== null) throw new Error(`HAND_EDITED:${rel(dir, file)}`); return }
    if (content === null) { if (old) { rmSync(file); result.removed.push(rel(dir, file)) } return }
    if (old === content) return
    write(file, content)
    ;(old ? result.changed : result.created).push(rel(dir, file))
  }
  for (const e of toEntities(l.schema)) {
    const c = config.entities[e.name]
    const ops = (c?.operations ?? []).filter(o => OPERATIONS.includes(o))
    const hidden = (c?.hidden ?? []).filter(h => e.fields.some(f => f.name === h))
    const folder = join(l.appDir, 'api', ...routeFolder(e.name).split('/').slice(1))
    const collectionFile = join(folder, `route.${l.ts ? 'ts' : 'js'}`)
    const itemFile = join(folder, '[id]', `route.${l.ts ? 'ts' : 'js'}`)
    const files = routeFiles(e, ops, hidden, l.ts, {
      collection: { client: clientImport(collectionFile, l), lib: libImport(collectionFile, l) },
      item: { client: clientImport(itemFile, l), lib: libImport(itemFile, l) }
    })
    put(collectionFile, files.collection)
    put(itemFile, files.item)
  }
  write(apiConfigFile(dir), JSON.stringify({ ...config, mode: 'json' }, null, 2) + '\n')
  return result
}

/** prisma/seed.ts written for these counts, then run in the console */
export function writeSeed(projectPath: string, counts: Record<string, number>, onLog: LogCb, onResult: ResultCb): string {
  const dir = projectDir(projectPath)
  const l = layout(dir)
  if (!l.schema) throw new Error('NEEDS:install:prisma')
  if (!existsSync(l.lib)) throw new Error('NEEDS:lib')
  if (!installed(dir, 'tsx') || !installed(dir, '@faker-js/faker')) throw new Error('NEEDS:install:seed')
  const entities = toEntities(l.schema)
  const clean: Record<string, number> = {}
  for (const [name, n] of Object.entries(counts)) if (entities.some(e => e.name === name) && Number.isInteger(n) && n > 0) clean[name] = Math.min(n, 10_000)
  if (!Object.keys(clean).length) throw new Error('EMPTY')
  const file = join(dir, 'prisma', 'seed.ts')
  const old = read(file)
  if (old && !old.includes(GENERATED_MARK)) throw new Error('HAND_EDITED:prisma/seed.ts')
  write(file, seedFile(entities, clean, libImport(file, l)))
  const c = nextCommand('seed', pmOf(dir))
  return commandRunner.run({ executable: c.exe, args: c.args, cwd: dir, onLog, onResult })
}

// ─── Going back ───────────────────────────────────────────────────────────────

/** .env value, without quotes */
const envValue = (dir: string, key: string) =>
  read(join(dir, '.env')).match(new RegExp(`^\\s*${key}\\s*=\\s*"?([^"\\r\\n]*)"?`, 'm'))?.[1] ?? null

/**
 * The last applied migration undone as a new migration, not run: its SQL is
 * read before "Apply". The SQL comes from `migrate diff` against the other
 * migrations replayed in a shadow database (created for the moment, then
 * dropped); schema.prisma goes back to its Git version from before that
 * migration, when it matches.
 */
export async function prepareRevert(projectPath: string): Promise<NextRevertResult> {
  const dir = projectDir(projectPath)
  const l = layout(dir)
  if (!l.schema) throw new Error('NEEDS:install:prisma')
  const provider = l.schema.provider
  const migDir = join(dir, 'prisma', 'migrations')
  const names = existsSync(migDir) ? readdirSync(migDir).filter(n => /^\d{14}_/.test(n) && statSync(join(migDir, n)).isDirectory()).sort() : []
  const last = names[names.length - 1]
  if (!last) throw new Error('NO_MIGRATION')
  const st = await runCapture('npx prisma migrate status', { cwd: dir, timeout: 90_000 })
  const status = parseMigrateStatus(`${st.stdout}\n${st.stderr}`)
  if (!status.reachable) throw new Error('NOT_REACHABLE')
  if (status.pending.length) throw new Error('PENDING_FIRST')

  const url = envValue(dir, 'DATABASE_URL') ?? ''
  const shadow = shadowUrl(url, provider)
  const shadowName = provider === 'sqlite' ? null : databaseName(shadow ?? '')
  if (!shadow || (provider !== 'sqlite' && !shadowName)) throw new Error('NO_DATABASE_URL')

  const work = mkdtempSync(join(tmpdir(), 'devforge-revert-'))
  const before = join(work, 'migrations')
  const configName = findConfig(readdirSync(dir))
  const tempConfig = join(dir, 'prisma.devforge.config.ts')
  const v7 = (l.version ?? 0) >= 7
  const env = { DEVFORGE_SHADOW_URL: shadow }
  // Prisma 7 takes the shadow database from its config; older ones from flags
  const prisma = (args: string) => v7
    ? `npx prisma ${args} --config ${quote(tempConfig)}`
    : `npx prisma ${args.replace('--from-config-datasource', `--from-url ${quote(url)}`)} --shadow-database-url ${quote(shadow)}`
  const execSql = (name: string, sql: string) => {
    const f = join(work, name)
    writeFileSync(f, sql)
    return runCapture(`npx prisma db execute --file ${quote(f)}${v7 ? '' : ` --url ${quote(url)}`}`, { cwd: dir, timeout: 90_000 })
  }
  try {
    mkdirSync(before)
    for (const n of names.slice(0, -1)) cpSync(join(migDir, n), join(before, n), { recursive: true })
    if (existsSync(join(migDir, 'migration_lock.toml'))) cpSync(join(migDir, 'migration_lock.toml'), join(before, 'migration_lock.toml'))
    if (v7) {
      if (!configName) throw new Error('NO_PRISMA_CONFIG')
      writeFileSync(tempConfig, revertConfig(configName))
    }
    if (shadowName) await execSql('create.sql', createDatabaseSql(shadowName, provider))

    const diff = await runCapture(prisma(`migrate diff --from-config-datasource --to-migrations ${quote(before)} --script`), { cwd: dir, timeout: 180_000, env })
    if (!diff.ok) throw new Error(`PRISMA:${(diff.stderr || diff.stdout).trim().split(/\r?\n/).pop()}`)
    const sql = cleanDiff(diff.stdout)
    if (!sql) throw new Error('NOTHING_TO_REVERT')

    // The schema from before that migration, if Git has it and it matches the other migrations
    let schemaBack: string | null = null
    const added = (await runFile('git', ['log', '-n', '1', '--format=%H', '--diff-filter=A', '--', `prisma/migrations/${last}`], { cwd: dir })).stdout.trim()
    const shown = await runFile('git', ['show', `${added ? `${added}^` : 'HEAD'}:prisma/schema.prisma`], { cwd: dir })
    if (shown.ok && shown.stdout.includes('datasource')) {
      const candidate = join(work, 'schema.prisma')
      writeFileSync(candidate, shown.stdout)
      const check = await runCapture(prisma(`migrate diff --from-migrations ${quote(before)} --to-schema ${quote(candidate)} --exit-code`), { cwd: dir, timeout: 180_000, env })
      if (check.ok) schemaBack = shown.stdout
    }

    const folder = revertFolder(last, prismaStamp(new Date()))
    write(join(migDir, folder, 'migration.sql'), revertMigration(last, sql))
    const result: SfWriteResult = { created: [`prisma/migrations/${folder}/migration.sql`], changed: [], removed: [] }
    if (schemaBack !== null && schemaBack !== read(l.schemaFile)) { write(l.schemaFile, schemaBack); result.changed.push('prisma/schema.prisma') }
    return { ...result, migration: last, schemaRestored: schemaBack !== null }
  } finally {
    if (shadowName) await execSql('drop.sql', dropDatabaseSql(shadowName, provider))
    if (provider === 'sqlite') rmSync(join(dir, 'prisma', 'devforge-shadow.db'), { force: true })
    rmSync(tempConfig, { force: true })
    rmSync(work, { recursive: true, force: true })
  }
}
