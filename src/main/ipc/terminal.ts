import { ipcMain, type BrowserWindow } from 'electron'
import type { TerminalHistoryEntry } from '@shared/types'
import { addHistory, create, history, kill, resize, shells, write } from '../services/terminal/terminalService'

const KINDS = ['powershell', 'pwsh', 'gitbash', 'cmd'] as const
const str = (v: unknown) => typeof v === 'string' ? v : ''

export function registerTerminalHandlers(mainWindow: BrowserWindow): void {
  const send = (channel: string, ...args: unknown[]) => { if (!mainWindow.isDestroyed()) mainWindow.webContents.send(channel, ...args) }
  ipcMain.handle('term:shells', () => shells())
  ipcMain.handle('term:create', (_e, kind: unknown, cwd: unknown, cols: unknown, rows: unknown) => {
    const k = KINDS.find(x => x === kind)
    if (!k) throw new Error('Unknown shell')
    return create(k, str(cwd), Number(cols), Number(rows), (id, data) => send('term:data', id, data), (id, code) => send('term:exit', id, code))
  })
  ipcMain.handle('term:write', (_e, id: unknown, data: unknown) => write(str(id), str(data)))
  ipcMain.handle('term:resize', (_e, id: unknown, cols: unknown, rows: unknown) => resize(str(id), Number(cols), Number(rows)))
  ipcMain.handle('term:kill', (_e, id: unknown) => kill(str(id)))
  ipcMain.handle('term:history', (_e, key: unknown) => history(str(key)))
  ipcMain.handle('term:history-add', (_e, key: unknown, entry: TerminalHistoryEntry) => addHistory(str(key), entry ?? { cmd: '', at: '', code: null }))
}
