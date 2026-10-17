import { readFile } from 'fs/promises'
import { join } from 'path'
import type { ProjectRequirements, VersionRequirement } from '@shared/types'

async function text(dir: string, name: string): Promise<string | null> {
  try { return (await readFile(join(dir, name), 'utf-8')).trim() } catch { return null }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function json(dir: string, name: string): Promise<Record<string, any> | null> {
  const t = await text(dir, name)
  if (!t) return null
  try { return JSON.parse(t) } catch { return null }
}

/** Version constraints declared by a project, first match per tool wins. */
export async function readRequirements(dir: string): Promise<VersionRequirement[]> {
  const [nvmrc, nodeVersion, pkg, composer, pyVersion, pyproject] = await Promise.all([
    text(dir, '.nvmrc'), text(dir, '.node-version'), json(dir, 'package.json'),
    json(dir, 'composer.json'), text(dir, '.python-version'), text(dir, 'pyproject.toml')
  ])
  const reqs: VersionRequirement[] = []

  // Node
  const node =
    (nvmrc       && { range: nvmrc.split(/\s/)[0],       source: '.nvmrc' }) ||
    (nodeVersion && { range: nodeVersion.split(/\s/)[0], source: '.node-version' }) ||
    (pkg?.volta?.node   && { range: String(pkg.volta.node),   source: 'package.json volta' }) ||
    (pkg?.engines?.node && { range: String(pkg.engines.node), source: 'package.json engines' })
  if (node) reqs.push({ tool: 'node', ...node })

  // PHP
  const php =
    (composer?.config?.platform?.php && { range: String(composer.config.platform.php), source: 'composer.json platform' }) ||
    (composer?.require?.php          && { range: String(composer.require.php),          source: 'composer.json' })
  if (php) reqs.push({ tool: 'php', ...php })

  // Python
  const requiresPython = pyproject?.match(/requires-python\s*=\s*["']([^"']+)["']/)?.[1]
  const python =
    (pyVersion      && { range: pyVersion.split(/\s/)[0], source: '.python-version' }) ||
    (requiresPython && { range: requiresPython,          source: 'pyproject.toml' })
  if (python) reqs.push({ tool: 'python', ...python })

  return reqs
}

export function readAllRequirements(paths: string[]): Promise<ProjectRequirements[]> {
  return Promise.all(paths.map(async projectPath => ({ projectPath, requirements: await readRequirements(projectPath) })))
}
