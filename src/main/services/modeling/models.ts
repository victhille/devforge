import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'fs'
import { join, resolve } from 'path'
import type { ModelFile, ModelKind, ModelSummary } from '@shared/types'
import { cleanModelFile, emptyMcd, MODEL_FILE_RE, MODEL_KINDS, modelFileName } from '@shared/lib/mcd'
import { loadProjects } from '../projects/projectStorage'

/**
 * v3.9: a project's models, files of its conception/ folder (so versioned with Git).
 * Only for a saved project, and only names DevForge gives: nothing is read or
 * written anywhere else.
 */

const FOLDER = 'conception'

function projectDir(projectPath: string): string {
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
      out.push({ file, kind: m.kind, name: m.name, updatedAt: m.updatedAt, ...(m.mcd ? { mcd: m.mcd } : {}) })
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
  writeModel(join(dir, file), { v: 1, kind, name: clean, updatedAt: new Date().toISOString(), ...(kind === 'mcd' ? { mcd: emptyMcd() } : {}) })
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

export function renameModel(projectPath: string, file: string, name: string): string {
  const path = modelPath(projectPath, file)
  const model = readModel(projectPath, file)
  const clean = name.trim().slice(0, 120)
  if (!clean) throw new Error('A model needs a name')
  const dir = join(projectDir(projectPath), FOLDER)
  const next = freeName(dir, clean, model.kind, file)
  writeModel(path, { ...model, name: clean, updatedAt: new Date().toISOString() })
  if (next !== file) renameSync(path, join(dir, next))
  return next
}

export function removeModel(projectPath: string, file: string): void {
  rmSync(modelPath(projectPath, file), { force: true })
}
