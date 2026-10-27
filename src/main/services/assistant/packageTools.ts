import type { ManifestFile, PackageManifest, Project } from '@shared/types'
import { fitsRange, rangeFloor, updateLevel } from '@shared/lib/packages'
import { auditFor, latestFor, projectManifests, updateFor } from '../packages/projectPackages'
import type { PackagesBackup } from '../packages/npmPackages'
import { ToolError } from './assistantTools'

/**
 * Forgy and a project's packages (v3.3 lot 4): `project_packages` tells what
 * is behind or vulnerable; `update_packages` is an action, so it goes through
 * a card the user approves, and its undo puts the saved files back.
 */

const label = (m: PackageManifest) => `${m.dir ? `${m.dir}/` : ''}${m.file}`

/** What is behind (or not installed), per manifest; the audit only when asked (it is slow) */
export async function packagesReport(p: Project, withAudit: unknown): Promise<string> {
  const manifests = await projectManifests(p.path)
  if (!manifests.length) return 'This project has no package.json nor composer.json.'
  const parts: string[] = []
  for (const m of manifests) {
    const latest = await latestFor(p.path, m.dir, m.file, m.packages.map(x => x.name))
    const lines: string[] = []
    for (const x of m.packages) {
      const l = latest[x.name] ?? null
      const level = updateLevel(x.installed ?? rangeFloor(x.wanted), l)
      if (!x.installed) lines.push(`- ${x.name}: not installed (wants ${x.wanted}${l ? `, latest ${l}` : ''})`)
      else if (level !== 'current' && level !== 'unknown') lines.push(`- ${x.name} ${x.installed} → ${l} (${level}, ${fitsRange(l, x.wanted) ? 'within its range' : 'needs a range change'})${x.dev ? ' [dev]' : ''}`)
    }
    parts.push(`${label(m)} (${m.manager}${m.toolMissing ? ', Composer NOT installed on this PC' : ''}): ${m.packages.length} packages, ${lines.length} to look at`)
    parts.push(...lines.slice(0, 40), ...(lines.length > 40 ? [`… and ${lines.length - 40} more`] : []))
    if (withAudit === true && !m.toolMissing) {
      const a = await auditFor(p.path, m.dir, m.file).catch(() => null)
      parts.push(!a ? 'Vulnerabilities: audit unavailable (no lockfile or not installed)'
        : a.total === 0 ? 'Vulnerabilities: none'
        : `Vulnerabilities: ${a.total} (${Object.entries(a.bySeverity).filter(([, n]) => n).map(([s, n]) => `${s} ${n}`).join(', ')}) — ${Object.entries(a.packages).map(([n, s]) => `${n}: ${s}`).join(', ')}`)
    }
    parts.push('')
  }
  return parts.join('\n').trim()
}

/** The manifest named by Forgy ("apps/web/package.json"), or the only one declaring all the packages */
function pickManifest(manifests: PackageManifest[], names: string[], ref: unknown): PackageManifest {
  if (typeof ref === 'string' && ref.trim()) {
    const want = ref.trim().replace(/\\/g, '/').replace(/^\.\//, '')
    const m = manifests.find(x => label(x) === want)
    if (!m) throw new ToolError(`Unknown manifest "${ref}". This project has: ${manifests.map(label).join(', ')}`)
    return m
  }
  const holders = manifests.filter(m => names.every(n => m.packages.some(x => x.name === n)))
  if (holders.length === 1) return holders[0]
  throw new ToolError(holders.length ? `Several manifests declare these packages: pass "manifest" (${holders.map(label).join(', ')})` : 'No manifest declares all these packages: check the names with project_packages')
}

export interface PackagesPlan {
  title: string
  preview: string
  run: () => Promise<{ output: string; undo: { type: 'packages-restore'; path: string; dir: string; file: ManifestFile } & PackagesBackup }>
}

export async function updatePackagesPlan(p: Project, rawNames: unknown, to: unknown, manifestRef: unknown): Promise<PackagesPlan> {
  const names = Array.isArray(rawNames) ? [...new Set(rawNames.filter((n): n is string => typeof n === 'string' && !!n.trim()).map(n => n.trim()))] : []
  if (!names.length) throw new ToolError('Missing "packages"')
  if (names.length > 30) throw new ToolError('30 packages at most per update')
  const target = to === 'latest' ? 'latest' : 'compatible'
  const m = pickManifest(await projectManifests(p.path), names, manifestRef)
  if (m.toolMissing) throw new ToolError('Composer is not installed on this PC: the update cannot run (getcomposer.org)')
  const unknown = names.filter(n => !m.packages.some(x => x.name === n))
  if (unknown.length) throw new ToolError(`Not declared in ${label(m)}: ${unknown.join(', ')}`)
  const latest = await latestFor(p.path, m.dir, m.file, names)
  const lines = names.map(n => {
    const x = m.packages.find(y => y.name === n)!
    const l = latest[n] ?? null
    const level = updateLevel(x.installed ?? rangeFloor(x.wanted), l)
    return target === 'latest'
      ? `- ${n}: ${x.installed ?? 'not installed'} → ${l ?? '?'}${level === 'major' ? ' (MAJOR: breaking changes possible)' : ''}`
      : `- ${n}: ${x.installed ?? 'not installed'} → newest within ${x.wanted}`
  })
  return {
    title: `Update ${names.length === 1 ? names[0] : `${names.length} packages`} · ${p.name}`,
    preview: [`${label(m)} (${m.manager})`, ...lines, '', `${m.file === 'composer.json' ? 'composer.json and composer.lock' : 'package.json and the lockfile'} are saved first; undo puts them back and reinstalls.`].join('\n'),
    run: async () => {
      const log: string[] = []
      const r = await updateFor(p.path, m.dir, m.file, names.map(n => ({ name: n, dev: !!m.packages.find(x => x.name === n)?.dev, target })), line => log.push(line))
      if (!r.ok || !r.backup) throw new Error(`The update failed${r.restored ? '; the files are back as they were' : ''}.\n${log.slice(-15).join('\n')}`)
      return {
        output: `Updated in ${label(m)}.\n${log.slice(-5).join('\n')}`,
        undo: { type: 'packages-restore', path: p.path, dir: m.dir, file: m.file, ...r.backup }
      }
    }
  }
}
