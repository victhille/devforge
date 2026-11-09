import { existsSync, readFileSync } from 'fs'
import { join } from 'path'
import { isNetworkPath } from '@shared/lib/sshAddress'
import { SCRIPT_NAME, assertSafeDir, isInsideProject } from '../../lib/safe'

/**
 * A folder whose scripts may be read, run or installed: an existing absolute folder with nothing a
 * shell would read, and a network share only when it is a saved project. The terminal's folder
 * comes from what the shell prints, and only looking at \\host\share sends the Windows login to
 * that host: the share is refused before anything touches it. Throws otherwise.
 */
export function assertScriptsDir(projectPath: unknown): string {
  if (typeof projectPath === 'string' && isNetworkPath(projectPath) && !isInsideProject(projectPath)) {
    throw new Error('Network folder refused: not a saved project')
  }
  return assertSafeDir(projectPath)
}

/**
 * The scripts of a folder's package.json, {} without one or when it cannot be read, once the folder
 * is checked (assertScriptsDir). Only scripts with a plain name and a text command go back: a name
 * is typed into the terminal as it is.
 */
export function readScripts(projectPath: unknown): Record<string, string> {
  const pkgPath = join(assertScriptsDir(projectPath), 'package.json')
  if (!existsSync(pkgPath)) return {}
  try {
    const scripts = (JSON.parse(readFileSync(pkgPath, 'utf-8')) as { scripts?: unknown }).scripts
    if (!scripts || typeof scripts !== 'object' || Array.isArray(scripts)) return {}
    return Object.fromEntries(Object.entries(scripts).filter((e): e is [string, string] => SCRIPT_NAME.test(e[0]) && typeof e[1] === 'string'))
  } catch { return {} }
}
