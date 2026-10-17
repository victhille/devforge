// ─── Project ─────────────────────────────────────────────────────────────────

export type Framework =
  // JavaScript / TypeScript
  | 'react' | 'nextjs' | 'vue' | 'angular' | 'svelte' | 'nodejs' | 'express'
  // PHP
  | 'symfony' | 'laravel' | 'php'
  // Other languages
  | 'python' | 'go' | 'rust' | 'java' | 'kotlin' | 'ruby' | 'dotnet' | 'swift'
  // Mobile
  | 'flutter'
  // Systems / scripting
  | 'cpp' | 'c' | 'shell'
  // Web static
  | 'html'
  // Config / infra
  | 'docker'
  // Generic
  | 'typescript' | 'empty' | 'unknown'

export type PackageManager = 'npm' | 'pnpm' | 'yarn'

/** A project found by scanning a directory on disk (may not be in DevForge storage yet). */
export interface DetectedProject {
  name: string
  path: string
  framework: Framework
  packageManager: PackageManager
}

export interface Project {
  id: string
  name: string
  path: string
  framework: Framework
  packageManager: PackageManager
  createdAt: string
  lastOpenedAt: string | null
  favorite: boolean
}

// ─── Project Creation ─────────────────────────────────────────────────────────

export interface ProjectCreationOptions {
  name: string
  destination: string
  framework: Framework
  packageManager: PackageManager
  typescript: boolean
  eslint: boolean
  initGit: boolean
  installDeps: boolean
  openAfter: boolean
  libraries?: string[]
  devLibraries?: string[]
}

// ─── Environment ─────────────────────────────────────────────────────────────

export type ToolStatus = 'detected' | 'not_detected' | 'checking'

export interface EnvironmentTool {
  id: string
  name: string
  command: string
  version: string | null
  status: ToolStatus
  required: boolean
}

// ─── Command Runner ───────────────────────────────────────────────────────────

export type TaskStatus = 'pending' | 'running' | 'success' | 'failed' | 'cancelled'

export interface CommandTask {
  id: string
  executable: string
  args: string[]
  cwd: string
  status: TaskStatus
  startedAt: string | null
  finishedAt: string | null
}

export interface CommandResult {
  taskId: string
  exitCode: number | null
  status: TaskStatus
}

export interface LogLine {
  taskId: string
  type: 'stdout' | 'stderr' | 'info' | 'error'
  text: string
  timestamp: string
}

// ─── Settings ────────────────────────────────────────────────────────────────

export type Theme = 'dark' | 'light' | 'system'
export type DefaultIDE = 'vscode' | 'phpstorm' | 'webstorm' | 'intellij' | 'none'
export type DefaultTerminal = 'powershell' | 'cmd' | 'gitbash'
export type AppLanguage = 'en' | 'fr'

export interface AppSettings {
  defaultProjectsDir: string
  defaultPackageManager: PackageManager
  defaultIDE: DefaultIDE
  theme: Theme
  defaultTerminal: DefaultTerminal
  language: AppLanguage
  startWithWindows: boolean
  minimizeToTray: boolean
}

// ─── SSH ─────────────────────────────────────────────────────────────────────

export type SSHAuthMethod = 'password' | 'privateKey'

export interface SSHConnection {
  id: string
  name: string
  host: string
  port: number
  username: string
  authMethod: SSHAuthMethod
  /** Write-only: sent on save, never returned to the renderer. Encrypted at rest with Electron safeStorage. */
  password?: string
  /** True when an encrypted password is stored */
  hasPassword?: boolean
  privateKeyPath?: string
  color: string
  createdAt: string
}

export interface SSHSessionStatus {
  sessionId: string
  connectionId: string
  status: 'connecting' | 'connected' | 'disconnected' | 'error'
  error?: string
}

// ─── File System ─────────────────────────────────────────────────────────────

export interface FileEntry {
  name: string
  path: string
  isDirectory: boolean
  size: number | null
  extension: string | null
}

// ─── Git ─────────────────────────────────────────────────────────────────────

export interface GitStatus {
  branch: string | null
  dirty: boolean
  ahead: number
  behind: number
}

// ─── Ports ───────────────────────────────────────────────────────────────────

export interface ListeningPort {
  port: number
  pid: number | null
  processName: string
}

// ─── IPC API ─────────────────────────────────────────────────────────────────

export interface DevForgeAPI {
  // SSH
  getSshConnections: () => Promise<SSHConnection[]>
  saveSshConnection: (conn: SSHConnection) => Promise<void>
  removeSshConnection: (id: string) => Promise<void>
  sshConnect:          (connectionId: string) => Promise<string>
  sshConnectDashboard: (connectionId: string) => Promise<string>
  sshExec:             (sessionId: string, command: string) => Promise<string>
  sshWrite: (sessionId: string, data: string) => Promise<void>
  sshResize: (sessionId: string, cols: number, rows: number) => Promise<void>
  sshDisconnect: (sessionId: string) => Promise<void>
  onSshData: (callback: (sessionId: string, data: string) => void) => () => void
  onSshStatus: (callback: (status: SSHSessionStatus) => void) => () => void

  // Environment
  /** Cached after the first call, pass true to re-detect */
  detectEnvironment: (force?: boolean) => Promise<EnvironmentTool[]>

  // Window controls
  windowMinimize: () => Promise<void>
  windowMaximize: () => Promise<void>
  windowClose: () => Promise<void>
  windowIsMaximized: () => Promise<boolean>
  onWindowMaximizedChange: (cb: (maximized: boolean) => void) => () => void

  // File system
  selectDirectory: () => Promise<string | null>
  selectFile: () => Promise<string | null>
  openDirectory: (path: string) => Promise<void>
  openInIDE: (path: string, ide: DefaultIDE) => Promise<void>
  openExternal: (url: string) => Promise<void>
  pathExists: (path: string) => Promise<boolean>
  openTerminal: (path: string) => Promise<void>
  readDirectory: (path: string) => Promise<FileEntry[]>

  // Project creation
  createProject: (options: ProjectCreationOptions) => Promise<string>
  cancelTask: (taskId: string) => Promise<void>

  // Project scanner
  scanDirectory: (directory: string) => Promise<DetectedProject[]>

  // Project storage
  getProjects: () => Promise<Project[]>
  saveProject: (project: Project) => Promise<void>
  removeProject: (id: string) => Promise<void>
  updateProjectLastOpened: (id: string) => Promise<void>
  toggleFavorite: (id: string) => Promise<void>

  // Settings
  getSettings: () => Promise<AppSettings>
  saveSettings: (settings: AppSettings) => Promise<void>

  // Git
  getGitStatus: (path: string) => Promise<GitStatus>

  // Ports
  getListeningPorts: () => Promise<ListeningPort[]>

  // Scripts
  getProjectScripts: (path: string) => Promise<Record<string, string>>
  runProjectScript: (path: string, script: string, pm: PackageManager) => Promise<string>

  // Events (renderer subscribes)
  onTaskLog: (callback: (log: LogLine) => void) => () => void
  onTaskResult: (callback: (result: CommandResult) => void) => () => void
}

declare global {
  interface Window {
    devforge: DevForgeAPI
  }
}
