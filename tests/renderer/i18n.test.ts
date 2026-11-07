import { describe, expect, it } from 'vitest'
import en from '@renderer/i18n/locales/en'
import fr from '@renderer/i18n/locales/fr'

/** Every leaf path of a translation object, e.g. "database.tabBrowse" */
function paths(obj: unknown, prefix = ''): string[] {
  if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) return [prefix]
  return Object.entries(obj).flatMap(([k, v]) => paths(v, prefix ? `${prefix}.${k}` : k))
}

function get(obj: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((o, k) => (o as Record<string, unknown>)?.[k], obj)
}

describe('translations', () => {
  it('French and English have the same keys', () => {
    expect(paths(fr).length).toBeGreaterThan(300)
    const fp = new Set(paths(fr))
    const ep = new Set(paths(en))
    expect([...fp].filter(p => !ep.has(p)), 'missing in en').toEqual([])
    expect([...ep].filter(p => !fp.has(p)), 'missing in fr').toEqual([])
  })

  it('placeholders match between languages', () => {
    const mismatched = paths(fr).filter(p => {
      const a = get(fr, p), b = get(en, p)
      if (typeof a !== 'string' || typeof b !== 'string') return false
      // {s} is a plural mark: French needs it where English may not
      const ph = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map(m => m[1]).filter(n => n !== 's').sort().join()
      return ph(a) !== ph(b)
    })
    expect(mismatched.join(', ')).toBe('')
  })

  it('no empty strings', () => {
    expect(paths(fr).filter(p => get(fr, p) === '')).toEqual([])
    expect(paths(en).filter(p => get(en, p) === '')).toEqual([])
  })
})
