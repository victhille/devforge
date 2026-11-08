import { lstatSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, type Stats } from 'fs'
import { join } from 'path'
import { app } from 'electron'
import type { NoteInput, NoteSummary, Project, ProjectNote } from '@shared/types'
import { blocksOnLines, checklistHtml, checklistItems, countOpen, insertItem, isHtmlNotes, itemHtml, toHtmlBody } from '@shared/lib/notesFormat'
import { writeJsonFile, writeTextFile } from '../../lib/jsonFile'
import { dataChanged } from '../../lib/changes'
import { loadProjects } from '../projects/projectStorage'
import { loadSettings } from '../settings/settingsService'

/**
 * A project's notes live in the project: one file per note,
 * <project>/.devforge/notes/<id>.md, so they follow Git. A file is a short
 * header (title, pinned) then the editor's HTML, which Markdown accepts: the
 * file reads well on GitHub. A file written by hand in Markdown opens too.
 *
 * The folder is always the saved project's (the window only names the
 * project), an id is checked against NOTE_ID before it becomes a file name,
 * and the notes of v3.8 (project-notes.json in DevForge's data) move into the
 * project the first time its notes are read.
 */

export const NOTE_ID = /^[a-z0-9][a-z0-9-]{0,79}$/
export const MAX_BODY = 200_000
export const MAX_NOTES = 500
const MAX_TITLE = 200
/** Bigger than any note DevForge writes (200 000 characters of UTF-8 and the header): not read */
const MAX_FILE = 1_000_000

// ─── The folder and the files ────────────────────────────────────────────────

const lstatOrNull = (path: string): Stats | null => { try { return lstatSync(path) } catch { return null } }

/** A saved project by its id */
export function savedProject(projectId: unknown): Project {
  const p = typeof projectId === 'string' && projectId ? loadProjects().find(x => x.id === projectId) : undefined
  if (!p) throw new Error('Unknown project')
  return p
}

/**
 * <project>/.devforge/notes, made of plain folders (a link could lead out of
 * the project); null while it does not exist and `create` is false.
 */
function notesDir(p: Project, create: boolean): string | null {
  let root: Stats | null = null
  try { root = statSync(p.path) } catch { /* moved or deleted */ }
  if (!root?.isDirectory()) {
    if (!create) return null
    throw new Error(`Project folder not found: ${p.path}`)
  }
  let dir = p.path
  for (const part of ['.devforge', 'notes']) {
    dir = join(dir, part)
    const st = lstatOrNull(dir)
    if (!st) {
      if (!create) return null
      mkdirSync(dir)
      continue
    }
    if (st.isSymbolicLink() || !st.isDirectory()) throw new Error(`Not a plain folder: ${dir}`)
  }
  return dir
}

function noteFile(dir: string, id: unknown): string {
  if (typeof id !== 'string' || !NOTE_ID.test(id)) throw new Error('Invalid note id')
  return join(dir, `${id}.md`)
}

/** The names already used in the folder (lower-cased: Windows does not tell Notes.md from notes.md) */
const takenIds = (dir: string) => new Set(readdirSync(dir).filter(f => /\.md$/i.test(f)).map(f => f.slice(0, -3).toLowerCase()))

// ─── The file's format ───────────────────────────────────────────────────────

const FRONT = /^\uFEFF?---[ \t]*\r?\n(?:([\s\S]*?)\r?\n)?---[ \t]*(?:\r?\n|$)/

