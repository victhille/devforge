import { join } from 'path'
import type { Project, ProjectNote } from '@shared/types'
import { checklistItems, insertItem, isHtmlNotes, notesToText, removeItem, setItemChecked, toHtmlBody, type ChecklistItem } from '@shared/lib/notesFormat'
import { addTasks, findTasksNote, peekNotes, projectNotes, removeNote, savedProject, tasksTitle, writeNoteBody } from '../notes/projectNotes'
import { ToolError } from './assistantTools'

/**
 * Forgy and a project's notes. Reading is a tool; adding, checking or
 * removing a task (a checkbox of the notes) is an action the user approves,
 * which can be undone.
 *
 * The notes are files of the project, possibly written by others: Forgy gets
 * them inside <project_notes> (data, never instructions), reads them where they
 * are (the old notes of v3.8 are not moved before a click), and an action
 * writes the note in place: same file, same title, nothing renamed. A note
 * written by hand in Markdown is left as it is (Forgy would turn it into HTML).
 */

const MAX_TEXT = 8000

/** The block's name inside a note (`</project_notes>`, `</ project_notes >`…) must not end it early */
const quoteNotes = (s: string) => s.replace(/project_notes/gi, 'project-notes')

export function notesText(p: Project): string {
  const notes = peekNotes(p)
  if (!notes.length) return `${p.name} has no notes yet.`
  const boxes = notes.flatMap(n => checklistItems(toHtmlBody(n.body)))
  const open = boxes.filter(b => !b.checked).length
  const parts = notes.map(n => {
    const text = notesToText(toHtmlBody(n.body))
    return `## ${n.title || '(untitled)'}${n.pinned ? ' (pinned)' : ''}\n${text || '(empty)'}`
  })
  let out = ''
  for (const part of parts) {
    if (out.length + part.length > MAX_TEXT) { out += `… [${notes.length - parts.indexOf(part)} more note(s) left out]`; break }
    out += `${part}\n\n`
  }
  return `Notes of ${p.name} (in ${join(p.path, '.devforge', 'notes')}): ${notes.length} note(s), tasks: ${open} open, ${boxes.length - open} done ("- [ ]" open, "- [x]" done)\n`
    + `<project_notes>\n${quoteNotes(out.trim())}\n</project_notes>`
}

export type NotesUndo =
  /** A box added: taken out again (with its note when the add made it and nothing else is in it) */
  | { type: 'task-remove'; projectId: string; noteId: string; text: string; created?: boolean }
  /** A box checked or not: set back */
  | { type: 'task-done'; projectId: string; noteId: string; text: string; done: boolean }
  /** A box removed: put back where it was */
  | { type: 'task-restore'; projectId: string; noteId: string; html: string; index: number }

const norm = (s: string) => s.replace(/\s+/g, ' ').trim().toLowerCase()

/** Written by hand in Markdown: Forgy does not change it (writing it would turn it into HTML) */
const isMarkdown = (n: ProjectNote) => !!n.body.trim() && !isHtmlNotes(n.body)
/**
 * A note named outside <project_notes>: by its file, never by its title,
 * which may come from the repository (a sentence written for Forgy)
 */
const fileOf = (n: ProjectNote) => (n.id ? `${n.id}.md` : 'an old note')
const markdownNote = (n: ProjectNote) => `${fileOf(n)} is written in Markdown: DevForge changes it only when it is edited in the Notes tab`

/** A box by its words: the exact ones first, then the same words in any case; the tasks note before the others */
function findBox(notes: ProjectNote[], text: unknown, noteId?: string): { note: ProjectNote; html: string; item: ChecklistItem; index: number } | null {
  const t = typeof text === 'string' ? text.trim() : ''
  if (!t) return null
  const among = notes.filter(n => !noteId || n.id === noteId)
  const tasks = findTasksNote(among)
  const ordered = tasks ? [tasks, ...among.filter(n => n !== tasks)] : among
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

/** The box again at the click, in the notes as they are then (the old ones moved in): gone, nothing is written */
function boxNow(p: Project, text: string, noteId: string) {
  const now = findBox(projectNotes(p), text, noteId || undefined)
  if (!now) throw new Error('This task is no longer in the notes')
  if (isMarkdown(now.note)) throw new Error(markdownNote(now.note))
  return now
}

export function taskPlan(p: Project, action: unknown, text: unknown, task: unknown): {
  title: string; preview: string; run: () => Promise<{ output: string; undo: NotesUndo }>
} {
  if (action === 'add') {
    const t = typeof text === 'string' ? text.replace(/\s+/g, ' ').trim().slice(0, 500) : ''
    if (!t) throw new ToolError('Missing "text"')
    const tasks = findTasksNote(peekNotes(p))
    if (tasks && isMarkdown(tasks)) throw new ToolError(markdownNote(tasks))
    return {
      title: `Add a task · ${p.name}`,
      preview: `[ ] ${t}`,
      run: async () => {
        const before = findTasksNote(projectNotes(p))
        if (before && isMarkdown(before)) throw new Error(markdownNote(before))
        const { added, note } = addTasks(p, [t])
        if (!added.length || !note) return { output: `"${t}" is already a task of ${p.name}`, undo: { type: 'task-remove', projectId: p.id, noteId: '', text: '' } }
        return { output: `Task added to ${fileOf(note)} of ${p.name}`, undo: { type: 'task-remove', projectId: p.id, noteId: note.id, text: t, created: !before } }
      }
    }
  }
  if (action === 'done' || action === 'reopen' || action === 'remove') {
    const found = findBox(peekNotes(p), task ?? text)
    if (!found) throw new ToolError(`Unknown task: give its text, as project_notes shows it (in "${tasksTitle()}" or another note)`)
    const { note, item } = found
    if (isMarkdown(note)) throw new ToolError(markdownNote(note))
    if (action === 'remove') {
      return {
        title: `Remove a task · ${p.name}`,
        preview: `[${item.checked ? 'x' : ' '}] ${item.text}`,
        run: async () => {
          const now = boxNow(p, item.text, note.id)
          const saved = writeNoteBody(p, now.note.id, removeItem(now.html, now.item))
          return { output: `Task removed from ${fileOf(saved)}`, undo: { type: 'task-restore', projectId: p.id, noteId: saved.id, html: now.html.slice(now.item.start, now.item.end), index: now.index } }
        }
      }
    }
    const done = action === 'done'
    return {
      title: `${done ? 'Check' : 'Reopen'} a task · ${p.name}`,
      preview: `[${done ? 'x' : ' '}] ${item.text}`,
      run: async () => {
        const now = boxNow(p, item.text, note.id)
        const saved = writeNoteBody(p, now.note.id, setItemChecked(now.html, now.item, done))
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
    writeNoteBody(p, note.id, insertItem(toHtmlBody(note.body), u.html, u.index))
    return 'Task put back'
  }
  if (!u.text) return 'Nothing to undo'
  const box = findBox(projectNotes(p), u.text, u.noteId)
  if (!box) throw new Error('This task is no longer in the notes')
  if (u.type === 'task-remove') {
    const body = removeItem(box.html, box.item)
    // The add made this note: with nothing else in it, it goes too
    if (u.created && !checklistItems(body).length && !notesToText(body).trim()) removeNote(p.id, box.note.id)
    else writeNoteBody(p, box.note.id, body)
    return 'Task removed'
  }
  writeNoteBody(p, box.note.id, setItemChecked(box.html, box.item, u.done))
  return u.done ? 'Task checked again' : 'Task reopened'
}
