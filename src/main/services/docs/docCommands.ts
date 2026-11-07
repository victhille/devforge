import { existsSync, readFileSync } from 'fs'
import { readdir } from 'fs/promises'
import { delimiter, extname, join } from 'path'
import { randomUUID } from 'crypto'
import { app } from 'electron'
import type { CommandCheck, CustomCommand } from '@shared/types'
import { writeJsonFile } from '../../lib/jsonFile'
import { findExecutable } from '../../lib/safe'

/**
 * v3.5 lot 5: commands the user adds to the Docs page (a command, what it
 * does, a category), kept in userData/doc-commands.json and exported with
 * the rest of DevForge's data. A command is checked against this PC (its
 * program found with `where`) but may be saved anyway: a remote server's.
 */

const file = () => join(app.getPath('userData'), 'doc-commands.json')

export function listCommands(): CustomCommand[] {
  if (!existsSync(file())) return []
  try {
    const list = JSON.parse(readFileSync(file(), 'utf-8')) as CustomCommand[]
    return Array.isArray(list) ? list.filter(c => c && typeof c.cmd === 'string') : []
  } catch { return [] }
}

const clean = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '')

/** Adds or replaces one (by id); returns the list */
export function saveCommand(input: Partial<CustomCommand>): CustomCommand[] {
  const cmd = clean(input.cmd, 500)
  const category = clean(input.category, 60)
  if (!cmd || !category) throw new Error('A command and a category are needed')
  const list = listCommands()
  const prev = list.find(c => c.id === input.id)
  const next: CustomCommand = { id: prev?.id ?? randomUUID(), cmd, desc: clean(input.desc, 300), category, createdAt: prev?.createdAt ?? new Date().toISOString() }
  writeJsonFile(file(), prev ? list.map(c => (c.id === prev.id ? next : c)) : [...list, next])
  return listCommands()
}

export function removeCommand(id: string): CustomCommand[] {
  writeJsonFile(file(), listCommands().filter(c => c.id !== id))
  return listCommands()
}

/** The program a command starts: its first word (php for `php artisan migrate`) */
export function programOf(cmd: string): string {
  return cmd.trim().split(/\s+/)[0]?.replace(/^["']|["']$/g, '') ?? ''
}

export async function checkCommand(cmd: string): Promise<CommandCheck> {
  const program = programOf(String(cmd ?? ''))
  if (!program) return { program, found: false }
  const path = await findExecutable(program)
  return path ? { program, found: true, path } : { program, found: false }
}

let programs: string[] | null = null

/** Every program of the PATH, by name (git, npm, php…), read once */
export async function pathPrograms(): Promise<string[]> {
  if (programs) return programs
  const exts = new Set((process.env.PATHEXT ?? '.EXE;.CMD;.BAT;.COM').toLowerCase().split(';'))
  const dirs = [...new Set((process.env.PATH ?? '').split(delimiter).filter(Boolean))]
  const names = await Promise.all(dirs.map(d => readdir(d).catch(() => [] as string[])))
  const found = new Set<string>()
  for (const name of names.flat()) {
    const ext = extname(name).toLowerCase()
    if (process.platform !== 'win32' || exts.has(ext)) found.add((process.platform === 'win32' ? name.slice(0, -ext.length) : name).toLowerCase())
  }
  programs = [...found].sort()
  return programs
}
