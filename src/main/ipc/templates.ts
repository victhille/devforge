import { ipcMain } from 'electron'
import type { Framework, PackageManager } from '@shared/types'
import { listTemplates, previewTemplate, refreshTemplate, removeTemplate, renameTemplate, saveTemplate } from '../services/projects/userTemplates'

const strings = (v: unknown) => (Array.isArray(v) ? v.filter((s): s is string => typeof s === 'string') : [])

/** v3.8: the user's project templates */
export function registerTemplateHandlers(): void {
  ipcMain.handle('templates:list', () => listTemplates())
  ipcMain.handle('templates:preview', (_e, projectPath: unknown, exclude: unknown) => previewTemplate(String(projectPath ?? ''), strings(exclude)))
  ipcMain.handle('templates:save', (_e, input: { projectPath: string; name: string; description: string; framework: Framework; packageManager: PackageManager; exclude: string[] }) =>
    saveTemplate({
      projectPath: String(input?.projectPath ?? ''), name: String(input?.name ?? ''), description: String(input?.description ?? ''),
      framework: input?.framework, packageManager: input?.packageManager ?? 'npm', exclude: strings(input?.exclude)
    }))
  ipcMain.handle('templates:refresh', (_e, id: unknown) => refreshTemplate(String(id ?? '')))
  ipcMain.handle('templates:rename', (_e, id: unknown, name: unknown, description: unknown) => renameTemplate(String(id ?? ''), String(name ?? ''), String(description ?? '')))
  ipcMain.handle('templates:remove', (_e, id: unknown) => removeTemplate(String(id ?? '')))
}
