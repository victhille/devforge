import { describe, expect, it } from 'vitest'
import { toSftpEntries, type RawSftpEntry } from '../../src/main/services/ssh/sftpEntries'

const raw = (filename: string, kind: 'dir' | 'file' | 'link', size = 0, mtime = 1_700_000_000): RawSftpEntry => ({
  filename,
  attrs: { size, mtime, isDirectory: () => kind === 'dir', isSymbolicLink: () => kind === 'link' }
})

describe('toSftpEntries', () => {
  it('folders first, then by name (numbers in order), without . and ..', () => {
    const out = toSftpEntries([raw('.', 'dir'), raw('..', 'dir'), raw('notes10.txt', 'file', 5), raw('www', 'dir'), raw('notes2.txt', 'file', 3), raw('.ssh', 'dir'), raw('current', 'link')])
    expect(out.map(e => e.name)).toEqual(['.ssh', 'www', 'current', 'notes2.txt', 'notes10.txt'])
    expect(out.find(e => e.name === 'current')?.kind).toBe('link')
  })

  it('sizes in bytes and dates in milliseconds', () => {
    expect(toSftpEntries([raw('a.sql', 'file', 2048, 1_700_000_000)])).toEqual([{ name: 'a.sql', kind: 'file', size: 2048, mtime: 1_700_000_000_000 }])
  })
})
