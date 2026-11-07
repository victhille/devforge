import { mkdirSync, renameSync, writeFileSync } from 'fs'
import { dirname } from 'path'

/**
 * Writes JSON through a temporary file then a rename: a crash or a full disk
 * mid-write leaves the previous file intact instead of a truncated one.
 */
export function writeJsonFile(path: string, data: unknown, pretty = true): void {
  mkdirSync(dirname(path), { recursive: true })
  const tmp = `${path}.${process.pid}.tmp`
  writeFileSync(tmp, JSON.stringify(data, null, pretty ? 2 : undefined), 'utf-8')
  renameSync(tmp, path)
}
