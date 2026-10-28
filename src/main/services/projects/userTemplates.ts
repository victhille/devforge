import { existsSync, mkdirSync, readFileSync, rmSync } from 'fs'
import { lstat, mkdir, readdir, readFile, writeFile } from 'fs/promises'
import { dirname, join } from 'path'
import { randomUUID } from 'crypto'
import { promisify } from 'util'
import { gunzip, gzip } from 'zlib'
import { app } from 'electron'
import type { Framework, PackageManager, TemplatePreview, UserTemplate } from '@shared/types'
import { isExcluded, packFiles, renameIn, unpackFiles } from '@shared/lib/userTemplates'
import { writeJsonFile } from '../../lib/jsonFile'

/**
 * v3.8 lot 5: projects saved as templates. The list in templates.json, each
 * template's files in one archive (templates/<id>.dftpl); never a .env.
 */

const MAX_FILES = 20_000
const MAX_BYTES = 200 * 1024 * 1024

const dataDir = () => app.getPath('userData')
const indexFile = () => join(dataDir(), 'templates.json')
const archive = (id: string) => join(dataDir(), 'templates', `${id}.dftpl`)

export function listTemplates(): UserTemplate[] {
  try {
    const raw = JSON.parse(readFileSync(indexFile(), 'utf-8'))
    return Array.isArray(raw) ? raw.filter(t => t && typeof t.id === 'string' && existsSync(archive(t.id))) : []
  } catch { return [] }
}

const saveList = (list: UserTemplate[]) => writeJsonFile(indexFile(), list)

const find = (id: string) => {
  const t = listTemplates().find(x => x.id === id)
  if (!t) throw new Error('Unknown template')
  return t
}

/** Every file kept, relative paths with `/`; stops past the limits */
async function walk(root: string, exclude: string[]): Promise<{ files: { rel: string; size: number }[]; skipped: Set<string>; tooBig: boolean }> {
  const files: { rel: string; size: number }[] = []
  const skipped = new Set<string>()
  let bytes = 0
  const visit = async (rel: string): Promise<boolean> => {
    for (const entry of await readdir(join(root, rel), { withFileTypes: true })) {
      const path = rel ? `${rel}/${entry.name}` : entry.name
      if (isExcluded(path, exclude)) { if (!rel) skipped.add(entry.name); continue }
      if (entry.isSymbolicLink()) continue
      if (entry.isDirectory()) { if (!await visit(path)) return false; continue }
      if (!entry.isFile()) continue
      const size = (await lstat(join(root, path))).size
      files.push({ rel: path, size })
      bytes += size
      if (files.length > MAX_FILES || bytes > MAX_BYTES) return false
    }
    return true
  }
  const ok = await visit('')
  return { files, skipped, tooBig: !ok }
}

export async function previewTemplate(projectPath: string, exclude: string[]): Promise<TemplatePreview> {
  const { files, skipped, tooBig } = await walk(projectPath, exclude)
  return { files: files.length, bytes: files.reduce((n, f) => n + f.size, 0), skipped: [...skipped].sort(), tooBig }
}

async function pack(projectPath: string, exclude: string[], id: string): Promise<{ files: number; bytes: number }> {
  const { files, tooBig } = await walk(projectPath, exclude)
  if (tooBig) throw new Error('TOO_BIG')
  const data = await Promise.all(files.map(async f => ({ path: f.rel, data: await readFile(join(projectPath, f.rel)) })))
  mkdirSync(dirname(archive(id)), { recursive: true })
  await writeFile(archive(id), await promisify(gzip)(packFiles(data)))
  return { files: files.length, bytes: files.reduce((n, f) => n + f.size, 0) }
}

export async function saveTemplate(input: { projectPath: string; name: string; description: string; framework: Framework; packageManager: PackageManager; exclude: string[] }): Promise<UserTemplate> {
  const name = input.name.trim().slice(0, 80)
  if (!name) throw new Error('Name required')
  if (!existsSync(input.projectPath)) throw new Error('Project folder not found')
  const id = randomUUID()
  const exclude = input.exclude.filter(p => typeof p === 'string' && p.trim()).slice(0, 100)
  const counts = await pack(input.projectPath, exclude, id)
  const now = new Date().toISOString()
  const template: UserTemplate = {
    id, name, description: input.description.trim().slice(0, 300), framework: input.framework, packageManager: input.packageManager,
    sourcePath: input.projectPath, sourceName: input.projectPath.replace(/[/\\]+$/, '').split(/[/\\]/).pop() ?? name,
    exclude, ...counts, createdAt: now, updatedAt: now
  }
  saveList([...listTemplates(), template])
  return template
}

export async function refreshTemplate(id: string): Promise<UserTemplate> {
  const t = find(id)
  if (!existsSync(t.sourcePath)) throw new Error('SOURCE_GONE')
  const counts = await pack(t.sourcePath, t.exclude, id)
  const next = { ...t, ...counts, updatedAt: new Date().toISOString() }
  saveList(listTemplates().map(x => (x.id === id ? next : x)))
  return next
}

export function renameTemplate(id: string, name: string, description: string): void {
  const clean = name.trim().slice(0, 80)
  if (!clean) throw new Error('Name required')
  find(id)
  saveList(listTemplates().map(x => (x.id === id ? { ...x, name: clean, description: description.trim().slice(0, 300) } : x)))
}

export function removeTemplate(id: string): void {
  rmSync(archive(id), { force: true })
  saveList(listTemplates().filter(x => x.id !== id))
}

/** The template's files written into a new folder, the project's name replaced; the number of files */
export async function extractTemplate(id: string, dest: string, newName: string): Promise<number> {
  const t = find(id)
  const files = unpackFiles(await promisify(gunzip)(await readFile(archive(id))))
  for (const f of files) {
    const target = join(dest, f.path)
    await mkdir(dirname(target), { recursive: true })
    const text = /^(package(-lock)?\.json|composer\.json|pyproject\.toml|cargo\.toml|readme(\.md)?)$/i.test(f.path)
      ? renameIn(f.path, Buffer.from(f.data).toString('utf-8'), t.sourceName, newName) : null
    await writeFile(target, text ?? f.data)
  }
  return files.length
}
