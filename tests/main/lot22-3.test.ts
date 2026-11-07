import { describe, expect, it } from 'vitest'
import { calculate, quickAnswers } from '../../src/shared/lib/launcherTools'
import { rankEntries, recordUse } from '../../src/shared/lib/launcherRank'

describe('v2.2 lot 3: launcher quick answers', () => {
  it('calculates without eval, with precedence, powers and commas', () => {
    expect(calculate('2+3*4')).toBe(14)
    expect(calculate('(2+3)*4')).toBe(20)
    expect(calculate('2^3^2')).toBe(512)
    expect(calculate('-3 + 1,5')).toBe(-1.5)
    expect(calculate('12 × 4,5')).toBe(54)
    expect(calculate('10 % 3')).toBe(1)
    expect(calculate('1/0')).toBeNull()
    expect(calculate('alert(1)')).toBeNull()
    expect(calculate('2+')).toBeNull()
    expect(quickAnswers('0.1+0.2')[0]).toEqual({ kind: 'calc', value: '0.3', detail: '0.1+0.2' })
    expect(quickAnswers('42')).toEqual([])
  })

  it('timestamps and dates', () => {
    const now = new Date('2026-10-25T14:00:00Z')
    expect(quickAnswers('now', now)[0]).toMatchObject({ kind: 'timestamp', value: '1792936800' })
    expect(quickAnswers('1792936800')[0]).toMatchObject({ kind: 'date', detail: '2026-10-25T14:00:00.000Z' })
    expect(quickAnswers('1792936800000')[0]).toMatchObject({ kind: 'date', detail: '2026-10-25T14:00:00.000Z' })
    expect(quickAnswers('2026-10-25')[0].kind).toBe('timestamp')
  })

  it('base64 both ways, readable text only', () => {
    expect(quickAnswers('b64 héllo')[0]).toEqual({ kind: 'base64', value: 'aMOpbGxv', detail: 'base64' })
    expect(quickAnswers('aMOpbGxv')[0]).toMatchObject({ kind: 'base64', value: 'héllo' })
    expect(quickAnswers('unb64 aMOpbGxv')[0].value).toBe('héllo')
    expect(quickAnswers('AAAAAAAA')).toEqual([])
  })

  it('colors', () => {
    expect(quickAnswers('#5B9BFF').map(a => a.value)).toEqual(['rgb(91, 155, 255)', 'hsl(217, 100%, 68%)'])
    expect(quickAnswers('#fff')[0].value).toBe('rgb(255, 255, 255)')
    expect(quickAnswers('rgb(91, 155, 255)')[0].value).toBe('#5B9BFF')
    expect(quickAnswers('rgb(300, 0, 0)')).toEqual([])
  })
})

describe('v2.2 lot 3: launcher ranking', () => {
  const entries = [
    { id: 'page:/docker', title: 'Docker', keywords: 'conteneurs' },
    { id: 'proj:code:1', title: 'Ouvrir dans VS Code — boutique', keywords: 'symfony' },
    { id: 'proj:code:2', title: 'Ouvrir dans VS Code — site', keywords: 'nextjs' }
  ]

  it('matches every word, accents ignored', () => {
    expect(rankEntries(entries, 'vs bout', {}, 0).map(e => e.id)).toEqual(['proj:code:1'])
    expect(rankEntries(entries, 'conteneur', {}, 0).map(e => e.id)).toEqual(['page:/docker'])
    expect(rankEntries(entries, 'zzz', {}, 0)).toEqual([])
  })

  it('what is used often and lately comes first', () => {
    const now = 1_800_000_000_000
    let usage = recordUse({}, 'proj:code:2', now - 60_000)
    usage = recordUse(usage, 'proj:code:2', now - 30_000)
    expect(rankEntries(entries, 'vs', usage, now).map(e => e.id)).toEqual(['proj:code:2', 'proj:code:1'])
    // Empty query: only what was used, most used first
    expect(rankEntries(entries, '', recordUse(usage, 'page:/docker', now - 10 * 86_400_000), now).map(e => e.id)).toEqual(['proj:code:2', 'page:/docker'])
  })
})
