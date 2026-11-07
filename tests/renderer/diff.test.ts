import { describe, expect, it } from 'vitest'
import { computeDiff } from '@renderer/features/tools/diff/diff'

describe('computeDiff', () => {
  it('marks added, removed and unchanged lines', () => {
    expect(computeDiff('a\nb\nc', 'a\nc\nd')).toEqual([
      { type: 'equal', text: 'a' },
      { type: 'remove', text: 'b' },
      { type: 'equal', text: 'c' },
      { type: 'add', text: 'd' }
    ])
  })

  it('handles identical texts', () => {
    expect(computeDiff('x\ny', 'x\ny').every(l => l.type === 'equal')).toBe(true)
  })

  it('keeps every line of both sides', () => {
    const d = computeDiff('1\n2\n3', '0\n2\n4\n5')
    expect(d.filter(l => l.type !== 'add').map(l => l.text)).toEqual(['1', '2', '3'])
    expect(d.filter(l => l.type !== 'remove').map(l => l.text)).toEqual(['0', '2', '4', '5'])
  })
})
