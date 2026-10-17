import { contextBridge, ipcRenderer } from 'electron'
import type { DevForgeAPI, LogLine, CommandResult, SSHSessionStatus } from '@shared/types'

const api: DevForgeAPI = {
  // SSH
  getSshConnections:  ()           => ipcRenderer.invoke('ssh:get-connections'),
  saveSshConnection:  (conn)       => ipcRenderer.invoke('ssh:save-connection', conn),
  removeSshConnection:(id)         => ipcRenderer.invoke('ssh:remove-connection', id),
  sshConnect:         (connId)     => ipcRenderer.invoke('ssh:connect', connId),
  sshConnectDashboard:(connId)     => ipcRenderer.invoke('ssh:connect-dashboard', connId),
  sshExec:            (sid, cmd)   => ipcRenderer.invoke('ssh:exec', sid, cmd),
  sshWrite:           (sid, data)  => ipcRenderer.invoke('ssh:write', sid, data),
  sshResize:          (sid, c, r)  => ipcRenderer.invoke('ssh:resize', sid, c, r),
  sshDisconnect:      (sid)        => ipcRenderer.invoke('ssh:disconnect', sid),

  onSshData: (callback) => {
    const listener = (_e: Electron.IpcRendererEvent, sessionId: string, data: string) => callback(sessionId, data)
    ipcRenderer.on('ssh:data', listener)
    return () => ipcRenderer.removeListener('ssh:data', listener)
  },

  onSshStatus: (callback) => {
    const listener = (_e: Electron.IpcRendererEvent, status: SSHSessionStatus) => callback(status)
    ipcRenderer.on('ssh:status', listener)
    return () => ipcRenderer.removeListener('ssh:status', listener)
  },

  // Window controls
  windowMinimize:   () => ipcRenderer.invoke('window:minimize'),
  windowMaximize:   () => ipcRenderer.invoke('window:maximize'),
  windowClose:      () => ipcRenderer.invoke('window:close'),
  windowIsMaximized:() => ipcRenderer.invoke('window:is-maximized'),
  onWindowMaximizedChange: (cb) => {
    const listener = (_e: Electron.IpcRendererEvent, maximized: boolean) => cb(maximized)
    ipcRenderer.on('window:maximized-change', listener)
    return () => ipcRenderer.removeListener('window:maximized-change', listener)
  },

  // Environment
  detectEnvironment: (force) => ipcRenderer.invoke('detect-environment', force),

  // File system
  selectDirectory:  ()             => ipcRenderer.invoke('select-directory'),
  selectFile:       ()             => ipcRenderer.invoke('select-file'),
  openDirectory:    (path)         => ipcRenderer.invoke('open-directory', path),
  openInIDE:        (path, ide)    => ipcRenderer.invoke('open-in-ide', path, ide),
  openExternal:     (url)          => ipcRenderer.invoke('open-external', url),
  pathExists:       (path)         => ipcRenderer.invoke('path-exists', path),
  openTerminal:     (path)         => ipcRenderer.invoke('open-terminal', path),
  readDirectory:    (path)         => ipcRenderer.invoke('fs:read-dir', path),

  // Project creation
  createProject: (options) => ipcRenderer.invoke('create-project', options),
  cancelTask:    (taskId)  => ipcRenderer.invoke('cancel-task', taskId),

  // Project scanner
  scanDirectory: (directory) => ipcRenderer.invoke('scan-directory', directory),

  // Project storage
  getProjects:               ()          => ipcRenderer.invoke('get-projects'),
  saveProject:               (project)   => ipcRenderer.invoke('save-project', project),
  removeProject:             (id)        => ipcRenderer.invoke('remove-project', id),
  updateProjectLastOpened:   (id)        => ipcRenderer.invoke('update-project-last-opened', id),
  toggleFavorite:            (id)        => ipcRenderer.invoke('toggle-favorite', id),

  // Settings
  getSettings:  ()         => ipcRenderer.invoke('get-settings'),
  saveSettings: (settings) => ipcRenderer.invoke('save-settings', settings),

  // Git
  getGitStatus: (path) => ipcRenderer.invoke('git:get-status', path),

  // Ports
  getListeningPorts: () => ipcRenderer.invoke('ports:get-listening'),

  // Scripts
  getProjectScripts:  (path)               => ipcRenderer.invoke('scripts:get', path),
  runProjectScript:   (path, script, pm)   => ipcRenderer.invoke('scripts:run', path, script, pm),

  // Events (renderer subscribes)
  onTaskLog: (callback: (log: LogLine) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, log: LogLine) => callback(log)
    ipcRenderer.on('task-log', listener)
    return () => ipcRenderer.removeListener('task-log', listener)
  },

  onTaskResult: (callback: (result: CommandResult) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, result: CommandResult) => callback(result)
    ipcRenderer.on('task-result', listener)
    return () => ipcRenderer.removeListener('task-result', listener)
  }
}

contextBridge.exposeInMainWorld('devforge', api)
