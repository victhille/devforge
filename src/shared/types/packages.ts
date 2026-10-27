// ─── A project's packages: npm, pnpm, yarn (v3.3 lot 2), Composer (lot 3) ─────

export type PackageManagerKind = 'npm' | 'pnpm' | 'yarn' | 'composer'

/** How far the installed version is from the latest one */
export type UpdateLevel = 'current' | 'patch' | 'minor' | 'major' | 'unknown'

export interface PackageInfo {
  name: string
  /** What the manifest asks for: "^1.2.0" */
  wanted: string
  /** In node_modules (or vendor), null when not installed */
  installed: string | null
  dev: boolean
}

export interface PackageManifest {
  /** Folder of the manifest, relative to the project ("" for its root) */
  dir: string
  file: 'package.json' | 'composer.json'
  /** The manifest's own "name" */
  name: string | null
  manager: PackageManagerKind
  packages: PackageInfo[]
  /** Composer is not installed on this PC (and the project does not run on Sail) */
  toolMissing?: boolean
}

export type ManifestFile = PackageManifest['file']

/** 'unknown': the advisory gives no severity (older Composer versions) */
export type AuditSeverity = 'unknown' | 'info' | 'low' | 'moderate' | 'high' | 'critical'

export interface AuditSummary {
  total: number
  bySeverity: Record<AuditSeverity, number>
  /** Package name → its worst severity */
  packages: Record<string, AuditSeverity>
}

/** Within the manifest's range ("compatible"), or to the latest version (a major one asks first) */
export interface PackageUpdate { name: string; dev: boolean; target: 'compatible' | 'latest' }

export interface PackagesAPI {
  /** Every manifest of the project and what it declares (fast: no network) */
  list: (projectId: string) => Promise<PackageManifest[]>
  /** Latest published versions (registry), null when unknown */
  latest: (projectId: string, dir: string, file: ManifestFile, names: string[]) => Promise<Record<string, string | null>>
  /** Known vulnerabilities; null when the manager cannot tell (no lockfile, not installed) */
  audit: (projectId: string, dir: string, file: ManifestFile) => Promise<AuditSummary | null>
  /** Updates after saving the manifest and lockfile; put back as they were if the command fails */
  update: (projectId: string, dir: string, file: ManifestFile, updates: PackageUpdate[]) => Promise<{ ok: boolean; restored: boolean }>
  /** The update's output, line by line */
  onLog: (cb: (line: string) => void) => () => void
}
