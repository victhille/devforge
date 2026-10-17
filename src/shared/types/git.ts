// ─── Git dashboard ───────────────────────────────────────────────────────────

export interface GitCommitInfo {
  hash: string
  message: string
  author: string
  /** ISO date */
  date: string
}

export interface GitRepoDetails {
  path: string
  isRepo: boolean
  branch: string | null
  /** Number of changed, staged or untracked files */
  changes: number
  ahead: number
  behind: number
  hasUpstream: boolean
  remoteUrl: string | null
  lastCommit: GitCommitInfo | null
}

export interface GitActionResult {
  ok: boolean
  output: string
}

export type FileChangeStatus = 'added' | 'modified' | 'deleted' | 'renamed' | 'untracked'

export interface GitFileChange {
  path: string
  status: FileChangeStatus
  staged: boolean
  /** Line counts, null for binary or untracked files */
  insertions: number | null
  deletions: number | null
}

export interface GitAPI {
  details: (path: string) => Promise<GitRepoDetails>
  fetch:   (path: string) => Promise<GitActionResult>
  /** Fast-forward only, never creates a merge commit */
  pull:    (path: string) => Promise<GitActionResult>
  push:    (path: string) => Promise<GitActionResult>
  /** Working tree changes with line counts */
  changes: (path: string) => Promise<GitFileChange[]>
  /** Stage exactly `files` (relative paths) then commit them */
  commit:  (path: string, message: string, files: string[]) => Promise<GitActionResult>
}
