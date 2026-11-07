// ─── Disk cleaner ────────────────────────────────────────────────────────────

/** dependencies = reinstallable packages, build = generated output, cache = tool caches */
export type CleanKind = 'dependencies' | 'build' | 'cache'

export interface CleanCandidate {
  /** Absolute path of the folder to delete */
  path: string
  /** Folder name, e.g. node_modules */
  name: string
  kind: CleanKind
  projectName: string
  projectPath: string
  /** Last modification of the project folder (ISO) */
  projectModified: string
}

export interface CleanResult {
  removed: string[]
  failed: { path: string; error: string }[]
  freedBytes: number
}

export interface CleanerAPI {
  /** Find cleanable folders under `root`, without computing sizes */
  scan: (root: string) => Promise<CleanCandidate[]>
  /** Total size in bytes of a folder found by the last scan */
  size: (path: string) => Promise<number>
  /** Permanently delete folders found by the last scan */
  remove: (paths: string[]) => Promise<CleanResult>
}
