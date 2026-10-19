import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync } from 'fs'
import { join } from 'path'
import { writeJsonFile } from '../../lib/jsonFile'

/**
 * Data format of everything DevForge keeps in userData. `storage.json` holds
 * the version the files were written with; at startup the migrations up to
 * SCHEMA_VERSION run once, after a backup of the data files.
 *
 * Adding a format change: bump SCHEMA_VERSION and append a migration whose
 * `to` is the new number. A migration gets the data folder and rewrites the
 * files it owns (use writeJsonFile).
 */
export const SCHEMA_VERSION = 1

export interface Migration {
  to: number
  /** One line for the log */
  name: string
  run: (dataDir: string) => void
}

/** Format changes, oldest first */
export const MIGRATIONS: Migration[] = []

/** Files and folders that make up the user's data (Chromium's own folders are left out) */
export const DATA_ENTRIES = [
  'settings.json', 'projects.json', 'ssh-connections.json', 'known_hosts.json', 'databases.json',
  'deploy.json', 'stacks.json', 'domains.json', 'monitors.json', 'assistant', 'env-backups',
  'project-links.json', 'active-project.json', 'watch.json', 'history'
]

const MANIFEST = 'storage.json'
const BACKUPS = 'backups'
const KEEP_BACKUPS = 5

export type MigrationOutcome =
  | { status: 'current'; version: number }
  | { status: 'migrated'; from: number; to: number; backup: string; applied: string[] }
  /** Written by a newer DevForge: left untouched */
  | { status: 'newer'; version: number }

export function readSchemaVersion(dataDir: string): number {
  try {
    const v = (JSON.parse(readFileSync(join(dataDir, MANIFEST), 'utf-8')) as { schemaVersion?: unknown }).schemaVersion
    return typeof v === 'number' && Number.isInteger(v) && v > 0 ? v : 1
  } catch {
    // No manifest: data from before versioning (v1.x), or a fresh install
    return 1
  }
}

/** Copies the data files to backups/v<from>-<date>, keeping the last few backups */
export function backupData(dataDir: string, from: number, now = new Date()): string {
  const stamp = now.toISOString().replace(/[:.]/g, '-')
  const dest = join(dataDir, BACKUPS, `v${from}-${stamp}`)
  mkdirSync(dest, { recursive: true })
  for (const entry of [...DATA_ENTRIES, MANIFEST]) {
    const src = join(dataDir, entry)
    if (existsSync(src)) cpSync(src, join(dest, entry), { recursive: true })
  }
  const all = readdirSync(join(dataDir, BACKUPS)).sort()
  for (const old of all.slice(0, Math.max(0, all.length - KEEP_BACKUPS))) rmSync(join(dataDir, BACKUPS, old), { recursive: true, force: true })
  return dest
}

/** Brings the data folder to `target`; never touches data written by a newer version */
export function migrateData(dataDir: string, migrations: Migration[] = MIGRATIONS, target = SCHEMA_VERSION): MigrationOutcome {
  const from = readSchemaVersion(dataDir)
  if (from > target) return { status: 'newer', version: from }

  const pending = migrations.filter(m => m.to > from && m.to <= target).sort((a, b) => a.to - b.to)
  if (pending.length === 0) {
    if (!existsSync(join(dataDir, MANIFEST))) writeJsonFile(join(dataDir, MANIFEST), { schemaVersion: target })
    return { status: 'current', version: target }
  }

  const backup = backupData(dataDir, from)
  for (const m of pending) {
    m.run(dataDir)
    // Saved after each step: a crash resumes from the last finished migration
    writeJsonFile(join(dataDir, MANIFEST), { schemaVersion: m.to })
  }
  writeJsonFile(join(dataDir, MANIFEST), { schemaVersion: target })
  return { status: 'migrated', from, to: target, backup, applied: pending.map(m => m.name) }
}
