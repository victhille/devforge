import { readFileSync } from 'fs'
import { app } from 'electron'

/**
 * End-to-end tests of the VPS pages: DEVFORGE_TEST_VPS names a JSON file of
 * canned server outputs ({ "services": "...", "health": "..." }). Ignored in
 * the installed app.
 */
function canned(): Record<string, unknown> | null {
  const file = process.env.DEVFORGE_TEST_VPS
  if (!file || app.isPackaged) return null
  try { return JSON.parse(readFileSync(file, 'utf-8')) as Record<string, unknown> } catch { return null }
}

export function testOutput(name: 'services' | 'health' | 'backupCandidates' | 'backupState' | 'statusPrecheck' | 'statusOverview' | 'n8nStatus' | 'vpnDetect'): string | null {
  const v = canned()?.[name]
  return typeof v === 'string' ? v : null
}

/**
 * A canned answer of the n8n or wg-easy API: { "n8nApi": { "GET /workflows": {...} } },
 * the path without its query. Only in end-to-end tests, as above.
 */
export function testApi(name: 'n8nApi' | 'vpnApi', method: string, path: string): unknown {
  const answers = canned()?.[name]
  if (!answers || typeof answers !== 'object') return undefined
  return (answers as Record<string, unknown>)[`${method} ${path.split('?')[0]}`]
}
