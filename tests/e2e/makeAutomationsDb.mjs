// Run by Node (Playwright's loader cannot load node:sqlite): node makeAutomationsDb.mjs <path> '<rows json>'
import process from 'node:process'
import { DatabaseSync } from 'node:sqlite'

const [path, json] = process.argv.slice(2)
const db = new DatabaseSync(path)
db.exec('PRAGMA journal_mode = WAL')
db.exec('CREATE TABLE items (uid TEXT PRIMARY KEY, type TEXT, titre TEXT, gravite TEXT, contenu TEXT, lu INTEGER, date TEXT, updated_at TEXT, alerted_at TEXT, received_at TEXT)')
const ins = db.prepare('INSERT INTO items (uid, type, titre, gravite, contenu, lu, date, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
for (const r of JSON.parse(json)) ins.run(r.uid, r.type, r.titre, r.gravite, '{"v":1}', r.lu, r.date, r.date)
db.close()
