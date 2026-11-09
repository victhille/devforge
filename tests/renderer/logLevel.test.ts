import { describe, expect, it } from 'vitest'
import { levelOf, splitLine } from '@renderer/features/logs/logLevel'

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

describe('splitLine', () => {
  it.each([
    ['[2026-11-06 22:41:09] local.ERROR: SQLSTATE[23000]', '22:41:09', 'SQLSTATE[23000]'],
    ['2026-11-06T22:41:09.123Z INFO started', '22:41:09', 'started'],
    ['22:40:58 DEBUG cache hit', '22:40:58', 'cache hit'],
    ['2026-11-06 22:41:09,512+01:00 [main] WARN slow', '22:41:09', '[main] WARN slow'],
    ['#0 app/Services/Numerotation.php(41): Facture::create()', null, '#0 app/Services/Numerotation.php(41): Facture::create()'],
    ['{"level":50,"time":1700000000}', null, '{"level":50,"time":1700000000}'],
    ['request took 12:30:00 to finish', null, 'request took 12:30:00 to finish']
  ])('%s', (line, time, message) => {
    expect(splitLine(line)).toEqual({ time, message })
  })
})
