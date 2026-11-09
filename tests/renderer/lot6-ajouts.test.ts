import { describe, expect, it } from 'vitest'
import { computeDiff } from '@renderer/features/tools/diff/diff'
import { sortKeys } from '@renderer/features/tools/toolbox/lib/json'
import { generateSecret, laravelAppKey, secretBits } from '@renderer/features/tools/generator/random'
import { isRegenerable } from '@shared/lib/envKeys'

/** Lot 6: the additions of the mock-up on the Tools and .env pages */
describe('diff without whitespace', () => {
  it('lines that differ only by spaces stay equal, shown as in the modified text', () => {
    const a = 'services:\n  web:\n    image: node:20 \n    ports: [3000]'
    const b = 'services:\n    web:\n    image:  node:20\n    ports: [3000, 9229]'
    expect(computeDiff(a, b, { ignoreWhitespace: true })).toEqual([
      { type: 'equal', text: 'services:' },
      { type: 'equal', text: '    web:' },
      { type: 'equal', text: '    image:  node:20' },
      { type: 'remove', text: '    ports: [3000]' },
      { type: 'add', text: '    ports: [3000, 9229]' }
    ])
  })

  it('counts the spaces when not asked to ignore them', () => {
    expect(computeDiff('a \nb', 'a\nb').filter(l => l.type !== 'equal')).toHaveLength(2)
  })
})

describe('JSON keys in order', () => {
  it('sorts every object, deep, and keeps the order of arrays', () => {
    const value = { statut: 'ok', client: { ville: 'Nantes', nom: 'Ada' }, lignes: [{ qte: 1, produit: 'Lampe' }, 2] }
    expect(JSON.stringify(sortKeys(value))).toBe('{"client":{"nom":"Ada","ville":"Nantes"},"lignes":[{"produit":"Lampe","qte":1},2],"statut":"ok"}')
    expect(sortKeys(null)).toBeNull()
    expect(sortKeys('texte')).toBe('texte')
  })
})

describe('app secrets', () => {
  it("Laravel's APP_KEY: base64: then 32 bytes, padded", () => {
    const key = laravelAppKey()
    expect(key).toMatch(/^base64:[A-Za-z0-9+/]{43}=$/)
    expect(atob(key.slice(7))).toHaveLength(32)
  })

  it('URL-safe base64 has neither +, / nor =', () => {
    for (let i = 0; i < 20; i++) expect(generateSecret(33, 'base64', { urlSafe: true })).toMatch(/^[A-Za-z0-9_-]{44}$/)
  })

  it('tells the bits of randomness', () => {
    expect(secretBits(32, 'hex')).toBe(256)
    expect(secretBits(32, 'base64')).toBe(256)
    expect(secretBits(32, 'alpha')).toBe(165)
  })

  it('offers to regenerate only the secrets the app draws itself', () => {
    for (const k of ['APP_KEY', 'SESSION_SECRET', 'JWT_SECRET', 'NEXTAUTH_SECRET', 'SECRET_KEY', 'app_secret']) expect(isRegenerable(k)).toBe(true)
    // Given by a service, or an encryption key whose data would be lost
    for (const k of ['STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET', 'GITHUB_CLIENT_SECRET', 'SUPABASE_JWT_SECRET', 'ENCRYPTION_KEY', 'STRIPE_KEY', 'DATABASE_URL', 'API_TOKEN', 'MAIL_PASSWORD', 'SECRETARY']) {
      expect(isRegenerable(k)).toBe(false)
    }
  })
})
