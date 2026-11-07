import { BrowserWindow } from 'electron'
import type { DataTopic } from '@shared/types'

/**
 * v4.2: a kind of data changed (written by a page, by Forgy, by an import):
 * every window that shows it reads it again, at once, instead of waiting for
 * its next visit. `scope`: whose, when it belongs to one project (its path).
 */
export function dataChanged(topic: DataTopic, scope?: string): void {
  for (const w of BrowserWindow.getAllWindows()) if (!w.isDestroyed()) w.webContents.send('data:changed', { topic, ...(scope ? { scope } : {}) })
}
