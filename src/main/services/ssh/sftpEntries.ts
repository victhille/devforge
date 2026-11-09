import type { SftpEntry } from '@shared/types'

/** What ssh2's readdir gives for each entry (only what is used here) */
export interface RawSftpEntry {
  filename: string
  attrs: { size: number; mtime: number; isDirectory: () => boolean; isSymbolicLink: () => boolean }
}

/** A folder's entries as shown: folders first, then by name; `.` and `..` left out (the page has its own way up) */
export function toSftpEntries(list: RawSftpEntry[]): SftpEntry[] {
  return list
    .filter(f => f.filename !== '.' && f.filename !== '..')
    .map(f => ({
      name: f.filename,
      kind: f.attrs.isDirectory() ? 'dir' as const : f.attrs.isSymbolicLink() ? 'link' as const : 'file' as const,
      size: f.attrs.size,
      mtime: f.attrs.mtime * 1000
    }))
    .sort((a, b) => Number(b.kind === 'dir') - Number(a.kind === 'dir') || a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }))
}
