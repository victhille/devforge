import { readFileSync } from 'fs'
import { join } from 'path'
import { randomUUID } from 'crypto'
import { app } from 'electron'
import type { NoteTask, ProjectNotes } from '@shared/types'
import { writeJsonFile } from '../../lib/jsonFile'

/**
 * v3.8 lot 1: each project's tasks and notes, kept in DevForge's data
 * (project-notes.json, by project id), never in the project's folder.
 */

const file = () => join(app.getPath('userData'), 'project-notes.json')
const MAX_TASKS = 500
const MAX_NOTES = 200_000

function readAll(): Record<string, ProjectNotes> {
  try {
    const raw = JSON.parse(readFileSync(file(), 'utf-8'))
    return raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {}
  } catch { return {} }
}

const empty = (): ProjectNotes => ({ tasks: [], notes: '', updatedAt: '' })

export function getNotes(projectId: string): ProjectNotes {
  return readAll()[projectId] ?? empty()
}

/** What the window sends, kept to its shape */
function clean(n: ProjectNotes): ProjectNotes {
  const tasks: NoteTask[] = (Array.isArray(n?.tasks) ? n.tasks : []).slice(0, MAX_TASKS).flatMap(t =>
    t && typeof t.text === 'string' && t.text.trim()
      ? [{ id: typeof t.id === 'string' && t.id ? t.id : randomUUID(), text: t.text.trim().slice(0, 500), done: !!t.done, createdAt: String(t.createdAt ?? new Date().toISOString()), ...(t.done && t.doneAt ? { doneAt: String(t.doneAt) } : {}) }]
      : [])
  return { tasks, notes: typeof n?.notes === 'string' ? n.notes.slice(0, MAX_NOTES) : '', updatedAt: new Date().toISOString() }
}

export function saveNotes(projectId: string, notes: ProjectNotes): ProjectNotes {
  if (typeof projectId !== 'string' || !projectId) throw new Error('Unknown project')
  const all = readAll()
  const next = clean(notes)
  if (!next.tasks.length && !next.notes.trim()) delete all[projectId]
  else all[projectId] = next
  writeJsonFile(file(), all)
  return next
}

/** Open tasks per project, for the project cards */
export function openCounts(): Record<string, number> {
  return Object.fromEntries(Object.entries(readAll()).map(([id, n]) => [id, (n.tasks ?? []).filter(t => !t.done).length]).filter(([, c]) => (c as number) > 0))
}

export function addTask(projectId: string, text: string): NoteTask {
  const n = getNotes(projectId)
  const task: NoteTask = { id: randomUUID(), text: text.trim().slice(0, 500), done: false, createdAt: new Date().toISOString() }
  saveNotes(projectId, { ...n, tasks: [...n.tasks, task] })
  return task
}

/** Done or not; returns the task as it was (for an undo) */
export function setTaskDone(projectId: string, taskId: string, done: boolean): NoteTask | null {
  const n = getNotes(projectId)
  const t = n.tasks.find(x => x.id === taskId)
  if (!t) return null
  saveNotes(projectId, { ...n, tasks: n.tasks.map(x => (x.id === taskId ? { ...x, done, ...(done ? { doneAt: new Date().toISOString() } : { doneAt: undefined }) } : x)) })
  return t
}

export function removeTask(projectId: string, taskId: string): void {
  const n = getNotes(projectId)
  saveNotes(projectId, { ...n, tasks: n.tasks.filter(x => x.id !== taskId) })
}
