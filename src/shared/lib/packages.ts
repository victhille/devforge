import type { UpdateLevel } from '../types/packages'
import { parseVersion, satisfies } from './semver'

/** npm names: "react", "@scope/name" (lower case, no spaces nor shell characters) */
const NPM_NAME = /^(@[a-z0-9][a-z0-9._~-]*\/)?[a-z0-9][a-z0-9._~-]*$/
/** Composer names: "vendor/package" */
const COMPOSER_NAME = /^[a-z0-9]([_.-]?[a-z0-9]+)*\/[a-z0-9](([_.]|-{1,2})?[a-z0-9]+)*$/

export const isPackageName = (name: string, composer = false): boolean =>
  name.length <= 214 && (composer ? COMPOSER_NAME : NPM_NAME).test(name)

/**
 * An npm package to install, as a new project's libraries name it: "zod", "@prisma/client@7".
 * It goes into a command run through a shell: a version holds letters, digits, dots and dashes only.
 * npm reads a spec starting with "." as a folder, and one ending in .tgz or .tar as a file: neither passes.
 */
export function isPackageSpec(spec: unknown): spec is string {
  if (typeof spec !== 'string') return false
  // The @ of a scope is the first character: a version's @ comes after the name
  const at = spec.lastIndexOf('@')
  const [name, version] = at > 0 ? [spec.slice(0, at), spec.slice(at + 1)] : [spec, null]
  return isPackageName(name) && !NPM_FILE.test(name) && (version === null || (/^[A-Za-z0-9][\w.-]{0,63}$/.test(version) && !NPM_FILE.test(version)))
}

/** npm-package-arg's own test for a local archive, as is (its dot matches any character) */
const NPM_FILE = /[.](?:tgz|tar.gz|tar)$/i

/** The version a range starts from: "^1.2.0" → "1.2.0" (null for "*", "latest", git urls…) */
export function rangeFloor(range: string): string | null {
  const m = range.trim().match(/^[\^~>=v]*\s*(\d+(?:\.\d+){0,2})/)
  return m ? m[1] : null
}

/** How far `current` (installed, or the range's floor) is from `latest` */
export function updateLevel(current: string | null, latest: string | null): UpdateLevel {
  const a = current ? parseVersion(current) : null
  const b = latest ? parseVersion(latest) : null
  if (!a || !b) return 'unknown'
  if (b[0] > a[0]) return 'major'
  if (b[0] < a[0]) return 'current'
  if (b[1] > a[1]) return 'minor'
  if (b[1] < a[1]) return 'current'
  return b[2] > a[2] ? 'patch' : 'current'
}

/** Reachable without touching the manifest's range ("npm update"), or only by changing it */
export const fitsRange = (version: string | null, range: string): boolean =>
  !!version && satisfies(version, range.replace(/@\w+/g, '').replace(/(^|[^|])\|(?!\|)/g, '$1||')) === true
