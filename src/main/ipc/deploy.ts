import { ipcMain, type BrowserWindow } from 'electron'
import type { DeployTarget } from '@shared/types'
import { detectDeploys } from '../services/deploy/deployDetect'
import { history, listTargets, removeTarget, runDeploy, saveTarget, setDeployCallbacks } from '../services/deploy/deployService'

export function registerDeployHandlers(mainWindow: BrowserWindow): void {
  setDeployCallbacks(
    e   => { if (!mainWindow.isDestroyed()) mainWindow.webContents.send('deploy:log', e) },
    run => { if (!mainWindow.isDestroyed()) mainWindow.webContents.send('deploy:status', run) }
  )
  ipcMain.handle('deploy:targets', () => listTargets())
  ipcMain.handle('deploy:save',    (_e, target: DeployTarget) => saveTarget(target))
  ipcMain.handle('deploy:remove',  (_e, id: string) => removeTarget(id))
  ipcMain.handle('deploy:run',     (_e, id: string) => runDeploy(id))
  ipcMain.handle('deploy:history', (_e, id: string) => history(id))
  ipcMain.handle('deploy:detect',  (_e, sshId: string) => detectDeploys(sshId))
}
