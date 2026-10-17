// ─── .env manager ────────────────────────────────────────────────────────────

export interface EnvFile {
  /** File name only, e.g. ".env.local" */
  name: string
  /** Ordered key → value (comments and blank lines are kept on disk, not here) */
  values: Record<string, string>
}

export interface EnvProject {
  projectPath: string
  files: EnvFile[]
}

export interface EnvBackupInfo {
  /** ISO date of the encrypted backup, null when none */
  savedAt: string | null
  files: string[]
}

export interface EnvAPI {
  /** All .env* files of a project */
  read: (projectPath: string) => Promise<EnvProject>
  /** Set values in a file (creates it when missing); keys with null are removed */
  write: (projectPath: string, fileName: string, changes: Record<string, string | null>) => Promise<void>
  /** Encrypted copy of every .env* file, stored in the app data folder */
  backup: (projectPath: string) => Promise<EnvBackupInfo>
  backupInfo: (projectPath: string) => Promise<EnvBackupInfo>
  /** Restore files from the encrypted backup (overwrites them) */
  restore: (projectPath: string) => Promise<string[]>
}
