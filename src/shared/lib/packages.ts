import type { UpdateLevel } from '../types/packages'
import { parseVersion, satisfies } from './semver'

/** npm names: "react", "@scope/name" (lower case, no spaces nor shell characters) */
const NPM_NAME = /^(@[a-z0-9][a-z0-9._~-]*\/)?[a-z0-9][a-z0-9._~-]*$/
/** Composer names: "vendor/package" */
const COMPOSER_NAME = /^[a-z0-9]([_.-]?[a-z0-9]+)*\/[a-z0-9](([_.]|-{1,2})?[a-z0-9]+)*$/

export const isPackageName = (name: string, composer = false): boolean =>
  name.length <= 214 && (composer ? COMPOSER_NAME : NPM_NAME).test(name)

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
