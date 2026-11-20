import { existsSync, mkdirSync, readFileSync, rmSync } from 'fs'
import { join, parse } from 'path'
import { describe, expect, it } from 'vitest'
import { saveProjects, tempDir, userData } from '../helpers'

const storage = await import('../../src/main/services/projects/projectStorage')

/** Projects whose folder is gone leave the list on their own, and can come back */
describe('projects whose folder is gone', () => {
  it('tells a folder really gone from one out of reach', () => {
    const here = tempDir('here')
    expect(storage.isGone(here)).toBe(false)
    // Deleted or moved: its disk is there
    expect(storage.isGone(join(here, 'moved-away'))).toBe(true)
    // A network share may be offline for a while
    expect(storage.isGone('\\\\nas\\projets\\shop')).toBe(false)
    expect(storage.isGone('//nas/projets/shop')).toBe(false)
    expect(storage.isGone('')).toBe(false)
    // A drive that is not plugged in keeps its projects
    const free = ['Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z'].find(l => !existsSync(`${l}:\\`))
    if (process.platform === 'win32' && free) expect(storage.isGone(`${free}:\\Dev\\shop`)).toBe(false)
    expect(parse(here).root).not.toBe('')
  })

  it('takes them out, keeps the others, and puts them back on Undo', () => {
    const kept = tempDir('kept')
    const gone = join(tempDir('base'), 'gone')
    const usb = process.platform === 'win32' ? 'Q:\\usb\\app' : null
    saveProjects([{ name: 'kept', path: kept }, { name: 'gone', path: gone }, ...(usb && !existsSync('Q:\\') ? [{ name: 'usb', path: usb }] : [])])

    const pruned = storage.pruneMissing()
    expect(pruned.map(p => p.name)).toEqual(['gone'])
    expect(storage.loadProjects().map(p => p.name)).not.toContain('gone')
    expect(storage.loadProjects().map(p => p.name)).toContain('kept')
    // Nothing on disk is touched: the kept folder is still there
    expect(existsSync(kept)).toBe(true)
    // Twice: nothing more to take out
    expect(storage.pruneMissing()).toEqual([])

    // Undo: back in the list, once
    mkdirSync(gone, { recursive: true })
    expect(storage.restorePruned().map(p => p.name)).toEqual(['gone'])
    expect(storage.loadProjects().filter(p => p.name === 'gone')).toHaveLength(1)
    expect(storage.restorePruned()).toEqual([])
    expect(JSON.parse(readFileSync(join(userData(), 'projects-pruned.json'), 'utf-8'))).toEqual([])
  })

  it('keeps every project taken out until Undo, even after a second clean-up', () => {
    const base = tempDir('two')
    saveProjects([
      { name: 'a', path: join(base, 'a') },
      { name: 'b', path: join(base, 'b') }
    ])
    // The start takes out "a"; "b" comes back for a while, then goes too (Rescan)
    mkdirSync(join(base, 'b'))
    expect(storage.pruneMissing().map(p => p.name)).toEqual(['a'])
    rmSync(join(base, 'b'), { recursive: true })
    expect(storage.pruneMissing().map(p => p.name)).toEqual(['b'])
    expect(
      storage
        .restorePruned()
        .map(p => p.name)
        .sort()
    ).toEqual(['a', 'b'])
  })
})
