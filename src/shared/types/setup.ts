// ─── Project setup (v2.2 lot 1): what DevForge adds after the framework's own creation ───

export type SetupDatabase = 'none' | 'postgres' | 'mysql' | 'sqlite'
export type SetupFeature = 'api' | 'auth' | 'docker' | 'tests' | 'ci'

export interface ProjectSetup {
  database: SetupDatabase
  /** Database name, and its port on this PC (Postgres and MySQL) */
  dbName: string
  dbPort: number
  features: SetupFeature[]
  /** git init (if the framework did not) and a first commit */
  git: boolean
  /** Repository created with GitHub CLI: "name" or "owner/name" */
  github: { repo: string; private: boolean } | null
  openVSCode: boolean
}

/** One step of the plan: shown as is in the summary, then run in order */
export type SetupStep =
  | { kind: 'run'; label: string; exe: string; args: string[]; optional?: boolean; skipIf?: string }
  | { kind: 'write'; label: string; files: { path: string; content: string }[] }
  | { kind: 'env'; label: string; file: string; vars: Record<string, string> }
  | { kind: 'ignore'; label: string; lines: string[] }
  | { kind: 'scripts'; label: string; scripts: Record<string, string> }
  | { kind: 'connection'; label: string; type: 'postgres' | 'mysql' | 'sqlite'; port: number; user: string; database: string; file?: string }

/** PHP on this PC, for a Symfony project */
export interface PhpStatus {
  found: boolean
  /** The php.ini PHP loads, null when it runs without one */
  ini: string | null
  /** Needed extensions that are not loaded */
  missing: string[]
}

export interface SetupAPI {
  phpStatus: (database: SetupDatabase) => Promise<PhpStatus>
  /** Turns the missing extensions on in php.ini (after a backup copy) */
  phpEnable: (database: SetupDatabase) => Promise<PhpStatus>
  /** First free TCP port from `start` on this PC */
  freePort: (start: number) => Promise<number>
  /** Login of the GitHub account DevForge can use, null when none */
  githubLogin: () => Promise<string | null>
}
