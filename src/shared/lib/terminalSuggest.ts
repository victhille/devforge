import type { PackageManager } from '../types'

/**
 * v3.5 lot 6: the likely rest of a terminal line, shown greyed after the
 * caret (like fish). From, in order: the project's scripts, its history
 * (latest first), then the Docs page's commands. Pure and cheap: it runs on
 * every keystroke, over lists already in memory.
 */

/** A package.json script as typed in a terminal */
export function scriptCommand(pm: PackageManager, name: string): string {
  return pm === 'npm' ? `npm run ${name}` : `${pm} ${name}`
}

export interface SuggestSources {
  /** Script commands first (npm run dev…) */
  scripts: string[]
  /** The project's history, oldest first (as stored) */
  history: string[]
  /** The docs' commands; those with a <placeholder> are left out */
  docs: string[]
}

/** The rest to show after `typed`, or '' (nothing typed, or nothing longer that starts with it) */
export function suggestRest(typed: string, sources: SuggestSources): string {
  if (!typed.trim()) return ''
  const lower = typed.toLowerCase()
  const candidates = [...sources.scripts, ...[...sources.history].reverse(), ...sources.docs.filter(c => !c.includes('<'))]
  const hit = candidates.find(c => c.length > typed.length && c.toLowerCase().startsWith(lower))
  return hit ? hit.slice(typed.length) : ''
}
