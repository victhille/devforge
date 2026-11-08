import { join } from 'path'
import type { Project, ProjectNote } from '@shared/types'
import { checklistItems, insertItem, notesToText, removeItem, setItemChecked, toHtmlBody, type ChecklistItem } from '@shared/lib/notesFormat'
import { addTasks, findTasksNote, projectNotes, savedProject, saveNote, tasksTitle } from '../notes/projectNotes'
import { ToolError } from './assistantTools'

/**
 * Forgy and a project's notes. Reading is a tool; adding, checking or
 * removing a task (a checkbox of the notes) is an action the user approves,
 * which can be undone.
 */

const MAX_TEXT = 8000

export function notesText(p: Project): string {
  const notes = projectNotes(p)
  if (!notes.length) return `${p.name} has no notes yet.`
  const boxes = notes.flatMap(n => checklistItems(toHtmlBody(n.body)))
  const open = boxes.filter(b => !b.checked).length
  const parts = notes.map(n => {
    const text = notesToText(toHtmlBody(n.body))
    return `## ${n.title || '(untitled)'}${n.pinned ? ' (pinned)' : ''}\n${text || '(empty)'}`
  })
  let out = `Notes of ${p.name} (in ${join(p.path, '.devforge', 'notes')}):${notes.length} note(s), tasks: ${open} open, ${boxes.length - open} done ("- [ ]" open, "- [x]" done)\n\n`
  for (const part of parts) {
    if (out.length + part.length > MAX_TEXT) { out += `… [${notes.length - parts.indexOf(part)} more note(s) left out]`; break }
    out += `${part}\n\n`
  }
  return out.trim()
}

export type NotesUndo =
  /** A box added: taken out again */
  | { type: 'task-remove'; projectId: string; noteId: string; text: string }
  /** A box checked or not: set back */
  | { type: 'task-done'; projectId: string; noteId: string; text: string; done: boolean }
  /** A box removed: put back where it was */
  | { type: 'task-restore'; projectId: string; noteId: string; html: string; index: number }

const norm = (s: string) => s.replace(/\s+/g, ' ').trim().toLowerCase()

/** A box by its words: the exact ones first, then the same words in any case; the tasks note before the others */
function findBox(p: Project, text: unknown, noteId?: string): { note: ProjectNote; html: string; item: ChecklistItem; index: number } | null {
  const t = typeof text === 'string' ? text.trim() : ''
  if (!t) return null
  const notes = projectNotes(p).filter(n => !noteId || n.id === noteId)
  const tasks = findTasksNote(notes)
  const ordered = tasks ? [tasks, ...notes.filter(n => n !== tasks)] : notes
  for (const same of [(a: string) => a === t, (a: string) => norm(a) === norm(t)]) {
    for (const note of ordered) {
      const html = toHtmlBody(note.body)
      const items = checklistItems(html)
      const index = items.findIndex(i => same(i.text))
      if (index >= 0) return { note, html, item: items[index], index }
    }
  }
  return null
}

const write = (p: Project, note: ProjectNote, body: string) => saveNote(p.id, { id: note.id, title: note.title, pinned: note.pinned, body })

export function taskPlan(p: Project, action: unknown, text: unknown, task: unknown): {
  title: string; preview: string; run: () => Promise<{ output: string; undo: NotesUndo }>
} {
  if (action === 'add') {
    const t = typeof text === 'string' ? text.replace(/\s+/g, ' ').trim().slice(0, 500) : ''
    if (!t) throw new ToolError('Missing "text"')
    return {
      title: `Add a task · ${p.name}`,
      preview: `[ ] ${t}`,
      run: async () => {
        const { added, note } = addTasks(p, [t])
        if (!added.length || !note) return { output: `"${t}" is already a task of ${p.name}`, undo: { type: 'task-remove', projectId: p.id, noteId: '', text: '' } }
        return { output: `Task added to the note "${note.title}" of ${p.name}`, undo: { type: 'task-remove', projectId: p.id, noteId: note.id, text: t } }
      }
    }
  }
  if (action === 'done' || action === 'reopen' || action === 'remove') {
    const found = findBox(p, task ?? text)
    if (!found) throw new ToolError(`Unknown task: give its text, as project_notes shows it (in "${tasksTitle()}" or another note)`)
    const { note, item } = found
    if (action === 'remove') {
      return {
        title: `Remove a task · ${p.name}`,
        preview: `[${item.checked ? 'x' : ' '}] ${item.text}`,
        run: async () => {
          const now = findBox(p, item.text, note.id) ?? found
          const saved = write(p, now.note, removeItem(now.html, now.item))
          return { output: `Task removed from "${saved.title}"`, undo: { type: 'task-restore', projectId: p.id, noteId: saved.id, html: now.html.slice(now.item.start, now.item.end), index: now.index } }
        }
      }
    }
    const done = action === 'done'
    return {
      title: `${done ? 'Check' : 'Reopen'} a task · ${p.name}`,
      preview: `[${done ? 'x' : ' '}] ${item.text}`,
      run: async () => {
        const now = findBox(p, item.text, note.id) ?? found
        const saved = write(p, now.note, setItemChecked(now.html, now.item, done))
        return { output: `Task ${done ? 'done' : 'reopened'}`, undo: { type: 'task-done', projectId: p.id, noteId: saved.id, text: now.item.text, done: now.item.checked } }
      }
    }
  }
  throw new ToolError('"action" must be add, done, reopen or remove')
}

export function undoNotes(u: NotesUndo): string {
  const p = savedProject(u.projectId)
  if (u.type === 'task-restore') {
    const note = projectNotes(p).find(n => n.id === u.noteId)
    if (!note) throw new Error('The note of this task is gone')
    write(p, note, insertItem(toHtmlBody(note.body), u.html, u.index))
    return 'Task put back'
  }
  if (!u.text) return 'Nothing to undo'
  const box = findBox(p, u.text, u.noteId)
  if (!box) throw new Error('This task is no longer in the notes')
  if (u.type === 'task-remove') { write(p, box.note, removeItem(box.html, box.item)); return 'Task removed' }
  write(p, box.note, setItemChecked(box.html, box.item, u.done))
  return u.done ? 'Task checked again' : 'Task reopened'
}
