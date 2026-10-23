import { join } from 'path'
import { afterEach, describe, expect, it } from 'vitest'
import { tempDir } from '../helpers'
import { makeAutomationsDb, SAMPLE } from '../automationsDb'
import { openAutomations, readFeed } from '../../src/main/services/automations/automationsService'
import { runTool } from '../../src/main/services/assistant/assistantTools'

describe('Automations feed', () => {
  afterEach(() => { delete process.env.DEVFORGE_TEST_AUTOMATIONS_DB })

  it('groups the items by automation, reads the WAL, counts unread ones', () => {
    const db = join(tempDir('lh'), 'automations.db')
    makeAutomationsDb(db, SAMPLE)
    process.env.DEVFORGE_TEST_AUTOMATIONS_DB = db
    const f = readFeed()
    expect(f.found).toBe(true)
    const by = Object.fromEntries(f.automations.map(a => [a.key, a]))
    expect(by.briefing).toMatchObject({ unread: 0, last: { titre: 'Briefing du 23 octobre' } })
    expect(by.mail).toMatchObject({ unread: 1, last: { gravite: 'attention' } })
    expect(by.subscriptions).toMatchObject({ unread: 1, last: { type: 'abonnement_alerte' } })
    expect(by.birthdays).toMatchObject({ unread: 0, last: null })
    // A type this version does not know is not lost; an odd gravity reads as info
    expect(by.other).toMatchObject({ types: ['meteo'], unread: 1, last: { gravite: 'info' } })
    expect(f.unread.map(x => x.uid)).toEqual(['mail:1', 'abonnement:netflix', 'x:1'])
    expect(f.updatedAt).toBe('2026-10-23T07:00:00.000Z')
  })

  it('says when there is no cache, and Forgy reads titles only', async () => {
    process.env.DEVFORGE_TEST_AUTOMATIONS_DB = join(tempDir('lh'), 'missing.db')
    expect(readFeed()).toMatchObject({ found: false, automations: [], unread: [] })
    expect(await runTool('automations_feed', {})).toMatch(/not installed|received nothing/)

    const db = join(tempDir('lh'), 'automations.db')
    makeAutomationsDb(db, SAMPLE)
    process.env.DEVFORGE_TEST_AUTOMATIONS_DB = db
    const text = await runTool('automations_feed', {})
    expect(text).toContain('- mail (mail, mail_digest): 1 unread, last "Facture EDF" [attention]')
    expect(text).toContain('[urgent] abonnement_alerte: "Netflix se renouvelle dans 3 jours"')
    expect(text).not.toContain('{"v":1}')
  })

  it('cannot open Automations when it is not installed', async () => {
    const prev = process.env.LOCALAPPDATA
    process.env.LOCALAPPDATA = tempDir('nolh')
    await expect(openAutomations()).rejects.toThrow('AUTOMATIONS_MISSING')
    process.env.LOCALAPPDATA = prev
  })
})
