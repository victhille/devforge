import { ipcMain } from 'electron'
import { folderSize, removeFolders, scanForCleanable } from '../services/cleaner/diskCleaner'

export function registerCleanerHandlers(): void {
  ipcMain.handle('cleaner:scan',   (_e, root: string) => scanForCleanable(root))
  ipcMain.handle('cleaner:size',   (_e, path: string) => folderSize(path))
  ipcMain.handle('cleaner:remove', (_e, paths: string[]) => removeFolders(paths))
}
