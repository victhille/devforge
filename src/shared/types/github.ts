// ─── GitHub on the project page ──────────────────────────────────────────────

export interface GithubRepo { owner: string; repo: string }

export interface GithubRun {
  id: number
  /** Workflow name, then the commit title */
  name: string
  title: string
  branch: string
  event: string
  /** 'queued' | 'in_progress' | 'completed' */
  status: string
  /** 'success' | 'failure' | 'cancelled' | 'skipped' | null while it runs */
  conclusion: string | null
  number: number
  createdAt: string
  url: string
}

export interface GithubPull { number: number; title: string; author: string; branch: string; draft: boolean; createdAt: string; url: string }
export interface GithubRelease { tag: string; name: string; publishedAt: string | null; prerelease: boolean; draft: boolean; url: string }

export interface GithubStatus {
  repo: GithubRepo
  /** Where the token comes from */
  auth: 'gh' | 'token'
  runs: GithubRun[]
  pulls: GithubPull[]
  releases: GithubRelease[]
}

export interface GithubAPI {
  /** The GitHub repository of a project (origin), null when it is not on GitHub */
  repo: (projectPath: string) => Promise<GithubRepo | null>
  /** Throws NO_TOKEN when neither GitHub CLI nor a saved token is there */
  status: (projectPath: string) => Promise<GithubStatus>
  /** Runs again the failed jobs of a run */
  rerun: (projectPath: string, runId: number) => Promise<void>
  /** Saved token (encrypted), checked first; null removes it */
  saveToken: (token: string | null) => Promise<{ login: string | null }>
  hasToken: () => Promise<boolean>
}