function unquote(v: string): string {
  if (v.startsWith('"')) { try { return String(JSON.parse(v)) } catch { return v.slice(1, v.length > 1 && v.endsWith('"') ? -1 : undefined) } }
  if (v.startsWith("'")) return v.slice(1, v.length > 1 && v.endsWith("'") ? -1 : undefined).replace(/''/g, "'")
  // A comment after a plain value
  return v.replace(/\s+#.*$/, '')
}

const cleanTitle = (t: string) => t.replace(/[\s\p{Cc}]+/gu, ' ').trim().slice(0, MAX_TITLE)

/** A note file's text; `id` and `updatedAt` come from its name and its date */
export function parseNote(id: string, text: string, updatedAt: string): ProjectNote {
  const m = FRONT.exec(text)
  let title: string | null = null
  let pinned = false
  let body = text.replace(/^\uFEFF/, '')
  if (m) {
    body = text.slice(m[0].length)
    for (const line of (m[1] ?? '').split(/\r?\n/)) {
      const kv = /^([A-Za-z_][\w-]*)\s*:\s*(.*)$/.exec(line)
      if (!kv) continue
      const key = kv[1].toLowerCase()
      const value = unquote(kv[2].trim())
      if (key === 'title') title = value
      else if (key === 'pinned') pinned = /^(true|yes|on)$/i.test(value)
    }
  }
  if (title === null) {
    // Written by hand: its first heading names it, else its file's name
    const h = isHtmlNotes(body) ? null : /^\s*#\s+(.+?)\s*#*[ \t]*(?:\r?\n|$)/.exec(body)
    if (h) { title = h[1]; body = body.slice(h[0].length) }
    else title = id.replace(/-/g, ' ')
  }
  return { id, title: cleanTitle(title), pinned, body, updatedAt }
}

/** A title YAML reads as it is; any other is quoted */
const plainTitle = (t: string) => /^[^\s"'#:\-?[\]{}!&*|>%@`,]/.test(t) && !/:\s|:$|\s#/.test(t) && !/^(true|false|yes|no|on|off|null|~|[\d.+-].*)$/i.test(t) && t === t.trim()

/** The body as the file holds it: HTML one block per line, Markdown as it is */
const fileBody = (body: string) => (isHtmlNotes(body) ? blocksOnLines(body) : body)

export function serializeNote(n: { title: string; pinned: boolean; body: string }): string {
  return `---\ntitle: ${plainTitle(n.title) ? n.title : JSON.stringify(n.title)}\npinned: ${n.pinned}\n---\n${fileBody(n.body)}`
}

function readNoteFile(dir: string, id: unknown): ProjectNote | null {
  const file = noteFile(dir, id)
  const st = lstatOrNull(file)
  // A link is not followed
  if (!st?.isFile()) return null
  if (st.size > MAX_FILE) throw new Error('This note is too large to open')
  return parseNote(id as string, readFileSync(file, 'utf-8'), st.mtime.toISOString())
}

const byOrder = (a: { pinned: boolean; updatedAt: string; title: string }, b: { pinned: boolean; updatedAt: string; title: string }) =>
  Number(b.pinned) - Number(a.pinned) || b.updatedAt.localeCompare(a.updatedAt) || a.title.localeCompare(b.title)

/** Every note of the folder, pinned ones first, then the last changed (a file that cannot be read is left out) */
function readAll(dir: string): ProjectNote[] {
  const ids = readdirSync(dir).filter(f => f.endsWith('.md')).map(f => f.slice(0, -3)).filter(id => NOTE_ID.test(id)).slice(0, MAX_NOTES)
  return ids.flatMap(id => { try { const n = readNoteFile(dir, id); return n ? [n] : [] } catch { return [] } }).sort(byOrder)
}

function writeNote(file: string, n: { title: string; pinned: boolean; body: string }): void {
  writeTextFile(file, serializeNote(n))
}

/** A safe file name made from a title: « Comptes de test Stripe » → comptes-de-test-stripe */
export function slugify(title: string): string {
  const s = title.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/œ/g, 'oe').replace(/æ/g, 'ae').replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+/, '').slice(0, 60).replace(/-+$/, '')
  return s || 'note'
}

function freeId(base: string, taken: Set<string>): string {
  if (!taken.has(base)) return base
  for (let n = 2; ; n++) if (!taken.has(`${base}-${n}`)) return `${base}-${n}`
}

