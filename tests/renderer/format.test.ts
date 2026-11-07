import { describe, expect, it } from 'vitest'
import { formatSize } from '@renderer/lib/format'

describe('formatSize', () => {
  it('picks a readable unit', () => {
    expect(formatSize(null)).toBe('—')
    expect(formatSize(512)).toBe('512 B')
    expect(formatSize(2048)).toBe('2.0 KB')
    expect(formatSize(5 * 1024 * 1024)).toBe('5.0 MB')
    expect(formatSize(3 * 1024 ** 3)).toBe('3.00 GB')
  })
})
