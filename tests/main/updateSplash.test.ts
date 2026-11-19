import { describe, expect, it } from 'vitest'
import { splashPage } from '../../src/main/services/updates/splash'

/** The window shown after an update, while DevForge opens again */
describe('update splash', () => {
  it('says the update is installed, in the language of DevForge, with its version', () => {
    const fr = splashPage('0.3.0', true)
    expect(fr).toContain('Mise à jour installée')
    expect(fr).toContain('v0.3.0')
    expect(fr).toContain('lang="fr"')
    expect(splashPage('0.3.0', false)).toContain('Update installed')
  })

  it('runs nothing: no script, and a policy that allows none', () => {
    const page = splashPage('0.3.0', true)
    expect(page).not.toMatch(/<script/i)
    expect(page).toContain("default-src 'none'")
  })
})
