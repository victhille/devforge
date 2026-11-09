import type { PackageManager } from '../types'

/** The package managers DevForge knows: the only ones a command may name */
export const PACKAGE_MANAGERS: readonly PackageManager[] = ['npm', 'pnpm', 'yarn']

/**
 * A known package manager, npm for anything else. A project's field comes from a file that an
 * import or the window may have written, and it goes into commands run through a shell.
 */
export function managerOf(value: unknown): PackageManager {
  return PACKAGE_MANAGERS.includes(value as PackageManager) ? (value as PackageManager) : 'npm'
}

/** The scripts that start a project's dev server, in the order one is picked */
export const SERVER_SCRIPTS: readonly string[] = ['dev', 'start', 'serve']

/** The script that starts this project, null when none of SERVER_SCRIPTS is there */
export function serverScript(scripts: Record<string, string>): string | null {
  return SERVER_SCRIPTS.find(s => Object.prototype.hasOwnProperty.call(scripts, s)) ?? null
}

/**
 * A script that only runs until it is stopped (a dev server, a watcher): stopping it undoes it.
 * Any other one (build, deploy, publish, db:reset…) may change things for good.
 */
export const isLongRunningScript = (script: string): boolean => SERVER_SCRIPTS.includes(script) || script === 'watch'
