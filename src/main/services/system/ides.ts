import { existsSync, readdirSync, statSync } from 'fs'
import { dirname, relative, resolve } from 'path'
import { spawn } from 'child_process'
import type { CustomIde } from '@shared/types'
import { IDE_CATALOG, ideArgs, type IdeEntry, type IdeInfo } from '@shared/data/ides'
import { loadSettings } from '../settings/settingsService'
import { assertSafeDir, findExecutable, isInsideProject } from '../../lib/safe'

/**
 * v3.5 lot 3: finds the IDEs on this PC and opens a folder with one: an IDE
 * of the catalog, or one added by hand in Settings (a program and its
 * arguments). Programs run without a shell; a .cmd or .bat needs one, so its
 * path and arguments must hold no character cmd.exe would interpret.
 */

const CMD_META = /["%&|^<>!\r\n`]/

/** Every file a pattern names: %VAR% replaced, each `*` a folder of that name's start */
export function expandPattern(pattern: string, env: NodeJS.ProcessEnv = process.env): string[] {
  const path = pattern.replace(/%([^%]+)%/g, (_, k: string) => env[k] ?? env[k.toUpperCase()] ?? `%${k}%`)
  if (path.includes('%')) return []
  const parts = path.split('\\')
  let found = [parts[0]]
  for (const part of parts.slice(1)) {
    if (!part.includes('*')) { found = found.map(p => `${p}\\${part}`); continue }
    const prefix = part.slice(0, part.indexOf('*'))
    found = found.flatMap(p => {
      try {
        return readdirSync(p, { withFileTypes: true })
          .filter(e => e.isDirectory() && e.name.toLowerCase().startsWith(prefix.toLowerCase()))
          .map(e => `${p}\\${e.name}`)
          .sort().reverse() // the newest version first
      } catch { return [] }
    })
  }
  return found.filter(p => existsSync(p))
}

const found = new Map<string, string | null>()

/** The program of a catalog IDE: its install folders, then PATH (kept until a fresh look) */
async function programOf(ide: IdeEntry): Promise<string | null> {
  if (found.has(ide.id)) return found.get(ide.id)!
  const file = ide.paths.flatMap(p => expandPattern(p))[0] ?? (ide.command ? await findExecutable(ide.command) : null)
  found.set(ide.id, file)
  return file
}

const customIdes = (): CustomIde[] => loadSettings().customIdes ?? []

export async function listIdes(fresh = false): Promise<IdeInfo[]> {
  if (fresh) found.clear()
  const catalog = await Promise.all(IDE_CATALOG.map(async ide => ({ id: ide.id, name: ide.name, installed: !!(await programOf(ide)) })))
  const custom = customIdes().map(c => ({ id: c.id, name: c.name, installed: existsSync(c.path), custom: true }))
  return [...catalog, ...custom]
}

/** Starts a program detached; resolves once it started */
function start(program: string, args: string[]): Promise<void> {
  const script = /\.(cmd|bat)$/i.test(program)
  if (script && [program, ...args].some(a => CMD_META.test(a))) throw new Error('This program or its arguments contain characters that cannot be passed safely to a shell')
  const child = script
    ? spawn([program, ...args].map(a => `"${a}"`).join(' '), { shell: true, detached: true, stdio: 'ignore', windowsHide: true, cwd: dirname(program) })
    : spawn(program, args, { detached: true, stdio: 'ignore', cwd: dirname(program) })
  return new Promise((res, rej) => {
    child.once('error', err => rej(err))
    child.once('spawn', () => { child.unref(); res() })
  })
}

/** An IDE added by hand: an existing program, never a document the OS would open with something else */
function assertProgram(c: CustomIde): void {
  if (typeof c?.path !== 'string' || !/\.(exe|cmd|bat)$/i.test(c.path) || !existsSync(c.path)) throw new Error(`Program not found: ${c?.path}`)
}

export async function openInIde(dirPath: string, ideId: string): Promise<void> {
  const dir = assertSafeDir(dirPath)
  if (!ideId || ideId === 'none') return
  const custom = customIdes().find(c => c.id === ideId)
  if (custom) {
    assertProgram(custom)
    return start(custom.path, ideArgs(custom.args, dir))
  }
  const ide = IDE_CATALOG.find(i => i.id === ideId)
  if (!ide) throw new Error(`Unknown IDE: ${ideId}`)
  const program = await programOf(ide)
  if (!program) throw new Error(`${ide.name} was not found on this PC`)
  return start(program, (ide.args ?? ['{dir}']).map(a => a.split('{dir}').join(dir)))
}

/** Given a folder then a file, these open the folder's window (the one already open, if any) with the file in it */
const FOLDER_THEN_FILE = new Set(['vscode', 'cursor', 'windsurf', 'antigravity', 'zed'])

/** The catalog IDE's arguments for a file of the project at `root` */
export function fileArgs(ideId: string, filePath: string, root: string | null): string[] {
  return root && FOLDER_THEN_FILE.has(ideId) ? [root, filePath] : [filePath]
}

/**
 * v3.5.3: one file of a saved project, in an IDE. v3.5.4: with the project's
 * folder (`root`) for the editors of the VS Code family and Zed, so the file
 * opens in that project's window, not in the last one used. Others get the
 * file alone; one added by hand gets its arguments, {dir} being the file.
 */
export async function openFileInIde(filePath: string, ideId: string, root?: string): Promise<void> {
  if (typeof filePath !== 'string' || !isInsideProject(filePath) || !existsSync(filePath) || !statSync(filePath).isFile()) throw new Error('Not a file of a saved project')
  // The folder must be a saved project's, and hold the file
  const folder = typeof root === 'string' && root && isInsideProject(root) && existsSync(root) && statSync(root).isDirectory()
    && !relative(resolve(root), resolve(filePath)).startsWith('..') ? resolve(root) : null
  if (!ideId || ideId === 'none') return
  const custom = customIdes().find(c => c.id === ideId)
  if (custom) {
    assertProgram(custom)
    return start(custom.path, ideArgs(custom.args, filePath))
  }
  const ide = IDE_CATALOG.find(i => i.id === ideId)
  if (!ide) throw new Error(`Unknown IDE: ${ideId}`)
  const program = await programOf(ide)
  if (!program) throw new Error(`${ide.name} was not found on this PC`)
  return start(program, fileArgs(ide.id, filePath, folder))
}

/** "Try" in Settings: the IDE being added opens the projects folder (or the home folder) */
export async function tryIde(c: CustomIde, home: string): Promise<void> {
  assertProgram(c)
  const projects = loadSettings().defaultProjectsDir
  const dir = projects && existsSync(projects) ? projects : home
  return start(c.path, ideArgs(String(c.args ?? ''), assertSafeDir(dir)))
}
