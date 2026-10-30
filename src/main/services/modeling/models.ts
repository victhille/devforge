import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from 'fs'
import { join, resolve } from 'path'
import type { ModelFile, ModelKind, ModelSummary, SqlEngine } from '@shared/types'
import { cleanModelFile, emptyMcd, MODEL_FILE_RE, MODEL_KINDS, modelFileName } from '@shared/lib/mcd'
import { loadProjects } from '../projects/projectStorage'
import { emptyDiagram, isDiagramKind } from '@shared/lib/uml'
import { parseEnv } from '../envfiles/envFiles'
import { fromEnv } from '../database/dbDetect'

/**
 * v3.9: a project's models, files of its conception/ folder (so versioned with Git).
 * Only for a saved project, and only names DevForge gives: nothing is read or
 * written anywhere else.
 */

const FOLDER = 'conception'

export function projectDir(projectPath: string): string {
  const wanted = resolve(projectPath).toLowerCase()
  const p = loadProjects().find(x => resolve(x.path).toLowerCase() === wanted)
  if (!p || !existsSync(p.path)) throw new Error('Unknown project')
  return p.path
}

function modelPath(projectPath: string, file: string): string {
  if (!MODEL_FILE_RE.test(file)) throw new Error('Invalid model file name')
  return join(projectDir(projectPath), FOLDER, file)
}

/** Written next to it, then moved: a crash never leaves half a file */
function writeModel(path: string, model: ModelFile) {
  const tmp = `${path}.tmp`
  writeFileSync(tmp, JSON.stringify(model, null, 2) + '\n', 'utf-8')
  renameSync(tmp, path)
}

