import { readdir, readFile } from 'fs/promises'
import { join } from 'path'
import type { Project } from '@shared/types'
import { getRepoDetails } from '../git/gitRepo'

async function readText(path: string, max: number): Promise<string | null> {
  const t = await readFile(path, 'utf-8').catch(() => null)
  return t === null ? null : t.length > max ? `${t.slice(0, max)}\n…` : t
}

async function readJson(path: string): Promise<Record<string, unknown> | null> {
  const t = await readFile(path, 'utf-8').catch(() => null)
  try { return t ? JSON.parse(t) as Record<string, unknown> : null } catch { return null }
}

const keys = (o: unknown) => (o && typeof o === 'object' ? Object.keys(o).join(', ') : '')

/** Short project summary given to the model with the first question about it */
export async function projectContext(p: Project): Promise<string> {
  const [git, entries, readme, pkg, composer] = await Promise.all([
    getRepoDetails(p.path).catch(() => null),
    readdir(p.path, { withFileTypes: true }).catch(() => []),
    readText(join(p.path, 'README.md'), 2500),
    readJson(join(p.path, 'package.json')),
    readJson(join(p.path, 'composer.json'))
  ])
  const lines = [
    `Project: ${p.name}`,
    `Path: ${p.path}`,
    `Framework: ${p.framework}, package manager: ${p.packageManager}`
  ]
  if (git?.isRepo) lines.push(`Git: branch ${git.branch}, ${git.changes} changed file(s)${git.hasUpstream ? `, ahead ${git.ahead} / behind ${git.behind}` : ''}`)
  lines.push(`Top-level entries: ${entries.map(e => (e.isDirectory() ? `${e.name}/` : e.name)).sort().join(', ')}`)
  if (pkg) {
    lines.push(`package.json scripts: ${JSON.stringify(pkg.scripts ?? {})}`)
    lines.push(`dependencies: ${keys(pkg.dependencies)}`)
    lines.push(`devDependencies: ${keys(pkg.devDependencies)}`)
  }
  if (composer) lines.push(`composer require: ${keys(composer.require)}`)
  if (readme) lines.push('README (start):', readme)
  return lines.join('\n')
}
