import type { HomeWidget } from '../lib/homeWidgets'
export type { HomeWidget, WidgetId } from '../lib/homeWidgets'
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
  /** v2.2: database, options, Git and GitHub after the creation */
  setup?: ProjectSetup
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
  /** 'beta' also installs pre-releases (2.0.0-beta.1…) */
  updateChannel: 'stable' | 'beta'
  /** 'system' follows Windows' "animation effects" */
  motion: MotionSetting
  /** 'compact': smaller spacing and text, for small screens */
  density: Density
  /** "What's new" window on the first launch after an update */
  showWhatsNew: boolean
  /** Whisper model for voice typing */
  dictationModel: 'base' | 'small'
  /** The first-launch tour was shown */
  onboarded: boolean
  /** Pages pinned at the top of the menu, in order (only written by `setFavorites`) */
  favorites: string[]
  /** Widgets of the Home page, in order (only written by `setHomeWidgets`) */
  homeWidgets: HomeWidget[]
}

export type MotionSetting = 'full' | 'reduced' | 'system'
export type Density = 'comfortable' | 'compact'

/** Settings → Data */
export interface DataInfo {
  dir: string
  /** Bytes used by DevForge's own files */
  size: number
  schemaVersion: number
  backups: { name: string; at: string; reason: 'format' | 'manual' | 'restore'; version: number }[]
}

export interface DataAPI {
  info: () => Promise<DataInfo>
  backup: () => Promise<DataInfo>
  /** Puts a backup back and restarts the app */
  restore: (name: string) => Promise<void>
  openDir: () => Promise<void>
  openLog: () => Promise<void>
  /** Monitoring charts start over */
  clearHistory: () => Promise<void>
}

export type UpdateStatus =
  | { state: 'idle' | 'checking' }
  | { state: 'up-to-date'; checkedAt: number }
  | { state: 'downloading'; version: string; percent: number }
  | { state: 'ready'; version: string }
  /** dev build, the release feed cannot be read (offline), or no GitHub token to read the private repository */
  | { state: 'unavailable'; reason: 'dev' | 'feed' | 'auth' }

export interface UpdatesAPI {
  status: () => Promise<UpdateStatus>
  check: () => Promise<UpdateStatus>
  /** Restarts DevForge on the downloaded version */
  install: () => Promise<void>
  onStatus: (cb: (s: UpdateStatus) => void) => () => void
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
  /** Remembered server key fingerprint (read-only, set on first connection) */
  fingerprint?: string | null
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

export * from './git'
export * from './cleaner'
export * from './envfiles'
export * from './versions'
export * from './stacks'
export * from './docker'
export * from './deploy'
export * from './monitor'
export * from './domains'
export * from './database'
export * from './logs'
export * from './webhooks'
export * from './suggest'
export * from './assistant'
export * from './hub'
export * from './watch'
export * from './n8n'
export * from './vpn'
export * from './vpsops'
export * from './backups'
export * from './github'
export * from './automations'
export * from './vercel'
export * from './dictation'
export * from './setup'
import type { GitAPI } from './git'
import type { CleanerAPI } from './cleaner'
import type { EnvAPI } from './envfiles'
import type { VersionsAPI } from './versions'
import type { StacksAPI } from './stacks'
import type { HubAPI } from './hub'
import type { WatchAPI } from './watch'
import type { N8nAPI } from './n8n'
import type { VpnAPI } from './vpn'
import type { VpsOpsAPI } from './vpsops'
import type { BackupsAPI } from './backups'
import type { GithubAPI } from './github'
import type { AutomationsAPI } from './automations'
import type { VercelAPI } from './vercel'
import type { DictationAPI } from './dictation'
import type { ProjectSetup, SetupAPI } from './setup'
import type { DockerAPI } from './docker'
import type { DeployAPI } from './deploy'
import type { MonitorAPI } from './monitor'
import type { DomainsAPI } from './domains'
import type { DatabaseAPI } from './database'
import type { LogsAPI } from './logs'
import type { WebhooksAPI } from './webhooks'
import type { SuggestAPI } from './suggest'
import type { AiToolsAPI, AssistantAPI, WidgetAPI } from './assistant'

// ─── HTTP (API tester) ───────────────────────────────────────────────────────

export interface HttpRequest {
  method: string
  url: string
  headers: Record<string, string>
  body?: string
}

export interface HttpResponse {
  status?: number
  statusText?: string
  headers?: Record<string, string>
  body?: string
  /** Bytes received */
  size?: number
  /** ms */
  time?: number
  error?: string
}

// ─── IPC API ─────────────────────────────────────────────────────────────────

export interface DevForgeAPI {
  git: GitAPI
  cleaner: CleanerAPI
  env: EnvAPI
  versions: VersionsAPI
  stacks: StacksAPI
  docker: DockerAPI
  deploy: DeployAPI
  monitor: MonitorAPI
  domains: DomainsAPI
  db: DatabaseAPI
  logs: LogsAPI
  webhooks: WebhooksAPI
  suggest: SuggestAPI
  http: { request: (req: HttpRequest) => Promise<HttpResponse> }
  assistant: AssistantAPI
  aiTools: AiToolsAPI
  widget: WidgetAPI

  // SSH
  getSshConnections: () => Promise<SSHConnection[]>
  saveSshConnection: (conn: SSHConnection) => Promise<void>
  removeSshConnection: (id: string) => Promise<void>
  /** Forget the remembered server key (after a legitimate reinstall) */
  forgetSshHostKey: (id: string) => Promise<void>
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
  /** Saves the menu favorites alone; returns them cleaned */
  setFavorites: (paths: string[]) => Promise<string[]>
  /** Saves the Home widgets alone; returns them cleaned */
  setHomeWidgets: (widgets: HomeWidget[]) => Promise<HomeWidget[]>
  updates: UpdatesAPI
  data: DataAPI
  hub: HubAPI
  watch: WatchAPI
  n8n: N8nAPI
  vpn: VpnAPI
  vpsOps: VpsOpsAPI
  backups: BackupsAPI
  github: GithubAPI
  automations: AutomationsAPI
  vercel: VercelAPI
  setup: SetupAPI
  dictation: DictationAPI

  // Git
  getGitStatus: (path: string) => Promise<GitStatus>

  // Ports
  getListeningPorts: () => Promise<ListeningPort[]>
  /** First name for greetings (git user.name, else the Windows account) */
  getUserName: () => Promise<string>
  /** Ends the process listening on a port (refused for Windows services) */
  freePort: (port: number, pid: number) => Promise<void>
  /** Writes a renderer error to the local log */
  logError: (scope: string, message: string) => Promise<void>
  /** System details and the last log lines, secrets masked */
  getReport: () => Promise<string>

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
