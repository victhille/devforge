import { app } from 'electron'
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'fs'
import { dirname, join, relative } from 'path'
import type { CommandResult, LaravelCommand, LaravelInspect, LogLine, SfApiConfig, SfEntityDraft, SfMigration, SfRoute, SfWriteResult } from '@shared/types'
import { SAIL_SERVICE, isSailCompose, laravelCommand } from '@shared/lib/laravelCommands'
import { assertSafeDir, isInsideProject } from '../../lib/safe'
import { runCapture } from '../../lib/exec'
import { commandRunner } from '../system/commandRunner'
import { checkDraft } from '../symfony/sfEntityWriter'
import { isDangerous } from '../symfony/sfInspect'
import { OPERATIONS } from '../symfony/sfApi'
import {
  GENERATED_MARK, addLines, controllerFile, createLines, extendModel, factoryFile, migrationFile, migrationLabel, migrationStamp,
  newModelFile, parseMigrateStatus, parsePretend, planLinks, readMigrations, readModel, routesBlock, seederFile, snake, tableOf,
  toEntities, upBody, withRoutesBlock
} from './laravelFiles'

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
const rel = (dir: string, file: string) => relative(dir, file).replace(/\\/g, '/')
const list = (folder: string, re: RegExp) => { try { return readdirSync(folder).filter(n => re.test(n)).sort() } catch { return [] } }

/** .env value, without quotes */
const envValue = (dir: string, key: string) => read(join(dir, '.env')).match(new RegExp(`^\\s*${key}\\s*=\\s*"?([^"\\r\\n]*)"?`, 'm'))?.[1] ?? null

/**
 * End-to-end tests of the workshop: DEVFORGE_TEST_LARAVEL names a JSON file
 * { status, migrations, routes } used instead of PHP; models are still read
 * from the disk. Ignored in the installed app.
 */
function testData<K extends 'status' | 'migrations' | 'routes'>(key: K): { status: LaravelInspect['status']; migrations: SfMigration[]; routes: SfRoute[] }[K] | undefined {
  const file = process.env.DEVFORGE_TEST_LARAVEL
  if (!file || app.isPackaged) return undefined
  try { return JSON.parse(readFileSync(file, 'utf-8'))[key] } catch { return undefined }
}

// ─── Reading ──────────────────────────────────────────────────────────────────

const compose = (dir: string) => read(join(dir, 'compose.yaml')) || read(join(dir, 'docker-compose.yml'))
const isSail = (dir: string) => isSailCompose(compose(dir))
/** php artisan on this PC, or in Sail's app container */
const artisanLine = (dir: string) => (args: string) =>
  isSail(dir) ? `docker compose exec -T -u sail ${SAIL_SERVICE} php artisan ${args}` : `php artisan ${args}`

/** Models from app/Models, tables from database/migrations: no database needed */
function project(dir: string) {
  const migDir = join(dir, 'database', 'migrations')
  const migrationNames = list(migDir, /^\d{4}_\d{2}_\d{2}_\d{6}_\w+\.php$/).map(n => n.replace(/\.php$/, ''))
  const migrationPhp = new Map(migrationNames.map(n => [n, read(join(migDir, `${n}.php`))]))
  const tables = readMigrations([...migrationPhp.values()])
  const modelDir = join(dir, 'app', 'Models')
  const models = list(modelDir, /^[A-Z]\w*\.php$/).map(n => readModel(n.replace(/\.php$/, ''), `app/Models/${n}`, read(join(modelDir, n))))
  return { migDir, migrationNames, migrationPhp, tables, models, entities: toEntities(models, tables) }
}

