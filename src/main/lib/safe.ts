import { statSync } from 'fs'
import { relative, resolve, isAbsolute } from 'path'
import { execFile, spawn } from 'child_process'
import { loadProjects } from '../services/projects/projectStorage'

/**
 * Characters that change meaning inside a Windows `cmd.exe` command line even
 * when quoted. Paths containing them are refused rather than escaped.
 */
const CMD_META = /["%&|^<>!\r\n`]/

/** An existing directory whose path is safe to pass to a shell. Throws otherwise. */
export function assertSafeDir(path: unknown): string {
  if (typeof path !== 'string' || !isAbsolute(path)) throw new Error('Invalid path')
  if (CMD_META.test(path)) throw new Error('This path contains characters that cannot be passed safely to a shell')
  let isDir = false
  try { isDir = statSync(path).isDirectory() } catch { /* missing */ }
  if (!isDir) throw new Error(`Not a folder: ${path}`)
  return path
}

/** true when `path` is a saved project folder or inside one */
export function isInsideProject(path: string): boolean {
  const target = resolve(path)
  return loadProjects().some(p => {
    const rel = relative(resolve(p.path), target)
    return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel))
  })
}

/** URLs the app is allowed to hand to the OS (never file:, javascript:, custom protocols) */
export function assertWebUrl(url: unknown): string {
  if (typeof url !== 'string' || !/^(https?:\/\/|mailto:)/i.test(url)) throw new Error('Only http(s) and mailto links can be opened')
  return url
}

/** Full path of a program found in PATH, or null */
export function findExecutable(command: string): Promise<string | null> {
  if (!/^[\w.-]+$/.test(command)) return Promise.resolve(null)
  return new Promise(res => {
    execFile(process.platform === 'win32' ? 'where' : 'which', [command], { windowsHide: true }, (err, stdout) => {
      if (err) return res(null)
      const lines = stdout.split(/\r?\n/).map(l => l.trim()).filter(Boolean)
      // Windows: `where code` also lists the extension-less bash script, which cmd cannot run
      res(process.platform === 'win32' ? lines.find(l => /\.(exe|cmd|bat|com)$/i.test(l)) ?? null : lines[0] ?? null)
    })
  })
}

/**
 * Start a GUI program detached. Windows launchers (code.cmd, phpstorm.cmd)
 * need a shell: the program is resolved to its full path first and every
 * argument must have been validated by the caller (assertSafeDir).
 * Resolves false when the program is not installed.
 */
export async function launch(command: string, args: string[]): Promise<boolean> {
  const exe = await findExecutable(command)
  if (!exe) return false
  const win = process.platform === 'win32'
  const child = win
    ? spawn([exe, ...args].map(a => `"${a}"`).join(' '), { shell: true, detached: true, stdio: 'ignore', windowsHide: true })
    : spawn(exe, args, { detached: true, stdio: 'ignore' })
  return new Promise(res => {
    child.once('error', () => res(false))
    child.once('spawn', () => { child.unref(); res(true) })
  })
}

/** npm script names from package.json: refuse anything a shell could interpret */
export function assertScriptName(name: unknown): string {
  if (typeof name !== 'string' || !/^[\w:.@/+-]+$/.test(name)) throw new Error('Invalid script name')
  return name
}
