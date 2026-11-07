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
  /** `fresh` skips the few-second cache */
  details: (path: string, fresh?: boolean) => Promise<GitRepoDetails>
  fetch:   (path: string) => Promise<GitActionResult>
  /** Fast-forward only, never creates a merge commit */
  pull:    (path: string) => Promise<GitActionResult>
  push:    (path: string) => Promise<GitActionResult>
  /** Working tree changes with line counts */
  changes: (path: string) => Promise<GitFileChange[]>
  /** v3.7: the changed files of a project's folder, relative to it */
  fileStates: (path: string) => Promise<{ inRepo: boolean; files: Record<string, FileChangeStatus> }>
  /** v3.7: one file's changes since the last commit, as a unified diff */
  fileDiff: (path: string, rel: string) => Promise<{ diff: string; status: FileChangeStatus | null }>
  /** Stage exactly `files` (relative paths) then commit them */
  commit:  (path: string, message: string, files: string[]) => Promise<GitActionResult>
}
