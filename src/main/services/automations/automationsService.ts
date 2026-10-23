import { existsSync } from 'fs'
import { join } from 'path'
import { DatabaseSync } from 'node:sqlite'
import { app, shell } from 'electron'
import type { AutomationsAutomation, AutomationsFeed, AutomationsGravity, AutomationsItem } from '@shared/types'

/**
 * Automations's feed (the results of the n8n automations), read from the SQLite
 * cache Automations keeps on this PC. Opened read-only, never written: Automations is
 * its only writer (its outbox holds actions waiting to be sent). node:sqlite
 * rather than sql.js: the cache is in WAL mode and sql.js would miss the
 * newest pages of the journal.
 */

/** Same grouping as Automations's Automations screen */
export const AUTOMATIONS: { key: string; types: string[] }[] = [
  { key: 'briefing', types: ['briefing'] },
  { key: 'mail', types: ['mail', 'mail_digest'] },
  { key: 'connexion', types: ['connexion'] },
  { key: 'deals', types: ['bons_plans', 'deal', 'jeux', 'jeu', 'ecrans'] },
  { key: 'expenses', types: ['depenses', 'depense_alerte'] },
  { key: 'subscriptions', types: ['abonnements', 'abonnement_alerte'] },
  { key: 'birthdays', types: ['anniversaire'] }
]

const GRAVITIES: AutomationsGravity[] = ['info', 'attention', 'urgent']

/** Where Automations keeps its data and where its installer puts it (overridable for tests) */
export const paths = () => ({
  db: process.env.DEVFORGE_TEST_AUTOMATIONS_DB ?? join(app.getPath('appData'), 'Automations', 'automations.db'),
  exe: join(process.env.LOCALAPPDATA ?? join(app.getPath('home'), 'AppData', 'Local'), 'Programs', 'Automations', 'Automations.exe')
})

interface Row { uid: string; type: string; titre: string; gravite: string; lu: number; date: string; updated_at: string | null }

const toItem = (r: Row): AutomationsItem => ({
  uid: String(r.uid), type: String(r.type), titre: String(r.titre ?? ''),
  gravite: GRAVITIES.includes(r.gravite as AutomationsGravity) ? r.gravite as AutomationsGravity : 'info',
  lu: Number(r.lu) === 1, date: String(r.date ?? '')
})

/** Rows of `items` → automations, unread items */
export function summarize(rows: Row[]): Pick<AutomationsFeed, 'automations' | 'unread' | 'updatedAt'> {
  const items = rows.map(r => ({ item: toItem(r), updatedAt: r.updated_at ?? r.date }))
  const automations: AutomationsAutomation[] = AUTOMATIONS.map(a => {
    const mine = items.filter(i => a.types.includes(i.item.type))
    const last = mine.slice().sort((x, y) => y.item.date.localeCompare(x.item.date))[0]?.item ?? null
    return { key: a.key, types: a.types, last, unread: mine.filter(i => !i.item.lu).length }
  })
  // A type this version does not know still counts
  const known = new Set(AUTOMATIONS.flatMap(a => a.types))
  const others = items.filter(i => !known.has(i.item.type))
  if (others.length) {
    const last = others.slice().sort((x, y) => y.item.date.localeCompare(x.item.date))[0]!.item
    automations.push({ key: 'other', types: [...new Set(others.map(i => i.item.type))], last, unread: others.filter(i => !i.item.lu).length })
  }
  const unread = items.filter(i => !i.item.lu).map(i => i.item).sort((x, y) => y.date.localeCompare(x.date)).slice(0, 20)
  const updatedAt = items.map(i => i.updatedAt).filter(Boolean).sort().pop() ?? null
  return { automations, unread, updatedAt }
}

export function readFeed(): AutomationsFeed {
  const p = paths()
  const installed = existsSync(p.exe)
  if (!existsSync(p.db)) return { found: false, installed, automations: [], unread: [], updatedAt: null }
  const db = new DatabaseSync(p.db, { readOnly: true })
  try {
    // Automations writes at any moment: wait a little rather than fail on its lock
    db.exec('PRAGMA busy_timeout = 2000')
    const rows = db.prepare('SELECT uid, type, titre, gravite, lu, date, updated_at FROM items').all() as unknown as Row[]
    return { found: true, installed, ...summarize(rows) }
  } finally {
    db.close()
  }
}

export async function openAutomations(): Promise<void> {
  const { exe } = paths()
  if (!existsSync(exe)) throw new Error('AUTOMATIONS_MISSING')
  // A second start brings the running window to the front (single instance)
  const err = await shell.openPath(exe)
  if (err) throw new Error(err)
}