// eslint-disable-next-line no-control-regex -- colors a PHP script may still print
const plain = (out: string) => out.replace(/\x1b\[[0-9;]*m/g, '')
function firstError(out: string): string {
  const lines = plain(out).split(/\r?\n/).map(l => l.trim()).filter(l => l && !/^Deprecation Notice|^Deprecated:/.test(l))
  return lines.find(l => /SQLSTATE|could not find driver|Connection refused|does not exist|Access denied|Unknown database/i.test(l))
    ?? lines.find(l => /error|exception/i.test(l)) ?? lines.pop() ?? ''
}

export async function inspect(projectPath: string): Promise<LaravelInspect> {
  const dir = projectDir(projectPath)
  const p = project(dir)
  const canned = testData('status')
  if (canned) return { status: canned, entities: p.entities, migrations: testData('migrations') ?? [] }
  const sail = isSail(dir)
  const status: LaravelInspect['status'] = {
    booted: false, error: null, version: null, connection: envValue(dir, 'DB_CONNECTION'),
    database: { reachable: false, error: null },
    composeDatabase: sail || /^\s{2}database:\s*$/m.test(compose(dir)),
    api: existsSync(join(dir, 'routes', 'api.php')),
    faker: existsSync(join(dir, 'vendor', 'fakerphp', 'faker')),
    sail,
    appUrl: sail ? `http://localhost:${envValue(dir, 'APP_PORT') || '80'}` : 'http://127.0.0.1:8000'
  }
  const artisan = artisanLine(dir)
  const fromFiles = (name: string): SfMigration => {
    const sql = upBody(p.migrationPhp.get(name) ?? '').split(/;\s*\n/).map(s => s.trim()).filter(Boolean)
    return { version: name, description: migrationLabel(name), executed: false, executedAt: null, file: `database/migrations/${name}.php`, sql: sql.slice(1), dangerous: /->drop|Schema::drop/.test(upBody(p.migrationPhp.get(name) ?? '')) }
  }
  if (!existsSync(join(dir, 'vendor', 'autoload.php'))) {
    status.error = 'NO_VENDOR'
    return { status, entities: p.entities, migrations: p.migrationNames.map(fromFiles).reverse() }
  }
  const v = await runCapture(artisan('--version --no-ansi'), { cwd: dir, timeout: 60_000 })
  status.version = plain(v.stdout).match(/Laravel Framework ([\d.]+)/)?.[1] ?? null
  status.booted = !!status.version
  if (!status.booted) {
    const out = `${v.stdout}\n${v.stderr}`
    status.error = sail && /is not running|no such service|no container found/i.test(out) ? 'SAIL_DOWN' : firstError(out) || 'NOT_BOOTED'
    return { status, entities: p.entities, migrations: p.migrationNames.map(fromFiles).reverse() }
  }

  const st = await runCapture(artisan('migrate:status --no-interaction --no-ansi'), { cwd: dir, timeout: 90_000 })
  const out = `${st.stdout}\n${st.stderr}`
  const parsed = parseMigrateStatus(out)
  status.database.reachable = parsed.ran.size > 0 || parsed.tableMissing
  if (!status.database.reachable) status.database.error = firstError(out)

  // The SQL of what is pending, as Laravel would run it
  let pretend = new Map<string, string[]>()
  const pending = p.migrationNames.filter(n => !parsed.ran.get(n))
  if (status.database.reachable && pending.length) {
    const pr = await runCapture(artisan('migrate --pretend --no-interaction --no-ansi'), { cwd: dir, timeout: 90_000 })
    pretend = parsePretend(`${pr.stdout}\n${pr.stderr}`)
  }
  const migrations = p.migrationNames.map(name => {
    const m = fromFiles(name)
    const sql = pretend.get(name)
    return { ...m, executed: !!parsed.ran.get(name), ...(sql ? { sql, dangerous: isDangerous(sql) } : {}) }
  }).reverse()
  return { status, entities: p.entities, migrations }
}

/** Hidden: Laravel's own tool routes */
const TOOL_ROUTE = /^(_ignition|_debugbar|sanctum\/csrf-cookie|storage\/\{path\})/

export async function routes(projectPath: string): Promise<SfRoute[]> {
  const dir = projectDir(projectPath)
  const canned = testData('routes')
  if (canned) return canned
  const r = await runCapture(artisanLine(dir)('route:list --json --no-ansi'), { cwd: dir, timeout: 60_000 })
  let raw: { method: string; uri: string; name: string | null; action: string }[]
  try { raw = JSON.parse(r.stdout.slice(r.stdout.indexOf('['))) } catch { throw new Error(firstError(`${r.stdout}\n${r.stderr}`) || 'NOT_BOOTED') }
  return raw.filter(x => !TOOL_ROUTE.test(x.uri)).map(x => ({
    name: x.name ?? x.uri, path: '/' + x.uri.replace(/^\//, ''),
    methods: x.method.split('|').filter(m => m !== 'HEAD'), controller: x.action
  })).sort((a, b) => a.path.localeCompare(b.path))
}

// ─── Commands ─────────────────────────────────────────────────────────────────

export function run(projectPath: string, command: LaravelCommand, arg: string | undefined, onLog: LogCb, onResult: ResultCb): string {
  const dir = projectDir(projectPath)
  const c = laravelCommand(command, arg, isSail(dir))
  return commandRunner.run({ executable: c.exe, args: c.args, cwd: dir, onLog, onResult })
}

// ─── Writing ──────────────────────────────────────────────────────────────────

/** The model, its migration (and the pivots, the keys on other tables), the other side of each link */
export function writeModel(projectPath: string, draft: SfEntityDraft): SfWriteResult {
  const dir = projectDir(projectPath)
  const p = project(dir)
  const error = checkDraft(draft, p.models.map(m => m.name))
  if (error) throw new Error(error)
  const current = p.entities.find(e => e.name === draft.name)
  for (const f of draft.fields) {
    if (current?.fields.some(x => x.name === snake(f.name)) || current?.relations.some(r => r.name === f.name)) throw new Error(`EXISTS:${f.name}`)
  }
  for (const r of draft.relations) if (current?.relations.some(x => x.name === r.name)) throw new Error(`EXISTS:${r.name}`)

  const tableFor = (model: string) => p.models.find(m => m.name === model)?.table ?? tableOf(model)
  const own = tableFor(draft.name)
  const plan = planLinks(draft.name, draft.relations, tableFor)
  const ownKeys = plan.keys.filter(k => k.table === own)
  const fields = draft.fields.map(f => ({ ...f, name: snake(f.name) }))

  const creates = [
    ...(draft.existing ? [] : [{ table: own, lines: createLines(fields, ownKeys.map(k => k.line)) }]),
    ...plan.pivots
  ]
  const otherTables = [...new Set(plan.keys.filter(k => k.table !== own).map(k => k.table))]
  const alters = [
    ...(draft.existing && (fields.length || ownKeys.length) ? [{ table: own, lines: addLines(fields, ownKeys.map(k => k.line)), columns: [...fields.map(f => f.name), ...ownKeys.map(k => k.column)] }] : []),
    ...otherTables.map(table => {
      const keys = plan.keys.filter(k => k.table === table)
      return { table, lines: keys.map(k => k.line), columns: keys.map(k => k.column) }
    })
  ]

  const result: SfWriteResult = { created: [], changed: [], removed: [] }
  if (creates.length || alters.length) {
    const name = draft.existing ? `add_${fields[0]?.name ?? plan.keys[0]?.column ?? 'links'}_to_${own}_table` : `create_${own}_table`
    // Never before the last migration: files written in the same second keep their order
    const last = p.migrationNames[p.migrationNames.length - 1]?.slice(0, 17) ?? ''
    let offset = 0
    while (migrationStamp(new Date(), offset) <= last) offset++
    const file = join(p.migDir, `${migrationStamp(new Date(), offset)}_${name}.php`)
    write(file, migrationFile(creates, alters))
    result.created.push(rel(dir, file))
  }

  const fillable = (model: string) => [
    ...(model === draft.name ? fields.map(f => f.name) : []),
    ...plan.keys.filter(k => k.table === tableFor(model)).map(k => k.column)
  ]
  const modelFile = (model: string) => join(dir, 'app', 'Models', `${model}.php`)
  if (draft.existing) {
    write(modelFile(draft.name), extendModel(read(modelFile(draft.name)), fillable(draft.name), fields, plan.methods.filter(m => m.model === draft.name)))
    result.changed.push(rel(dir, modelFile(draft.name)))
  } else {
    write(modelFile(draft.name), newModelFile({ ...draft, fields }, fillable(draft.name), plan.methods))
    result.created.push(rel(dir, modelFile(draft.name)))
  }
  for (const target of [...new Set(plan.methods.map(m => m.model).filter(m => m !== draft.name))]) {
    write(modelFile(target), extendModel(read(modelFile(target)), fillable(target), [], plan.methods.filter(m => m.model === target)))
    result.changed.push(rel(dir, modelFile(target)))
  }
  return result
}

const apiConfigFile = (dir: string) => join(dir, '.devforge', 'api.json')

export function apiConfig(projectPath: string): SfApiConfig | null {
  try { return JSON.parse(read(apiConfigFile(projectDir(projectPath)))) as SfApiConfig } catch { return null }
}

export function applyApi(projectPath: string, config: SfApiConfig): SfWriteResult {
  const dir = projectDir(projectPath)
  const routesFile = join(dir, 'routes', 'api.php')
  if (!existsSync(routesFile)) throw new Error('NEEDS:install:api')
  const p = project(dir)
  const tableFor = (model: string) => p.models.find(m => m.name === model)?.table ?? tableOf(model)
  const result: SfWriteResult = { created: [], changed: [], removed: [] }
  const exposed: { entity: string; ops: typeof OPERATIONS }[] = []
  for (const e of p.entities) {
    const c = config.entities[e.name]
    const ops = OPERATIONS.filter(o => (c?.operations ?? []).includes(o))
    const hidden = (c?.hidden ?? []).filter(h => e.fields.some(f => f.name === h) || e.relations.some(r => r.name === h))
    const file = join(dir, 'app', 'Http', 'Controllers', 'Api', `${e.name}Controller.php`)
    const old = read(file)
    const content = controllerFile(e, tableFor(e.name), ops, hidden, tableFor)
    if (old && !old.includes(GENERATED_MARK)) {
      if (content) throw new Error(`HAND_EDITED:${rel(dir, file)}`)
      continue
    }
    if (content === null) { if (old) { rmSync(file); result.removed.push(rel(dir, file)) } continue }
    exposed.push({ entity: e.name, ops })
    if (old === content) continue
    write(file, content)
    ;(old ? result.changed : result.created).push(rel(dir, file))
  }
  const before = read(routesFile)
  const after = withRoutesBlock(before, routesBlock(exposed))
  if (after !== before) { write(routesFile, after); result.changed.push('routes/api.php') }
  write(apiConfigFile(dir), JSON.stringify({ ...config, mode: 'json' }, null, 2) + '\n')
  return result
}

/** Factories and DevForgeSeeder for these counts, then db:seed in the console */
export function writeSeed(projectPath: string, counts: Record<string, number>, onLog: LogCb, onResult: ResultCb): string {
  const dir = projectDir(projectPath)
  if (!existsSync(join(dir, 'vendor', 'fakerphp', 'faker'))) throw new Error('NEEDS:fakerphp/faker')
  const { entities } = project(dir)
  const clean: Record<string, number> = {}
  for (const [name, n] of Object.entries(counts)) if (entities.some(e => e.name === name) && Number.isInteger(n) && n > 0) clean[name] = Math.min(n, 10_000)
  if (!Object.keys(clean).length) throw new Error('EMPTY')
  const seeder = join(dir, 'database', 'seeders', 'DevForgeSeeder.php')
  const old = read(seeder)
  if (old && !old.includes(GENERATED_MARK)) throw new Error('HAND_EDITED:database/seeders/DevForgeSeeder.php')
  const content = seederFile(entities, clean)
  for (const e of entities.filter(x => clean[x.name])) {
    // A factory written by hand is kept: the seeder uses it as it is
    const file = join(dir, 'database', 'factories', `${e.name}Factory.php`)
    const was = read(file)
    if (!was || was.includes(GENERATED_MARK)) write(file, factoryFile(e))
  }
  write(seeder, content)
  const c = laravelCommand('seed', '', isSail(dir))
  return commandRunner.run({ executable: c.exe, args: c.args, cwd: dir, onLog, onResult })
}
