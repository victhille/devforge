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

/** A key of the .env here compared with the server's (no values) */
export interface EnvSyncKey {
  key: string
  /** 'local': only on this PC; 'remote': only on the server */
  status: 'same' | 'different' | 'local' | 'remote'
}

export interface EnvSyncDiff {
  localName: string
  remoteName: string
  /** Full path on the server */
  remotePath: string
  remoteExists: boolean
  keys: EnvSyncKey[]
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
  /** Keys of a local .env against the same file of a deploy target */
  syncDiff: (targetId: string, localName: string, remoteName: string) => Promise<EnvSyncDiff>
  /** 'push' sends the chosen keys to the server, 'pull' brings them here; the file written is saved first */
  syncApply: (targetId: string, localName: string, remoteName: string, direction: 'push' | 'pull', keys: string[]) => Promise<{ changed: number; backup: string | null }>
}
