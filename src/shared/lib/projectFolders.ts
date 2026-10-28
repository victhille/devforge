import type { AppSettings } from '../types'

/**
 * v3.5 lot 1: several projects folders. The first stays defaultProjectsDir
 * (the terminal, the cleaner and the first-launch tour keep reading it); the
 * others follow in extraProjectsDirs. Settings from before need nothing.
 */

const key = (dir: string) => dir.replace(/[/\\]+$/, '').replace(/\//g, '\\').toLowerCase()

/** Every projects folder, in order, without blanks nor duplicates */
export function projectFolders(s: Pick<AppSettings, 'defaultProjectsDir' | 'extraProjectsDirs'>): string[] {
  const seen = new Set<string>(), out: string[] = []
  for (const dir of [s.defaultProjectsDir, ...(s.extraProjectsDirs ?? [])]) {
    const trimmed = (dir ?? '').trim()
    if (!trimmed || seen.has(key(trimmed))) continue
    seen.add(key(trimmed))
    out.push(trimmed)
  }
  return out
}

/** The settings' fields for a list of folders: the first one is the default */
export function withProjectFolders(folders: string[]): Pick<AppSettings, 'defaultProjectsDir' | 'extraProjectsDirs'> {
  const list = projectFolders({ defaultProjectsDir: '', extraProjectsDirs: folders })
  return { defaultProjectsDir: list[0] ?? '', extraProjectsDirs: list.slice(1) }
}

/** The folder a project lives in (the deepest one holding it), or null */
export function folderOf(path: string, folders: string[]): string | null {
  const p = key(path)
  return folders
    .filter(dir => p.startsWith(key(dir) + '\\'))
    .sort((a, b) => key(b).length - key(a).length)[0] ?? null
}

/** A folder's short name, for a card or a filter: its last segment */
export function folderName(dir: string): string {
  return dir.replace(/[/\\]+$/, '').split(/[/\\]/).pop() || dir
}
