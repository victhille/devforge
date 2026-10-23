import { DatabaseSync } from 'node:sqlite'

/** A Automations-like cache (same `items` table, WAL mode) for the tests */
export function makeAutomationsDb(path: string, rows: { uid: string; type: string; titre: string; gravite: string; lu: 0 | 1; date: string }[]): void {
  const db = new DatabaseSync(path)
  db.exec('PRAGMA journal_mode = WAL')
  db.exec('CREATE TABLE items (uid TEXT PRIMARY KEY, type TEXT, titre TEXT, gravite TEXT, contenu TEXT, lu INTEGER, date TEXT, updated_at TEXT, alerted_at TEXT, received_at TEXT)')
  const ins = db.prepare('INSERT INTO items (uid, type, titre, gravite, contenu, lu, date, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
  for (const r of rows) (ins as unknown as { run: (...a: unknown[]) => void }).run(r.uid, r.type, r.titre, r.gravite, '{"v":1}', r.lu, r.date, r.date)
  ;(db as unknown as { close: () => void }).close()
}

export const SAMPLE = [
  { uid: 'briefing:2026-10-23', type: 'briefing', titre: 'Briefing du 23 octobre', gravite: 'info', lu: 1 as const, date: '2026-10-23T04:30:00.000Z' },
  { uid: 'briefing:2026-10-22', type: 'briefing', titre: 'Briefing du 22 octobre', gravite: 'info', lu: 1 as const, date: '2026-10-22T04:30:00.000Z' },
  { uid: 'mail:1', type: 'mail', titre: 'Facture EDF', gravite: 'attention', lu: 0 as const, date: '2026-10-23T07:00:00.000Z' },
  { uid: 'abonnement:netflix', type: 'abonnement_alerte', titre: 'Netflix se renouvelle dans 3 jours', gravite: 'urgent', lu: 0 as const, date: '2026-10-23T06:00:00.000Z' },
  { uid: 'x:1', type: 'meteo', titre: 'Type inconnu', gravite: 'bizarre', lu: 0 as const, date: '2026-10-21T06:00:00.000Z' }
]