export function listModels(projectPath: string): ModelSummary[] {
  const dir = join(projectDir(projectPath), FOLDER)
  if (!existsSync(dir)) return []
  const out: ModelSummary[] = []
  for (const file of readdirSync(dir)) {
    if (!MODEL_FILE_RE.test(file)) continue
    try {
      const m = cleanModelFile(JSON.parse(readFileSync(join(dir, file), 'utf-8')))
      const sql = join(dir, sqlName(file))
      out.push({
        file, kind: m.kind, name: m.name, updatedAt: m.updatedAt, ...(m.mcd ? { mcd: m.mcd } : {}), ...(m.naming ? { naming: m.naming } : {}), ...(m.mpd ? { mpd: m.mpd } : {}), ...(m.diagram ? { diagram: m.diagram } : {}),
        ...(m.kind === 'mpd' && existsSync(sql) ? { sqlAt: statSync(sql).mtime.toISOString() } : {})
      })
    } catch { /* not ours, or broken: left out */ }
  }
  return out.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

export function readModel(projectPath: string, file: string): ModelFile {
  return cleanModelFile(JSON.parse(readFileSync(modelPath(projectPath, file), 'utf-8')))
}

/** A free file name for this name: "boutique.mcd.json", then "boutique-2.mcd.json"… */
function freeName(dir: string, name: string, kind: ModelKind, keep?: string): string {
  const base = modelFileName(name, kind).replace(`.${kind}.json`, '')
  for (let i = 1; ; i++) {
    const file = `${i === 1 ? base : `${base.slice(0, 56)}-${i}`}.${kind}.json`
    if (file === keep || !existsSync(join(dir, file))) return file
  }
}

export function createModel(projectPath: string, kind: ModelKind, name: string): string {
  if (!MODEL_KINDS.includes(kind)) throw new Error('Unknown model kind')
  const dir = join(projectDir(projectPath), FOLDER)
  mkdirSync(dir, { recursive: true })
  const clean = name.trim().slice(0, 120) || 'Modèle'
  const file = freeName(dir, clean, kind)
  writeModel(join(dir, file), { v: 1, kind, name: clean, updatedAt: new Date().toISOString(), ...(kind === 'mcd' ? { mcd: emptyMcd() } : {}), ...(isDiagramKind(kind) ? { diagram: emptyDiagram() } : {}) })
  return file
}

export function saveModel(projectPath: string, file: string, model: unknown): void {
  const path = modelPath(projectPath, file)
  const clean = cleanModelFile(model)
  // The kind is the file's: a save never turns an MCD into something else
  const kind = file.split('.').slice(-2)[0] as ModelKind
  if (clean.kind !== kind) throw new Error('Model kind does not match its file')
  mkdirSync(join(projectDir(projectPath), FOLDER), { recursive: true })
  writeModel(path, { ...clean, updatedAt: new Date().toISOString() })
}

/** A model's base name: "boutique.mcd.json" → "boutique" (an MCD, its MPD and its SQL share it) */
const baseOf = (file: string) => file.replace(/\.[a-z]+\.json$/, '')
const sqlName = (file: string) => `${baseOf(file)}.sql`

/** Renamed with what goes with it: an MCD's MPD and an MPD's SQL follow, when their new names are free */
export function renameModel(projectPath: string, file: string, name: string): string {
  const path = modelPath(projectPath, file)
  const model = readModel(projectPath, file)
  const clean = name.trim().slice(0, 120)
  if (!clean) throw new Error('A model needs a name')
  const dir = join(projectDir(projectPath), FOLDER)
  const next = freeName(dir, clean, model.kind, file)
  writeModel(path, { ...model, name: clean, updatedAt: new Date().toISOString() })
  if (next === file) return next
  renameSync(path, join(dir, next))
  const was = baseOf(file), now = baseOf(next)
  for (const kind of ['mcd', 'mpd'] as const) {
    const from = join(dir, `${was}.${kind}.json`), to = join(dir, `${now}.${kind}.json`)
    if (kind === model.kind || !existsSync(from) || existsSync(to)) continue
    const other = cleanModelFile(JSON.parse(readFileSync(from, 'utf-8')))
    writeModel(from, { ...other, name: clean, ...(other.mpd ? { mpd: { ...other.mpd, source: `${now}.mcd.json` } } : {}) })
    renameSync(from, to)
  }
  if (existsSync(join(dir, `${was}.sql`)) && !existsSync(join(dir, `${now}.sql`))) renameSync(join(dir, `${was}.sql`), join(dir, `${now}.sql`))
  return next
}

export function removeModel(projectPath: string, file: string): void {
  rmSync(modelPath(projectPath, file), { force: true })
}

/** v3.9 lot 3: the SQL script next to an MPD */
export function writeSql(projectPath: string, file: string, sql: string): string {
  if (!file.endsWith('.mpd.json')) throw new Error('Only an MPD has a SQL script')
  const path = join(modelPath(projectPath, file), '..', sqlName(file))
  const tmp = `${path}.tmp`
  writeFileSync(tmp, sql.slice(0, 2_000_000), 'utf-8')
  renameSync(tmp, path)
  return path
}

/** The engine the project's database runs on, read from its .env files; PostgreSQL when they say nothing */
export function projectEngine(projectPath: string): SqlEngine {
  return projectDatabase(projectPath).engine
}

/** v3.9 lot 4: the project's database as its files describe it: the engine, and its name and port when they say */
export function projectDatabase(projectPath: string): { engine: SqlEngine; database?: string; port?: number } {
  const dir = projectDir(projectPath)
  const env: Record<string, string> = {}
  for (const name of ['.env', '.env.local', 'backend/.env', 'api/.env']) {
    try { Object.assign(env, parseEnv(readFileSync(join(dir, name), 'utf-8'))) } catch { /* no such file */ }
  }
  const url = env.DATABASE_URL ?? env.DB_URL ?? ''
  if (/^(sqlite|file:)/i.test(url) || /sqlite/i.test(env.DB_CONNECTION ?? '')) return { engine: 'sqlite' }
  const db = fromEnv(env)
  if (db) return { engine: db.type, ...(db.database ? { database: db.database } : {}), port: db.port }
  return { engine: composeEngine(dir) }
}

function composeEngine(dir: string): SqlEngine {
  for (const name of ['compose.yaml', 'compose.yml', 'docker-compose.yml', 'docker-compose.yaml']) {
    try {
      const yml = readFileSync(join(dir, name), 'utf-8')
      if (/image:\s*['"]?(mysql|mariadb)/i.test(yml)) return 'mysql'
      if (/image:\s*['"]?postgres/i.test(yml)) return 'postgres'
    } catch { /* no such file */ }
  }
  return 'postgres'
}
