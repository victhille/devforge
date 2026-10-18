import { ipcMain, type BrowserWindow } from 'electron'
import type { AssistantConfigUpdate, AssistantSendRequest } from '@shared/types'
import { getConfig, listConversations, loadConversation, publicConversation, removeConversation, saveConfig } from '../services/assistant/assistantStorage'
import { sendToAssistant, setAssistantEmitter, stopAssistant } from '../services/assistant/assistantService'

export function registerAssistantHandlers(win: BrowserWindow): void {
  setAssistantEmitter(e => { if (!win.isDestroyed()) win.webContents.send('assistant:event', e) })
  ipcMain.handle('assistant:get-config',  () => getConfig())
  ipcMain.handle('assistant:save-config', (_e, u: AssistantConfigUpdate) => saveConfig(u))
  ipcMain.handle('assistant:send',        (_e, req: AssistantSendRequest) => sendToAssistant(req))
  ipcMain.handle('assistant:stop',        (_e, id: string) => stopAssistant(id))
  ipcMain.handle('assistant:list',        () => listConversations())
  ipcMain.handle('assistant:get',         (_e, id: string) => { const c = loadConversation(id); return c ? publicConversation(c) : null })
  ipcMain.handle('assistant:remove',      (_e, id: string) => removeConversation(id))
}
