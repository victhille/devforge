import { describe, expect, it } from 'vitest'
import { levelOf } from '@renderer/features/logs/logLevel'

describe('levelOf', () => {
  it.each([
    ['[2026-01-01] ERROR something broke', 'error'],
    ['Traceback (most recent call last):', 'error'],
    ['WARNING: deprecated option', 'warn'],
    ['INFO server started', 'info'],
    ['DEBUG cache hit', 'debug'],
    ['plain line', 'other'],
    ['{"level":50,"msg":"boom"}', 'error'],
    ['{"level":"warn","msg":"x"}', 'warn'],
    ['{"severity":"INFO"}', 'info']
  ])('%s', (line, level) => {
    expect(levelOf(line)).toBe(level)
  })
})
