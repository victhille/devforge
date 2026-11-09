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