/** Its file still says its title (taches, taches-2…): no need to rename it */
const fitsTitle = (id: string, title: string) => { const base = slugify(title); return id === base || new RegExp(`^${base}-\\d+$`).test(id) }

// ─── The notes of v3.8, moved into the project ───────────────────────────────

interface LegacyNotes { tasks?: { text?: unknown; done?: unknown }[]; notes?: unknown }

const legacyFile = () => join(app.getPath('userData'), 'project-notes.json')

function readLegacy(): Record<string, LegacyNotes> {
  try {
    const raw = JSON.parse(readFileSync(legacyFile(), 'utf-8'))
    return raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {}
  } catch { return {} }
}

const legacyTasks = (n: LegacyNotes | undefined) => (Array.isArray(n?.tasks) ? n.tasks : [])
  .flatMap(t => (t && typeof t.text === 'string' && t.text.trim() ? [{ text: t.text.trim(), checked: !!t.done }] : []))

/** The note that holds the project's tasks, in the app's language */
export const tasksTitle = () => (loadSettings().language === 'en' ? 'Tasks' : 'Tâches')
const isTasksTitle = (t: string) => ['taches', 'tasks'].includes(t.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase())

/**
 * The project's entry of project-notes.json becomes notes: its tasks a pinned
 * « Tâches » checklist (done ones checked), its text a « Notes » note. The
 * entry leaves the JSON only once the files are written: a write that fails
 * keeps everything where it was. A note written by an earlier try is not
 * written twice.
 */
export function migrateLegacy(p: Project): void {
  const all = readLegacy()
  const entry = all[p.id]
  if (!entry) return
  const tasks = legacyTasks(entry)
  const text = typeof entry.notes === 'string' ? entry.notes : ''
  const fresh: { title: string; pinned: boolean; body: string }[] = []
  if (tasks.length) fresh.push({ title: tasksTitle(), pinned: true, body: checklistHtml(tasks) })
  if (text.trim()) fresh.push({ title: 'Notes', pinned: false, body: text.slice(0, MAX_BODY) })
  if (fresh.length) {
    const dir = notesDir(p, true)!
    const have = readAll(dir)
    const taken = takenIds(dir)
    for (const n of fresh) {
      const body = fileBody(n.body).trim()
      if (have.some(h => h.title === n.title && h.body.trim() === body)) continue
      const id = freeId(slugify(n.title), taken)
      taken.add(id)
      writeNote(join(dir, `${id}.md`), n)
    }
  }
  delete all[p.id]
  if (Object.keys(all).length) writeJsonFile(legacyFile(), all)
  else rmSync(legacyFile(), { force: true })
  dataChanged('notes', p.path)
}

// ─── What the window and Forgy use ───────────────────────────────────────────

/** Every note of a saved project, with its text (its old notes moved in first) */
export function projectNotes(p: Project): ProjectNote[] {
  migrateLegacy(p)
  const dir = notesDir(p, false)
  return dir ? readAll(dir) : []
}

export function listNotes(projectId: unknown): NoteSummary[] {
  return projectNotes(savedProject(projectId)).map(({ body, ...n }) => ({ ...n, open: countOpen(body) }))
}

export function readNote(projectId: unknown, id: unknown): ProjectNote {
  const p = savedProject(projectId)
  migrateLegacy(p)
  const dir = notesDir(p, false)
  const note = dir ? readNoteFile(dir, id) : null
  if (!note) throw new Error('Note not found')
  return note
}

/** What the window sends, kept to its shape */
function cleanInput(n: NoteInput): { title: string; pinned: boolean; body: string } {
  if (!n || typeof n !== 'object') throw new Error('Invalid note')
  const body = typeof n.body === 'string' ? n.body : ''
  if (body.length > MAX_BODY) throw new Error(`A note holds at most ${MAX_BODY} characters`)
  return { title: cleanTitle(typeof n.title === 'string' ? n.title : ''), pinned: n.pinned === true, body }
}

