import { describe, expect, it } from 'vitest'
import {
  BASE64_ENCODED, BASE64_TEXT, DIFF_EXAMPLE, JSON_EXAMPLE, REGEX_MODELS, URL_EXAMPLE, WEBHOOK_EXAMPLE, WEBHOOK_EXAMPLE_TARGET, jwtExample
} from '@renderer/features/tools/examples'

/** v3.5 lot 4: the tools' examples work in their tool, and point nowhere real */
describe('v3.5: tool examples', () => {
  it('gives each regex model matches, and leaves out what it must not match', () => {
    const found = (m: keyof typeof REGEX_MODELS) => [...REGEX_MODELS[m].text.matchAll(new RegExp(REGEX_MODELS[m].pattern, REGEX_MODELS[m].flags))].map(x => x[0])
    expect(found('email')).toEqual(['ada@example.invalid', 'support+dev@devforge.invalid'])
    expect(found('date')).toEqual(['28/10/2026', '02/11/2026'])
    expect(found('url')).toEqual(['https://docs.example.invalid/start', 'http://localhost:5173'])
    expect(found('phone')).toEqual(['06 12 34 56 78', '+33 1 23 45 67 89'])
  })

  it('has a JWT the tool decodes, valid JSON, and a Base64 pair that match', () => {
    const [header, payload] = jwtExample().split('.').slice(0, 2).map(p => JSON.parse(atob(p.replace(/-/g, '+').replace(/_/g, '/'))))
    expect(header).toEqual({ alg: 'HS256', typ: 'JWT' })
    expect(payload.name).toBe('Ada Lovelace')
    expect(() => JSON.parse(JSON_EXAMPLE)).not.toThrow()
    expect(new TextDecoder().decode(Uint8Array.from(atob(BASE64_ENCODED), c => c.charCodeAt(0)))).toBe(BASE64_TEXT)
    expect(DIFF_EXAMPLE.left).not.toBe(DIFF_EXAMPLE.right)
  })

  it('sends nothing for real: every outside address ends in .invalid', () => {
    for (const url of [URL_EXAMPLE, WEBHOOK_EXAMPLE_TARGET]) expect(new URL(url).hostname).toMatch(/\.invalid$/)
    expect(() => JSON.parse(WEBHOOK_EXAMPLE.body)).not.toThrow()
  })
})
