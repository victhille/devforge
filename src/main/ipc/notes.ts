import { ipcMain } from 'electron'
import type { NoteInput } from '@shared/types'
import { addTasksById, listNotes, openCounts, readNote, removeNote, saveNote } from '../services/notes/projectNotes'

/** A project's notes, files of the project: the window names the project and the note, never a path */
export function registerNotesHandlers(): void {
  ipcMain.handle('notes:list', (_e, projectId: unknown) => listNotes(projectId))
  ipcMain.handle('notes:read', (_e, projectId: unknown, id: unknown) => readNote(projectId, id))
  ipcMain.handle('notes:save', (_e, projectId: unknown, note: NoteInput) => saveNote(projectId, note))
  ipcMain.handle('notes:remove', (_e, projectId: unknown, id: unknown) => removeNote(projectId, id))
  ipcMain.handle('notes:add-tasks', (_e, projectId: unknown, texts: unknown) => addTasksById(projectId, texts))
  ipcMain.handle('notes:counts', () => openCounts())
}
