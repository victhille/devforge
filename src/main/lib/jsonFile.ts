import { randomBytes } from 'crypto'
import { mkdirSync, renameSync, rmSync, writeFileSync } from 'fs'
import { dirname } from 'path'

/**
 * Writes a text file through a temporary file then a rename: a crash or a
 * full disk mid-write leaves the previous file intact instead of a truncated one.
 * The temporary file has a name no one can guess and must not exist yet
 * (`wx`): in a folder a repository fills (a project's notes), a link left
 * there under that name is never followed.
 */
export function writeTextFile(path: string, text: string): void {
  mkdirSync(dirname(path), { recursive: true })
  const tmp = `${path}.${process.pid}.${randomBytes(6).toString('hex')}.tmp`
  try {
    writeFileSync(tmp, text, { encoding: 'utf-8', flag: 'wx' })
    renameSync(tmp, path)
  } catch (err) {
    rmSync(tmp, { force: true })
    throw err
  }
}

/** The same for JSON */
export function writeJsonFile(path: string, data: unknown, pretty = true): void {
  writeTextFile(path, JSON.stringify(data, null, pretty ? 2 : undefined))
}
