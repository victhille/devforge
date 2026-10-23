import { readFileSync } from 'fs'
import { app } from 'electron'

/**
 * End-to-end tests of the VPS pages: DEVFORGE_TEST_VPS names a JSON file of
 * canned server outputs ({ "services": "...", "health": "..." }). Ignored in
 * the installed app.
 */
export function testOutput(name: 'services' | 'health' | 'backupCandidates' | 'backupState'): string | null {
  const file = process.env.DEVFORGE_TEST_VPS
  if (!file || app.isPackaged) return null
  try { return (JSON.parse(readFileSync(file, 'utf-8')) as Record<string, string>)[name] ?? null } catch { return null }
}
