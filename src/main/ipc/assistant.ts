import { ipcMain, type BrowserWindow } from 'electron'
import type { AssistantConfigUpdate, AssistantSendRequest } from '@shared/types'
import { getConfig, listConversations, loadConversation, monthUsage, publicConversation, removeConversation, saveConfig } from '../services/assistant/assistantStorage'
import { sendToAssistant, setAssistantEmitter, stopAssistant } from '../services/assistant/assistantService'
import { launchAiTool, listAiTools } from '../services/system/aiTools'
import { decideAction, listActions, undoAction } from '../services/assistant/assistantActions'
import { setWidgetEnabled, widgetWindow } from '../widget'

export function registerAssistantHandlers(win: BrowserWindow): void {
  // Both the app and the desktop widget show answers (and Forgy's mood)
  setAssistantEmitter(e => {
    for (const w of [win, widgetWindow()]) if (w && !w.isDestroyed()) w.webContents.send('assistant:event', e)
  })
  ipcMain.handle('assistant:get-config',  () => getConfig())
  ipcMain.handle('assistant:save-config', (_e, u: AssistantConfigUpdate) => {
    const config = saveConfig(u)
    if (typeof u?.desktopWidget === 'boolean') setWidgetEnabled(config.desktopWidget)
    return config
  })
  ipcMain.handle('assistant:send',        (_e, req: AssistantSendRequest) => sendToAssistant(req))
  ipcMain.handle('assistant:stop',        (_e, id: string) => stopAssistant(id))
  ipcMain.handle('assistant:list',        () => listConversations())
  ipcMain.handle('assistant:get',         (_e, id: string) => { const c = loadConversation(id); return c ? publicConversation(c) : null })
  ipcMain.handle('assistant:remove',      (_e, id: string) => removeConversation(id))
  ipcMain.handle('assistant:usage',       () => monthUsage())
  ipcMain.handle('assistant:decide-action', (_e, id: string, approve: boolean) => decideAction(String(id), approve === true))
  ipcMain.handle('assistant:actions',     () => listActions())
  ipcMain.handle('assistant:undo-action', (_e, id: string) => undoAction(String(id)))
  ipcMain.handle('ai-tools:list',         () => listAiTools())
  ipcMain.handle('ai-tools:launch',       (_e, id: unknown, dir: unknown) => launchAiTool(id, dir))
}
