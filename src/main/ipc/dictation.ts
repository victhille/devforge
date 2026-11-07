import { BrowserWindow, ipcMain } from 'electron'
import type { DictationProgress } from '@shared/types'
import { loadSettings } from '../services/settings/settingsService'
import { dictationStatus, prepareDictation, removeModel, transcribe } from '../services/dictation/whisper'

/** Download progress goes to every window (app and desktop widget) */
const progress = (p: DictationProgress) => {
  for (const w of BrowserWindow.getAllWindows()) if (!w.isDestroyed()) w.webContents.send('dictation:progress', p)
}
const model = () => (loadSettings().dictationModel === 'small' ? 'small' : 'base')

export function registerDictationHandlers(): void {
  ipcMain.handle('dictation:status', () => dictationStatus(model()))
  ipcMain.handle('dictation:prepare', () => prepareDictation(model(), progress))
  ipcMain.handle('dictation:transcribe', (_e, audio: unknown) => transcribe(audio, model(), loadSettings().language === 'en' ? 'en' : 'fr', progress))
  ipcMain.handle('dictation:remove', () => removeModel(model()))
}
