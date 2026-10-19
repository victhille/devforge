import { ipcMain, type IpcMainInvokeEvent } from 'electron'
import { openInApp, resizeWidget, setWidgetOpen, widgetShortcut, widgetWindow } from '../widget'

/** Only the widget page may move or focus the widget */
const fromWidget = (e: IpcMainInvokeEvent) => e.sender === widgetWindow()?.webContents

export function registerWidgetHandlers(): void {
  ipcMain.handle('widget:resize',      (e, w: unknown, h: unknown) => { if (fromWidget(e)) resizeWidget(Number(w), Number(h)) })
  ipcMain.handle('widget:set-open',    (e, open: unknown) => { if (fromWidget(e)) setWidgetOpen(open === true) })
  ipcMain.handle('widget:shortcut',    () => widgetShortcut())
  ipcMain.handle('widget:open-in-app', (e, id: unknown) => { if (fromWidget(e)) openInApp(typeof id === 'string' ? id : null) })
}
