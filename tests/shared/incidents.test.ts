import { describe, expect, it } from 'vitest'
import { formatDowntime, incidentSummary, trackIncidents } from '../../src/shared/lib/incidents'

const DAY = 86_400_000
const at = (ms: number) => new Date(ms).toISOString()
const T0 = Date.parse('2026-11-08T10:00:00.000Z')

describe('trackIncidents', () => {
  it('opens one incident when the URL goes down, closes it when it answers again', () => {
    let list = trackIncidents(undefined, true, at(T0))
    expect(list).toEqual([])
    list = trackIncidents(list, false, at(T0 + 60_000))
    list = trackIncidents(list, false, at(T0 + 120_000))
    expect(list).toEqual([{ start: at(T0 + 60_000), end: null }])
    list = trackIncidents(list, true, at(T0 + 780_000))
    expect(list).toEqual([{ start: at(T0 + 60_000), end: at(T0 + 780_000) }])
  })

  it('drops the incidents ended more than 30 days ago, keeps an open one', () => {
    const old = { start: at(T0 - 40 * DAY), end: at(T0 - 31 * DAY) }
    const recent = { start: at(T0 - 3 * DAY), end: at(T0 - 3 * DAY + 600_000) }
    const open = { start: at(T0 - 45 * DAY), end: null }
    expect(trackIncidents([recent, old], true, at(T0))).toEqual([recent])
    expect(trackIncidents([open], false, at(T0))).toEqual([open])
  })
})

describe('incidentSummary', () => {
  it('counts the incidents of the last 30 days and their downtime, an open one until now', () => {
    const lists = [
      [{ start: at(T0 - 2 * DAY), end: at(T0 - 2 * DAY + 12 * 60_000) }],
      [{ start: at(T0 - 5 * 60_000), end: null }],
      undefined
    ]
    expect(incidentSummary(lists, T0)).toEqual({ count: 2, downMs: 17 * 60_000 })
  })

  it('an incident begun before the 30 days counts only its time inside them', () => {
    const lists = [[{ start: at(T0 - 31 * DAY), end: at(T0 - 30 * DAY + 60_000) }]]
    expect(incidentSummary(lists, T0)).toEqual({ count: 0, downMs: 60_000 })
  })
})

describe('formatDowntime', () => {
  it('minutes, then hours and minutes, then days and hours', () => {
    expect(formatDowntime(12 * 60_000, 'j')).toBe('12 min')
    expect(formatDowntime(125 * 60_000, 'j')).toBe('2 h 05')
    expect(formatDowntime((3 * 24 + 4) * 3_600_000, 'd')).toBe('3 d 4 h')
  })
})

describe('trackIncidents limits', () => {
  it('a URL that flaps every check keeps at most 500 incidents; a list that is not one starts again', () => {
    let list: ReturnType<typeof trackIncidents> = []
    for (let k = 0; k < 1200; k++) list = trackIncidents(list, k % 2 === 1, at(T0 + k * 30_000))
    expect(list).toHaveLength(500)
    expect(trackIncidents('oops' as never, false, at(T0))).toEqual([{ start: at(T0), end: null }])
  })
})
