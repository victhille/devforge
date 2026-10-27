// ─── Project setup (v2.2 lot 1): what DevForge adds after the framework's own creation ───

export type SetupDatabase = 'none' | 'postgres' | 'mysql' | 'sqlite'
export type SetupFeature = 'api' | 'auth' | 'docker' | 'tests' | 'ci'

export interface ProjectSetup {
  database: SetupDatabase
  /** Database name, and its port on this PC (Postgres and MySQL) */
  dbName: string
  dbPort: number
  /** Laravel Sail: the app's port on this PC (APP_PORT), a free one from 8000 */
  appPort?: number
  features: SetupFeature[]
  /** git init (if the framework did not) and a first commit */
  git: boolean
  /** Repository created with GitHub CLI: "name" or "owner/name" */
  github: { repo: string; private: boolean } | null
  openVSCode: boolean
  /** v3.4: DevForge's welcome page in place of the framework's */
  welcome?: boolean
}

/** One step of the plan: shown as is in the summary, then run in order */
export type SetupStep =
  /** skipIf: not run when this path exists; onlyIf: run only when it exists */
  | { kind: 'run'; label: string; exe: string; args: string[]; optional?: boolean; skipIf?: string; onlyIf?: string }
  | { kind: 'write'; label: string; files: { path: string; content: string }[] }
  | { kind: 'env'; label: string; file: string; vars: Record<string, string> }
  | { kind: 'ignore'; label: string; lines: string[] }
  | { kind: 'scripts'; label: string; scripts: Record<string, string> }
  /** Lines containing `match` taken out of a file (Sail's mounts Docker Desktop cannot read outside WSL) */
  | { kind: 'drop-lines'; label: string; file: string; match: string }
  | { kind: 'connection'; label: string; type: 'postgres' | 'mysql' | 'sqlite'; port: number; user: string; database: string; file?: string }
  /** Tailwind 4 wired in a Vite project: its plugin in vite.config, and @import "tailwindcss" in the main stylesheet */
  | { kind: 'tailwind'; label: string }
  /** A PHP trait added to a class: its import and its use line (Sanctum's HasApiTokens on User) */
  | { kind: 'add-trait'; label: string; file: string; trait: string }
  /** Text added at the end of a file, unless the file already contains `unless` (Prisma's User model) */
  | { kind: 'append'; label: string; file: string; text: string; unless: string }
  /** `text` put after (mode after) or in place of (mode replace) the first match of the `find` pattern, unless the file contains `unless`; a file without the pattern is left as is */
  | { kind: 'patch'; label: string; file: string; find: string; mode: 'after' | 'replace'; text: string; unless: string }

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
  /** Database volumes an earlier project of this name left in Docker */
  previousVolumes: (name: string) => Promise<string[]>
}
