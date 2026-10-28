import type { HomeWidget } from '../lib/homeWidgets'
import type { IdeInfo } from '../data/ides'
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
  // v3.5: a folder that is not a project but holds several (backend/ + frontend/)
  | 'group'

export type PackageManager = 'npm' | 'pnpm' | 'yarn'

/** A project found by scanning a directory on disk (may not be in DevForge storage yet). */
export interface DetectedProject {
  name: string
  path: string
  framework: Framework
  packageManager: PackageManager
  /** v3.5: a group's projects (framework 'group'); a name is its path inside the group (api, apps/web) */
  subprojects?: SubProject[]
  /** v3.5.1: the rest of a group's folder (docs/, README.md…) */
  extras?: string[]
}

/** v3.5: one project of a group */
export interface SubProject {
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
  /** v3.3.1: its folder no longer exists (worked out on load, never saved) */
  missing?: boolean
  /** v3.5: a group's projects, as on disk now (worked out on load, never saved) */
  subprojects?: SubProject[]
  /** v3.5.1: the rest of a group's folder (docs/, README.md…), worked out on load, never saved */
  extras?: string[]
  /** v3.5: the IDE this project opens in, in place of the default one */
  ide?: DefaultIDE
  /** v3.5: a group's projects' own IDEs, by their name in the group */
  subIdes?: Record<string, DefaultIDE>
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
  /** v3.3.1: the interface's language, for the creation's messages (French when absent) */
  lang?: 'fr' | 'en'
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
/** v3.5: an IDE of the catalog (shared/data/ides), one added by hand (its id), or 'none' */
export type DefaultIDE = string

/** v3.5: a command added to the Docs page */
export interface CustomCommand {
  id: string
  cmd: string
  desc: string
  /** A reference of the page (Git, Docker…) or a new one */
  category: string
  createdAt: string
}

/** v3.5: whether a command's program is on this PC */
export interface CommandCheck {
  program: string
  found: boolean
  path?: string
}

/** v3.5: an IDE added by hand in Settings */
export interface CustomIde {
  id: string
  name: string
  /** The program (.exe, .cmd or .bat) */
  path: string
  /** Its arguments, {dir} standing for the project's folder */
  args: string
}
export type DefaultTerminal = 'powershell' | 'cmd' | 'gitbash'
export type AppLanguage = 'en' | 'fr'

export interface AppSettings {
  /** The first projects folder: new projects go there by default */
  defaultProjectsDir: string
  /** v3.5: the other projects folders, scanned too (see shared/lib/projectFolders) */
  extraProjectsDirs?: string[]
  defaultPackageManager: PackageManager
  defaultIDE: DefaultIDE
  /** v3.5: IDEs added by hand */
  customIdes?: CustomIde[]
  /** v3.5: the greyed rest of a terminal line (on unless turned off) */
  terminalSuggest?: boolean
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
  /** Global launcher (v2.2): floating search over any application */
  launcherEnabled: boolean
  /** Electron accelerator, e.g. CommandOrControl+Alt+Space */
  launcherShortcut: string
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
  /** Erases connections, keys, history, log and settings, then restarts on the first-launch tour */
  wipe: () => Promise<void>
  /** Saves the setup without any secret; resolves with the file, null when cancelled */
  exportConfig: () => Promise<string | null>
  /** Replaces the setup with an export (after a backup) and restarts; null when cancelled */
  importConfig: () => Promise<string[] | null>
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

/** v3.5.1: a project's file, ready to show */
export type FilePreview =
  | { kind: 'markdown' | 'text'; size: number; text: string }
  | { kind: 'image'; size: number; dataUrl: string }
  | { kind: 'pdf'; size: number; bytes: Uint8Array }
  | { kind: 'binary' | 'tooBig' | 'unreadable'; size: number }

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
export * from './tests'
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
export * from './vercel'
export * from './dictation'
export * from './setup'
export * from './symfony'
export * from './launcher'
export * from './status'
export * from './terminal'
export * from './nextjs'
export * from './laravel'
export * from './connections'
export * from './packages'
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
import type { VercelAPI } from './vercel'
import type { DictationAPI } from './dictation'
import type { ProjectSetup, SetupAPI } from './setup'
import type { SymfonyAPI } from './symfony'
import type { LauncherAPI } from './launcher'
import type { StatusAPI } from './status'
import type { TerminalAPI } from './terminal'
import type { NextjsAPI } from './nextjs'
import type { LaravelAPI } from './laravel'
import type { ConnectionsAPI } from './connections'
import type { PackagesAPI } from './packages'
import type { TestsAPI } from './tests'
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
  /** v3.5: the commands added to the Docs page */
  docs: {
    list: () => Promise<CustomCommand[]>
    save: (c: Partial<CustomCommand>) => Promise<CustomCommand[]>
    remove: (id: string) => Promise<CustomCommand[]>
    check: (cmd: string) => Promise<CommandCheck>
    programs: () => Promise<string[]>
  }
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
  /** A server was added, edited or removed */
  onSshConnectionsChanged: (callback: () => void) => () => void

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
  /** v3.5.3: a file of a saved project; `root`, its project's folder, opens in that project's window */
  openFileInIDE: (path: string, ide: DefaultIDE, root?: string, line?: number) => Promise<void>
  /** v3.6: a text or a regex in every file of a saved project */
  searchProject: (root: string, query: string, options: import('../lib/projectSearch').SearchOptions) => Promise<import('../lib/projectSearch').SearchResult>
  /** v3.5: the IDEs of the catalog and those added by hand, with which are on this PC */
  listIdes: (fresh?: boolean) => Promise<IdeInfo[]>
  /** v3.5: opens the projects folder with an IDE being added by hand, before it is saved */
  tryIde: (ide: CustomIde) => Promise<void>
  /** v3.5: picks a program (.exe, .cmd, .bat) */
  selectProgram: () => Promise<string | null>
  openExternal: (url: string) => Promise<void>
  pathExists: (path: string) => Promise<boolean>
  openTerminal: (path: string) => Promise<void>
  readDirectory: (path: string) => Promise<FileEntry[]>
  /** v3.5.1: a file of a saved project, for the Files tab's preview */
  previewFile: (path: string) => Promise<FilePreview>

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
  vercel: VercelAPI
  setup: SetupAPI
  symfony: SymfonyAPI
  launcher: LauncherAPI
  status: StatusAPI
  terminal: TerminalAPI
  nextjs: NextjsAPI
  laravel: LaravelAPI
  connections: ConnectionsAPI
  packages: PackagesAPI
  /** v3.7: a project's tests */
  tests: TestsAPI
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
  /** v3.3.1: package.json declares packages and node_modules is missing */
  scriptNeedsInstall: (path: string) => Promise<boolean>
  installProjectDeps: (path: string, pm: PackageManager) => Promise<string>

  // Events (renderer subscribes)
  onTaskLog: (callback: (log: LogLine) => void) => () => void
  onTaskResult: (callback: (result: CommandResult) => void) => () => void
}

declare global {
  interface Window {
    devforge: DevForgeAPI
  }
}
