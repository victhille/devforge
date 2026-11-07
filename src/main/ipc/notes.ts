import { ipcMain } from 'electron'
import type { ProjectNotes } from '@shared/types'
import { getNotes, openCounts, saveNotes } from '../services/notes/projectNotes'

/** v3.8: each project's tasks and notes */
export function registerNotesHandlers(): void {
  ipcMain.handle('notes:get', (_e, projectId: unknown) => getNotes(String(projectId ?? '')))
  ipcMain.handle('notes:save', (_e, projectId: unknown, notes: ProjectNotes) => saveNotes(String(projectId ?? ''), notes))
  ipcMain.handle('notes:counts', () => openCounts())
}
