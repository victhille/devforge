import { describe, expect, it } from 'vitest'
import { formatDuration, formatSize } from '@renderer/lib/format'
import { dockerSince } from '@renderer/features/ssh/vps/stats'

describe('formatSize', () => {
  it('picks a readable unit, in English', () => {
    expect(formatSize(null, 'en')).toBe('—')
    expect(formatSize(0, 'en')).toBe('0 B')
    expect(formatSize(512, 'en')).toBe('512 B')
    expect(formatSize(2048, 'en')).toBe('2.0 KB')
    expect(formatSize(5 * 1024 * 1024, 'en')).toBe('5.0 MB')
    expect(formatSize(1.25 * 1024 * 1024, 'en')).toBe('1.3 MB')
    expect(formatSize(3 * 1024 ** 3, 'en')).toBe('3.00 GB')
    expect(formatSize(1500 * 1024 ** 3, 'en')).toBe('1500.00 GB')
  })

  it('writes French units with a decimal comma', () => {
    expect(formatSize(undefined, 'fr')).toBe('—')
    expect(formatSize(512, 'fr')).toBe('512 o')
    expect(formatSize(2048, 'fr')).toBe('2,0 Ko')
    expect(formatSize(1.2 * 1024 * 1024, 'fr')).toBe('1,2 Mo')
    expect(formatSize(3.5 * 1024 ** 3, 'fr')).toBe('3,50 Go')
    expect(formatSize(1500 * 1024 ** 3, 'fr')).toBe('1500,00 Go')
  })
})

describe('formatDuration', () => {
  it('uses the short unit of the language', () => {
    expect(formatDuration(23, 'day', 'fr')).toBe('23 j')
    expect(formatDuration(23, 'day', 'en')).toBe('23 d')
    expect(formatDuration(18, 'hour', 'fr')).toBe('18 h')
    expect(formatDuration(2, 'week', 'fr')).toBe('2 sem.')
  })
})

describe('dockerSince', () => {
  it('turns the Docker status into a short duration', () => {
    expect(dockerSince('Up 23 days', 'fr')).toBe('23 j')
    expect(dockerSince('Up 18 hours (healthy)', 'fr')).toBe('18 h')
    expect(dockerSince('Up 23 days', 'en')).toBe('23 d')
    expect(dockerSince('Up About an hour', 'fr')).toBe('1 h')
    expect(dockerSince('Up About a minute', 'en')).toBe('1 min')
    expect(dockerSince('Up Less than a second', 'fr')).toBe('< 1 s')
    expect(dockerSince('Up 2 weeks (Paused)', 'fr')).toBe('2 sem.')
    expect(dockerSince('Up 3 months', 'fr')).toBe('3 mois')
    expect(dockerSince('Up 2 years', 'en')).toBe('2 yr')
  })

  it('counts a stopped container from when it stopped', () => {
    expect(dockerSince('Exited (0) 2 hours ago', 'fr')).toBe('2 h')
    expect(dockerSince('Exited (137) 5 seconds ago', 'en')).toBe('5 s')
    expect(dockerSince('Restarting (1) 30 seconds ago', 'fr')).toBe('30 s')
  })

  it('gives nothing for a status without a duration', () => {
    expect(dockerSince('Created', 'fr')).toBeNull()
    expect(dockerSince('Up', 'fr')).toBeNull()
  })
})
