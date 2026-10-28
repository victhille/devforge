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
    fileStates: invoke('git:file-states'),
    fileDiff: invoke('git:file-diff'),
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
    restore:    invoke('env:restore'),
    syncDiff:   invoke('env:sync-diff'),
    syncApply:  invoke('env:sync-apply')
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
    stats:      invoke('docker:stats'),
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
    applyRows: invoke('db:apply-rows'),
    exportTable: invoke('db:export'),
    saveResult: invoke('db:save-result'),
    pickCsv: invoke('db:pick-csv'),
    importCsv: invoke('db:import-csv'),
    detectRemote: invoke('db:detect-remote'),
    detectLocal:  invoke('db:detect-local'),
    addDetected:  invoke('db:add-detected')
  },

  logs: {
    open:    invoke('logs:open'),
    close:   invoke('logs:close'),
    onLines: on('logs:lines')
  },

  docs: {
    list:     invoke('docs:list'),
    save:     invoke('docs:save'),
    remove:   invoke('docs:remove'),
    check:    invoke('docs:check'),
    programs: invoke('docs:programs')
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
    onOpenConversation: on('assistant:open-conversation'),
    decideAction: invoke('assistant:decide-action'),
    actions:      invoke('assistant:actions'),
    undoAction:   invoke('assistant:undo-action')
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

  onSshConnectionsChanged: (callback) => {
    const listener = () => callback()
    ipcRenderer.on('ssh:connections-changed', listener)
    return () => ipcRenderer.removeListener('ssh:connections-changed', listener)
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
  openFileInIDE:    (path, ide, root, line) => ipcRenderer.invoke('open-file-in-ide', path, ide, root, line),
  searchProject:    (root, query, options) => ipcRenderer.invoke('fs:search', root, query, options),
  listIdes:         (fresh)        => ipcRenderer.invoke('ide:list', fresh === true),
  tryIde:           (ide)          => ipcRenderer.invoke('ide:try', ide),
  selectProgram:    ()             => ipcRenderer.invoke('select-program'),
  openExternal:     (url)          => ipcRenderer.invoke('open-external', url),
  pathExists:       (path)         => ipcRenderer.invoke('path-exists', path),
  openTerminal:     (path)         => ipcRenderer.invoke('open-terminal', path),
  readDirectory:    (path)         => ipcRenderer.invoke('fs:read-dir', path),
  previewFile:      (path)         => ipcRenderer.invoke('fs:preview', path),

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
  setFavorites: (paths) => ipcRenderer.invoke('settings:favorites', paths),
  setHomeWidgets: (widgets) => ipcRenderer.invoke('settings:home-widgets', widgets),
  watch: {
    status:       invoke('watch:status'),
    onStatus:     on('watch:status'),
    config:       invoke('watch:config'),
    saveConfig:   invoke('watch:save-config'),
    history:      invoke('watch:history'),
    onAlert:      on('watch:alert'),
    docker:       invoke('watch:docker'),
    dockerAction: invoke('watch:docker-action'),
    dockerLogs:   invoke('watch:docker-logs')
  },

  n8n: {
    instances:      invoke('n8n:instances'),
    precheck:       invoke('n8n:precheck'),
    install:        invoke('n8n:install'),
    setLocale:      invoke('n8n:set-locale'),
    onLog:          on('n8n:log'),
    status:         invoke('n8n:status'),
    checkDomain:    invoke('n8n:check-domain'),
    openTunnel:     invoke('n8n:open-tunnel'),
    logs:           invoke('n8n:logs'),
    update:         invoke('n8n:update'),
    control:        invoke('n8n:control'),
    saveKey:        invoke('n8n:save-key'),
    forget:         invoke('n8n:forget'),
    workflows:      invoke('n8n:workflows'),
    executions:     invoke('n8n:executions'),
    setActive:      invoke('n8n:set-active'),
    exportWorkflow: invoke('n8n:export')
  },

  vpn: {
    servers:    invoke('vpn:servers'),
    detect:     invoke('vpn:detect'),
    saveLogin:  invoke('vpn:save-login'),
    forget:     invoke('vpn:forget'),
    clients:    invoke('vpn:clients'),
    create:     invoke('vpn:create'),
    remove:     invoke('vpn:remove'),
    setEnabled: invoke('vpn:set-enabled'),
    qrcode:     invoke('vpn:qrcode'),
    saveConfig: invoke('vpn:save-config'),
    openWeb:    invoke('vpn:open-web'),
    onShowQr:   on('vpn:show-qr')
  },

  vpsOps: {
    services:    invoke('vps:services'),
    openService: invoke('vps:open-service'),
    health:      invoke('vps:health'),
    fixCommand:  invoke('vps:fix-command'),
    runFix:      invoke('vps:run-fix'),
    onFixLog:    on('vps:fix-log')
  },

  backups: {
    plans:          invoke('backups:plans'),
    candidates:     invoke('backups:candidates'),
    state:          invoke('backups:state'),
    save:           invoke('backups:save'),
    disable:        invoke('backups:disable'),
    runNow:         invoke('backups:run-now'),
    copyNow:        invoke('backups:copy-now'),
    restore:        invoke('backups:restore'),
    chooseLocalDir: invoke('backups:choose-dir'),
    openLocalDir:   invoke('backups:open-dir'),
    onLog:          on('backups:log')
  },

  github: {
    repo:      invoke('github:repo'),
    status:    invoke('github:status'),
    rerun:     invoke('github:rerun'),
    saveToken: invoke('github:save-token'),
    hasToken:  invoke('github:has-token')
  },

  setup: {
    freePort:    invoke('setup:free-port'),
    githubLogin: invoke('setup:github-login'),
    previousVolumes: invoke('setup:previous-volumes'),
    phpStatus:   invoke('setup:php-status'),
    phpEnable:   invoke('setup:php-enable')
  },

  symfony: {
    inspect:       invoke('symfony:inspect'),
    routes:        invoke('symfony:routes'),
    run:           invoke('symfony:run'),
    writeEntity:   invoke('symfony:write-entity'),
    apiConfig:     invoke('symfony:api-config'),
    applyApi:      invoke('symfony:apply-api'),
    writeFixtures: invoke('symfony:write-fixtures'),
    useConnection: invoke('symfony:use-connection'),
    serverUrl:     invoke('symfony:server-url'),
    onDraft:       on('symfony:draft')
  },

  launcher: {
    hide:     invoke('launcher:hide'),
    toMain:   invoke('launcher:to-main'),
    state:    invoke('launcher:state'),
    onShown:  on('launcher:shown'),
    onToMain: on('launcher:to-main')
  },

  status: {
    precheck:      invoke('status:precheck'),
    checkDomain:   invoke('status:check-domain'),
    install:       invoke('status:install'),
    onLog:         on('status:log'),
    overview:      invoke('status:overview'),
    saveConfig:    invoke('status:save-config'),
    saveIncidents: invoke('status:save-incidents'),
    testAlert:     invoke('status:test-alert'),
    openFirewall:  invoke('status:open-firewall'),
    uninstall:     invoke('status:uninstall')
  },

  terminal: {
    shells:     invoke('term:shells'),
    create:     invoke('term:create'),
    write:      invoke('term:write'),
    resize:     invoke('term:resize'),
    kill:       invoke('term:kill'),
    onData:     (cb: (id: string, data: string) => void) => { const h = (_e: unknown, id: string, data: string) => cb(id, data); ipcRenderer.on('term:data', h); return () => { ipcRenderer.removeListener('term:data', h) } },
    onExit:     (cb: (id: string, code: number) => void) => { const h = (_e: unknown, id: string, code: number) => cb(id, code); ipcRenderer.on('term:exit', h); return () => { ipcRenderer.removeListener('term:exit', h) } },
    history:    invoke('term:history'),
    addHistory: invoke('term:history-add')
  },

  nextjs: {
    inspect:     invoke('nextjs:inspect'),
    routes:      invoke('nextjs:routes'),
    run:         invoke('nextjs:run'),
    writeModel:  invoke('nextjs:write-model'),
    writePrismaClient: invoke('nextjs:write-client'),
    apiConfig:   invoke('nextjs:api-config'),
    applyApi:    invoke('nextjs:apply-api'),
    writeSeed:   invoke('nextjs:write-seed'),
    prepareRevert: invoke('nextjs:prepare-revert'),
    authStatus:  invoke('nextjs:auth-status'),
    applyAuth:   invoke('nextjs:apply-auth'),
    setAuthKeys: invoke('nextjs:set-auth-keys')
  },

  tests: {
    detect: invoke('tests:detect'),
    run:    invoke('tests:run'),
    stop:   invoke('tests:stop'),
    last:   invoke('tests:last'),
    onOutput: (cb) => {
      const listener = (_e: Electron.IpcRendererEvent, line: string) => cb(line)
      ipcRenderer.on('tests:output', listener)
      return () => ipcRenderer.removeListener('tests:output', listener)
    }
  },
  packages: {
    list:   invoke('packages:list'),
    latest: invoke('packages:latest'),
    audit:  invoke('packages:audit'),
    update: invoke('packages:update'),
    onLog: (cb) => {
      const listener = (_e: Electron.IpcRendererEvent, line: string) => cb(line)
      ipcRenderer.on('packages:log', listener)
      return () => ipcRenderer.removeListener('packages:log', listener)
    }
  },

  connections: {
    overview:       invoke('connections:overview'),
    test:           invoke('connections:test'),
    disconnect:     invoke('connections:disconnect'),
    setGitIdentity: invoke('connections:set-git-identity'),
    alerts:         invoke('connections:alerts'),
    setNtfy:        invoke('connections:set-ntfy')
  },

  laravel: {
    inspect:    invoke('laravel:inspect'),
    routes:     invoke('laravel:routes'),
    run:        invoke('laravel:run'),
    writeModel: invoke('laravel:write-model'),
    apiConfig:  invoke('laravel:api-config'),
    applyApi:   invoke('laravel:apply-api'),
    writeSeed:  invoke('laravel:write-seed')
  },

  dictation: {
    status:     invoke('dictation:status'),
    prepare:    invoke('dictation:prepare'),
    onProgress: on('dictation:progress'),
    transcribe: invoke('dictation:transcribe'),
    remove:     invoke('dictation:remove')
  },

  vercel: {
    account:     invoke('vercel:account'),
    saveToken:   invoke('vercel:save-token'),
    project:     invoke('vercel:project'),
    deployments: invoke('vercel:deployments'),
    buildLogs:   invoke('vercel:build-logs'),
    redeploy:    invoke('vercel:redeploy'),
    promote:     invoke('vercel:promote'),
    env:         invoke('vercel:env'),
    domains:     invoke('vercel:domains')
  },

  hub: {
    get:       invoke('hub:get'),
    link:      invoke('hub:link'),
    getActive: invoke('hub:get-active'),
    setActive: invoke('hub:set-active'),
    onActive:  on('hub:active')
  },

  updates: {
    status:   invoke('update:status'),
    check:    invoke('update:check'),
    install:  invoke('update:install'),
    onStatus: on('update:status')
  },
  data: {
    info:         invoke('data:info'),
    backup:       invoke('data:backup'),
    restore:      invoke('data:restore'),
    openDir:      invoke('data:open-dir'),
    openLog:      invoke('data:open-log'),
    clearHistory: invoke('data:clear-history'),
    wipe:         invoke('data:wipe'),
    exportConfig: invoke('data:export'),
    importConfig: invoke('data:import')
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
  scriptNeedsInstall: (path)               => ipcRenderer.invoke('scripts:needs-install', path),
  installProjectDeps: (path, pm)           => ipcRenderer.invoke('scripts:install', path, pm),

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
