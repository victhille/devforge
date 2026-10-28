import type { Project } from '@shared/types'
import { addTask, getNotes, removeTask, setTaskDone } from '../notes/projectNotes'
import { ToolError } from './assistantTools'

/**
 * v3.8: Forgy and a project's tasks and notes. Reading is a tool; adding or
 * checking a task is an action the user approves, which can be undone.
 */

export function notesText(p: Project): string {
  const n = getNotes(p.id)
  if (!n.tasks.length && !n.notes.trim()) return `${p.name} has no tasks nor notes yet.`
  const open = n.tasks.filter(t => !t.done)
  const done = n.tasks.filter(t => t.done)
  return [
    `Tasks of ${p.name}: ${open.length} open, ${done.length} done`,
    ...open.map(t => `- [ ] ${t.text} (id ${t.id})`),
    ...done.slice(-10).map(t => `- [x] ${t.text}${t.doneAt ? ` (done ${t.doneAt.slice(0, 10)})` : ''}`),
    '',
    n.notes.trim() ? `Notes (Markdown):\n${n.notes.slice(0, 6000)}` : 'No notes.'
  ].join('\n')
}

export type NotesUndo =
  | { type: 'task-remove'; projectId: string; taskId: string }
  | { type: 'task-done'; projectId: string; taskId: string; done: boolean }

export function taskPlan(p: Project, action: unknown, text: unknown, taskId: unknown): {
  title: string; preview: string; run: () => Promise<{ output: string; undo: NotesUndo }>
} {
  if (action === 'add') {
    const t = typeof text === 'string' ? text.trim() : ''
    if (!t) throw new ToolError('Missing "text"')
    return {
      title: `Add a task · ${p.name}`,
      preview: `[ ] ${t.slice(0, 500)}`,
      run: async () => {
        const task = addTask(p.id, t)
        return { output: `Task added to ${p.name}`, undo: { type: 'task-remove', projectId: p.id, taskId: task.id } }
      }
    }
  }
  if (action === 'done' || action === 'reopen') {
    const task = getNotes(p.id).tasks.find(x => x.id === taskId || x.text === taskId)
    if (!task) throw new ToolError('Unknown task: give its id (from project_notes)')
    const done = action === 'done'
    return {
      title: `${done ? 'Check' : 'Reopen'} a task · ${p.name}`,
      preview: `[${done ? 'x' : ' '}] ${task.text}`,
      run: async () => {
        const before = setTaskDone(p.id, task.id, done)
        return { output: `Task ${done ? 'done' : 'reopened'}`, undo: { type: 'task-done', projectId: p.id, taskId: task.id, done: !!before?.done } }
      }
    }
  }
  throw new ToolError('"action" must be add, done or reopen')
}

export function undoNotes(u: NotesUndo): string {
  if (u.type === 'task-remove') { removeTask(u.projectId, u.taskId); return 'Task removed' }
  setTaskDone(u.projectId, u.taskId, u.done)
  return u.done ? 'Task checked again' : 'Task reopened'
}
