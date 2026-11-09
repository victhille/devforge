import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mkdirSync, rmSync, writeFileSync } from 'fs'
import * as fs from 'fs'
import { join } from 'path'
import { MAX_NOTES, openCounts } from '../../src/main/services/notes/projectNotes'
import { saveProjects, tempDir, userData } from '../helpers'

// Every lstat of the notes service is counted, the files themselves are real
vi.mock('fs', async importOriginal => {
  const real = await importOriginal<typeof import('fs')>()
  return { ...real, default: real, lstatSync: vi.fn(real.lstatSync) }
})

/**
 * The counts of open boxes are asked again after every saved note, for every project:
 * a cloned repository with thousands of files in .devforge/notes cannot make each of
 * them look at all its files. Only the notes the folder would show are looked at.
 */
let shop: string
const notesDir = () => join(shop, '.devforge', 'notes')
const OPEN = '---\ntitle: Tâches\npinned: false\n---\n<ul data-checklist>\n<li data-checked="false">DNS</li>\n</ul>\n'

beforeEach(() => {
  shop = tempDir('shop')
  saveProjects([{ name: 'shop', path: shop }])
  rmSync(join(userData(), 'project-notes.json'), { force: true })
  mkdirSync(notesDir(), { recursive: true })
})

const lstats = () => vi.mocked(fs.lstatSync).mock.calls.filter(([p]) => String(p).startsWith(notesDir())).length

describe('the open boxes of a crowded notes folder', () => {
  it('files that cannot be notes are not looked at', () => {
    writeFileSync(join(notesDir(), 'taches.md'), OPEN)
    // Upper case, a dot, too long: no note has such a name
    for (let i = 0; i < 1500; i++) writeFileSync(join(notesDir(), `Bad-${i}.md`), OPEN)
    vi.mocked(fs.lstatSync).mockClear()
    expect(openCounts()).toEqual({ p0: 1 })
    expect(lstats()).toBeLessThan(10)
  })

  it('past MAX_NOTES, the others are not looked at either', () => {
    for (let i = 0; i < MAX_NOTES + 1500; i++) writeFileSync(join(notesDir(), `n-${i}.md`), OPEN)
    vi.mocked(fs.lstatSync).mockClear()
    expect(openCounts()).toEqual({ p0: MAX_NOTES })
    // A few looks per note it reads (its stamp, then the read itself), whatever the folder holds beyond
    expect(lstats()).toBeLessThanOrEqual(MAX_NOTES * 3 + 5)
  })
})
