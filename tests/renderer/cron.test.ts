import { describe, expect, it } from 'vitest'
import { describeCron, nextRuns, parseCron } from '@renderer/features/tools/toolbox/lib/cron'

describe('parseCron', () => {
  it('expands lists, ranges, steps and names', () => {
    const c = parseCron('*/15 9-17 * JAN,MAR MON-FRI')
    expect(c.minute.values).toEqual([0, 15, 30, 45])
    expect(c.hour.values).toEqual([9, 10, 11, 12, 13, 14, 15, 16, 17])
    expect(c.month.values).toEqual([1, 3])
    expect(c.dow.values).toEqual([1, 2, 3, 4, 5])
    expect(c.dom.any).toBe(true)
  })

  it('accepts macros and 7 as Sunday', () => {
    expect(parseCron('@daily').hour.values).toEqual([0])
    expect(parseCron('0 0 * * 7').dow.values).toEqual([0])
  })

  it.each(['* * * *', '61 * * * *', '*/0 * * * *', '5-1 * * * *', 'a * * * *'])('rejects %s', expr => {
    expect(() => parseCron(expr)).toThrow()
  })
})

describe('nextRuns', () => {
  it('finds the next matching minutes', () => {
    const from = new Date(2026, 0, 1, 10, 7)
    const runs = nextRuns(parseCron('*/15 * * * *'), 3, from)
    expect(runs.map(d => `${d.getHours()}:${d.getMinutes()}`)).toEqual(['10:15', '10:30', '10:45'])
  })

  it('matches either day field when both are restricted (standard cron)', () => {
    // 13th of the month OR a Friday
    const runs = nextRuns(parseCron('0 0 13 * 5'), 4, new Date(2026, 0, 1))
    expect(runs.every(d => d.getDate() === 13 || d.getDay() === 5)).toBe(true)
  })
})

describe('describeCron', () => {
  it('reads common schedules in both languages', () => {
    expect(describeCron(parseCron('*/5 * * * *'), 'fr')).toBe('Toutes les 5 minutes')
    expect(describeCron(parseCron('0 9 * * 1-5'), 'en')).toBe('At 09:00, Monday to Friday')
  })
})

describe('day of week 7 (regressions)', () => {
  it('7 alone is Sunday only, ranges ending at 7 keep Sunday', () => {
    expect(parseCron('0 0 * * 7').dow.values).toEqual([0])
    expect(parseCron('0 0 * * 5-7').dow.values).toEqual([0, 5, 6])
    expect(parseCron('0 0 * * *').dow.any).toBe(true)
  })
})
