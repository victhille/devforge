import type { AuditSummary, ManifestFile, PackageManifest, PackageUpdate } from '@shared/types'
import { audit, installCommand, latestVersions, listManifests, manifestDir, managerOf, restoreBackup, runLogged, testData, update, type PackagesBackup } from './npmPackages'
import { composer, composerAudit, composerAvailable, composerLatest, composerUpdate, listComposerManifests } from './composerPackages'

/**
 * npm and Composer behind one door, for the Packages tab and for Forgy
 * (v3.3 lots 2 to 4): the manifest file picks the tool.
 */

export async function projectManifests(root: string): Promise<PackageManifest[]> {
  const composerOnes = await Promise.all(listComposerManifests(root).map(async m =>
    ({ ...m, toolMissing: !(await composerAvailable(manifestDir(root, m.dir, 'composer.json'))) })))
  return [...listManifests(root), ...composerOnes]
}

export function latestFor(root: string, dir: string, file: ManifestFile, names: string[]): Promise<Record<string, string | null>> {
  const full = manifestDir(root, dir, file)
  return file === 'composer.json' ? composerLatest(names) : latestVersions(full, names)
}

export function auditFor(root: string, dir: string, file: ManifestFile): Promise<AuditSummary | null> {
  const full = manifestDir(root, dir, file)
  return file === 'composer.json' ? composerAudit(full) : audit(root, full, managerOf(full, root))
}

export function updateFor(root: string, dir: string, file: ManifestFile, updates: PackageUpdate[], onLog: (line: string) => void):
  Promise<{ ok: boolean; restored: boolean; backup?: PackagesBackup }> {
  const full = manifestDir(root, dir, file)
  return file === 'composer.json' ? composerUpdate(full, updates, onLog) : update(root, full, managerOf(full, root), updates, onLog)
}

/** Undo of an update: the saved manifest and lockfile back, then the dependencies installed from them */
export async function restoreAndInstall(root: string, dir: string, file: ManifestFile, saved: PackagesBackup): Promise<boolean> {
  const full = manifestDir(root, dir, file)
  restoreBackup(full, saved)
  const fake = testData()?.install as string | undefined
  const cmd = fake ?? (file === 'composer.json' ? composer(full, 'install --no-interaction') : installCommand(managerOf(full, root)))
  return runLogged(cmd, full, () => {})
}
