// ─── Automatic backups of a VPS ────────────────────────────────────────────────

export type DbEngine = 'postgres' | 'mariadb'

/** What the server holds that can be backed up */
export interface BackupCandidates {
  databases: { container: string; engine: DbEngine; image: string }[]
  /**
   * Named volumes and folders of the server mounted by running containers
   * (`name` is the volume name or the folder's path). A database's own data is
   * covered by its dump.
   */
  volumes: { name: string; kind: 'volume' | 'folder'; usedBy: string[]; databaseData: boolean }[]
}

export interface BackupPlan {
  connectionId: string
  databases: { engine: DbEngine; container: string }[]
  /** Volume names and folder paths */
  volumes: string[]
  /** "03:30", server time */
  time: string
  keepDaily: number
  keepWeekly: number
  /** Folder on this PC where the newest backup is copied; empty: no copy */
  localDir: string
  savedAt: string
}

export interface BackupItem { kind: 'db' | 'vol'; name: string; file: string; size: number; ok: boolean; error: string }

/** status.json written by the server's script after each run */
export interface BackupRun {
  day: string
  startedAt: string
  finishedAt: string
  ok: boolean
  size: number
  items: BackupItem[]
}

export interface BackupState {
  plan: BackupPlan | null
  /** The nightly cron line is on the server */
  scheduled: boolean
  last: BackupRun | null
  /** Files kept on the server, newest first */
  files: { path: string; kind: 'daily' | 'weekly'; day: string; size: number }[]
  /** The copy on this PC */
  local: { day: string | null; at: string | null; error: string | null }
}

export interface BackupsAPI {
  /** Saved plans, read locally */
  plans: () => Promise<BackupPlan[]>
  candidates: (connectionId: string) => Promise<BackupCandidates>
  state: (connectionId: string) => Promise<BackupState>
  /** Installs or updates the nightly backup; output streams on `onLog` */
  save: (plan: Omit<BackupPlan, 'savedAt'>) => Promise<{ ok: boolean }>
  /** Removes the cron line; the files stay */
  disable: (connectionId: string) => Promise<{ ok: boolean }>
  runNow: (connectionId: string) => Promise<{ ok: boolean }>
  /** Copies the newest backup to this PC now */
  copyNow: (connectionId: string) => Promise<{ day: string | null }>
  /** Safety copy, then restore of a file of `files` */
  restore: (connectionId: string, path: string) => Promise<{ ok: boolean }>
  chooseLocalDir: () => Promise<string | null>
  openLocalDir: (connectionId: string) => Promise<void>
  onLog: (cb: (e: { connectionId: string; text: string }) => void) => () => void
}