/**
 * Writes a note: a new one (no id) gets a free name made from its title; a
 * renamed one moves to its new name (written there first, then the old file
 * goes).
 */
export function saveNote(projectId: unknown, input: NoteInput): ProjectNote {
  const p = savedProject(projectId)
  const note = cleanInput(input)
  migrateLegacy(p)
  const dir = notesDir(p, true)!
  const taken = takenIds(dir)
  const given = input.id == null || input.id === '' ? undefined : input.id
  if (given !== undefined) noteFile(dir, given)
  const exists = given !== undefined && !!lstatOrNull(noteFile(dir, given))?.isFile()
  if (!exists && taken.size >= MAX_NOTES) throw new Error(`A project holds at most ${MAX_NOTES} notes`)
  let id: string
  if (given !== undefined && fitsTitle(given, note.title)) id = given
  else {
    if (given !== undefined) taken.delete(given)
    id = freeId(slugify(note.title), taken)
  }
  const file = noteFile(dir, id)
  writeNote(file, note)
  if (exists && given !== id) rmSync(noteFile(dir, given), { force: true })
  dataChanged('notes', p.path)
  return { id, ...note, updatedAt: statSync(file).mtime.toISOString() }
}

export function removeNote(projectId: unknown, id: unknown): void {
  const p = savedProject(projectId)
  const dir = notesDir(p, false)
  if (!dir) return
  const file = noteFile(dir, id)
  const st = lstatOrNull(file)
  if (!st) return
  if (st.isDirectory()) throw new Error('Not a note')
  rmSync(file, { force: true })
  dataChanged('notes', p.path)
}

/** The project's tasks note (pinned ones first), if there is one */
export const findTasksNote = (notes: ProjectNote[]) => notes.find(n => isTasksTitle(n.title))

/**
 * Boxes added at the end of the tasks note (made, pinned, when there is
 * none); the texts already checkboxes somewhere in the notes are left alone.
 */
export function addTasks(p: Project, texts: unknown): { added: string[]; note: ProjectNote | null } {
  const notes = projectNotes(p)
  const have = new Set(notes.flatMap(n => checklistItems(toHtmlBody(n.body)).map(i => i.text)))
  const fresh = [...new Set((Array.isArray(texts) ? texts : []).flatMap(t => (typeof t === 'string' ? [t.replace(/\s+/g, ' ').trim().slice(0, 500)] : [])))]
    .filter(t => t && !have.has(t))
  if (!fresh.length) return { added: [], note: null }
  const note = findTasksNote(notes)
  const body = fresh.reduce((html, t) => insertItem(html, itemHtml(t)), note ? toHtmlBody(note.body) : '')
  const saved = saveNote(p.id, { id: note?.id, title: note?.title ?? tasksTitle(), pinned: note?.pinned ?? true, body })
  return { added: fresh, note: saved }
}

export const addTasksById = (projectId: unknown, texts: unknown): number => addTasks(savedProject(projectId), texts).added.length

/**
 * Boxes left to check per project, for the project cards and the Notes tab.
 * Nothing is moved nor written here: a project whose old notes are still in
 * project-notes.json counts them from there.
 */
export function openCounts(): Record<string, number> {
  const legacy = readLegacy()
  const out: Record<string, number> = {}
  for (const p of loadProjects()) {
    const old = legacy[p.id]
    let n = old ? legacyTasks(old).filter(t => !t.checked).length + (typeof old.notes === 'string' ? countOpen(old.notes) : 0) : 0
    try {
      const dir = notesDir(p, false)
      if (dir) n += readAll(dir).reduce((sum, x) => sum + countOpen(x.body), 0)
    } catch { /* a folder out of reach counts nothing */ }
    if (n > 0) out[p.id] = n
  }
  return out
}
