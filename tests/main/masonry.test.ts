import { describe, expect, it } from 'vitest'
import { masonryPlaces } from '../../src/shared/lib/homeWidgets'

/** The home page's masonry: rows of 4 px, a 16 px gap below each card */
describe('home masonry', () => {
  it('puts each half card in the shorter column, a full one below both', () => {
    // Active project (full), Docker 300, VPS 100, Git 100, Ports 60, Activity (full)
    const p = masonryPlaces(['full', 'half', 'half', 'half', 'half', 'full'], [84, 300, 100, 100, 60, 150])
    expect(p.map(x => x.column)).toEqual(['both', 1, 2, 2, 2, 'both'])
    expect(p[0]).toEqual({ column: 'both', row: 1, span: 25 })
    // Docker and VPS start together under the full card
    expect(p[1].row).toBe(26)
    expect(p[2].row).toBe(26)
    // Git fills the hole under VPS instead of a new row under Docker
    expect(p[3].row).toBe(26 + 29)
    // Activity starts below the taller column
    expect(p[5].row).toBe(Math.max(26 + 79, 26 + 29 + 29 + 19))
  })

  it('left on a tie, a guess for a card not measured yet', () => {
    const p = masonryPlaces(['half', 'half', 'half'], [undefined, undefined, undefined])
    expect(p.map(x => [x.column, x.row])).toEqual([[1, 1], [2, 1], [1, 55]])
  })
})
