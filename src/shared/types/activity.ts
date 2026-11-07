// ─── Activity across projects (v3.8 lot 3) ────────────────────────────────────

export interface ActivityCommit {
  /** Unix seconds */
  at: number
  email: string
  added: number
  removed: number
}

export interface ProjectActivity {
  id: string
  name: string
  path: string
  /** The commits of the last 12 weeks (merges left out) */
  commits: ActivityCommit[]
  /** The last commit, any age (Unix seconds); null: no commit or not a repository */
  lastCommitAt: number | null
  branch: string | null
  ahead: number
  behind: number
}

export interface ActivityData {
  /** git config user.email: "me" */
  me: string | null
  projects: ProjectActivity[]
  /** When it was read (Unix ms) */
  at: number
}

export interface ActivityAPI {
  /** Every saved project's activity (kept a few minutes; fresh reads again) */
  get: (fresh?: boolean) => Promise<ActivityData>
}
