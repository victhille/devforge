import { contextBridge, ipcRenderer } from 'electron'
import type { DevForgeAPI, LogLine, CommandResult, SSHSessionStatus } from '@shared/types'

/** ipcRenderer.invoke bound to a channel */
const invoke = <T extends (...args: never[]) => Promise<unknown>>(channel: string) =>
  ((...args: unknown[]) => ipcRenderer.invoke(channel, ...args)) as unknown as T

/** Subscribe to a main → renderer event, returns the unsubscribe function */
const on = <T>(channel: string) => (cb: (payload: T) => void) => {
  const listener = (_e: Electron.IpcRendererEvent, payload: T) => cb(payload)
  ipcRenderer.on(channel, listener)
  return () => { ipcRenderer.removeListener(channel, listener) }
}

const api: DevForgeAPI = {
  git: {
    details: invoke('git:details'),
    fetch:   invoke('git:fetch'),
    pull:    invoke('git:pull'),
    push:    invoke('git:push'),
    changes: invoke('git:changes'),
    commit:  invoke('git:commit')
  },

  cleaner: {
    scan:   invoke('cleaner:scan'),
    size:   invoke('cleaner:size'),
    remove: invoke('cleaner:remove')
  },

  env: {
    read:       invoke('env:read'),
    write:      invoke('env:write'),
    backup:     invoke('env:backup'),
    backupInfo: invoke('env:backup-info'),
    restore:    invoke('env:restore')
  },

  versions: {
    requirements: invoke('versions:requirements')
  },

  stacks: {
    list:      invoke('stacks:list'),
    save:      invoke('stacks:save'),
    remove:    invoke('stacks:remove'),
    start:     invoke('stacks:start'),
    stop:      invoke('stacks:stop'),
    startStep: invoke('stacks:start-step'),
    stopStep:  invoke('stacks:stop-step'),
    processes: invoke('stacks:processes'),
    logs:      invoke('stacks:logs'),
    onLog:     on('stacks:log'),
    onStatus:  on('stacks:status')
  },

  docker: {
    overview:   invoke('docker:overview'),
    container:  invoke('docker:container'),
    compose:    invoke('docker:compose'),
    composeLogs:     invoke('docker:compose-logs'),
    stopComposeLogs: invoke('docker:stop-compose-logs'),
    prune:      invoke('docker:prune'),
    followLogs: invoke('docker:follow-logs'),
    stopLogs:   invoke('docker:stop-logs')
  },

  deploy: {
    targets:  invoke('deploy:targets'),
    save:     invoke('deploy:save'),
    remove:   invoke('deploy:remove'),
    run:      invoke('deploy:run'),
    history:  invoke('deploy:history'),
    detect:   invoke('deploy:detect'),
    onLog:    on('deploy:log'),
    onStatus: on('deploy:status')
  },

  monitor: {
    list:     invoke('monitor:list'),
    states:   invoke('monitor:states'),
    save:     invoke('monitor:save'),
    remove:   invoke('monitor:remove'),
    checkNow: invoke('monitor:check'),
    onState:  on('monitor:state')
  },

  domains: {
    list:       invoke('domains:list'),
    save:       invoke('domains:save'),
    remove:     invoke('domains:remove'),
    status:     invoke('domains:status'),
    applyHosts: invoke('domains:apply-hosts')
  },

  db: {
    list:   invoke('db:list'),
    save:   invoke('db:save'),
    remove: invoke('db:remove'),
    test:   invoke('db:test'),
    schema: invoke('db:schema'),
    query:  invoke('db:query'),
    overview: invoke('db:overview'),
    details:  invoke('db:details'),
    browse:   invoke('db:browse'),
    detectRemote: invoke('db:detect-remote'),
    detectLocal:  invoke('db:detect-local'),
    addDetected:  invoke('db:add-detected')
  },

  logs: {
    open:    invoke('logs:open'),
    close:   invoke('logs:close'),
    onLines: on('logs:lines')
  },

  webhooks: {
    start:       invoke('webhooks:start'),
    stop:        invoke('webhooks:stop'),
    status:      invoke('webhooks:status'),
    list:        invoke('webhooks:list'),
    clear:       invoke('webhooks:clear'),
    setResponse: invoke('webhooks:set-response'),
    replay:      invoke('webhooks:replay'),
    onRequest:   on('webhooks:request')
  },

  assistant: {
    getConfig:  invoke('assistant:get-config'),
    saveConfig: invoke('assistant:save-config'),
    send:       invoke('assistant:send'),
    stop:       invoke('assistant:stop'),
    list:       invoke('assistant:list'),
    get:        invoke('assistant:get'),
    remove:     invoke('assistant:remove'),
    usage:      invoke('assistant:usage'),
    onEvent:    on('assistant:event'),
    onOpenConversation: on('assistant:open-conversation')
  },

  widget: {
    resize:    invoke('widget:resize'),
    setOpen:   invoke('widget:set-open'),
    openInApp: invoke('widget:open-in-app'),
    shortcut:  invoke('widget:shortcut'),
    onToggle:  (cb) => on<void>('widget:toggle')(() => cb())
  },

  aiTools: {
    list:   invoke('ai-tools:list'),
    launch: invoke('ai-tools:launch')
  },

  http: {
    request: invoke('http:request')
  },

  suggest: {
    logFiles:    invoke('suggest:log-files'),
    monitorUrls: invoke('suggest:monitor-urls'),
    domains:     invoke('suggest:domains')
  },

  // SSH
  getSshConnections:  ()           => ipcRenderer.invoke('ssh:get-connections'),
  saveSshConnection:  (conn)       => ipcRenderer.invoke('ssh:save-connection', conn),
  removeSshConnection:(id)         => ipcRenderer.invoke('ssh:remove-connection', id),
  forgetSshHostKey:   (id)         => ipcRenderer.invoke('ssh:forget-host-key', id),
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
  updates: {
    status:   invoke('update:status'),
    check:    invoke('update:check'),
    install:  invoke('update:install'),
    onStatus: on('update:status')
  },

  // Git
  getGitStatus: (path) => ipcRenderer.invoke('git:get-status', path),

  // Ports
  getListeningPorts: () => ipcRenderer.invoke('ports:get-listening'),
  getUserName: () => ipcRenderer.invoke('system:user-name'),
  freePort: (port, pid) => ipcRenderer.invoke('ports:free', port, pid),
  logError: (scope, message) => ipcRenderer.invoke('log:error', scope, message),
  getReport: () => ipcRenderer.invoke('log:report'),

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
