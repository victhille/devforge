import { ipcMain } from 'electron'
import type { LauncherToMain } from '@shared/types'
import { hide, launcherState, toMain } from '../launcher'

/** Only these, with plain strings: the launcher cannot make the main window do anything else */
function clean(m: unknown): LauncherToMain | null {
  const x = (m ?? {}) as Record<string, unknown>
  const s = (v: unknown) => typeof v === 'string' ? v : ''
  if (x.kind === 'navigate' && s(x.path).startsWith('/')) return { kind: 'navigate', path: s(x.path) }
  if (x.kind === 'ask' && s(x.text).trim()) return { kind: 'ask', text: s(x.text).slice(0, 4000) }
  if (x.kind === 'script' && s(x.projectPath) && s(x.script) && ['npm', 'pnpm', 'yarn'].includes(s(x.pm))) {
    return { kind: 'script', projectPath: s(x.projectPath), script: s(x.script), pm: x.pm as 'npm' | 'pnpm' | 'yarn', name: s(x.name) }
  }
  return null
}

export function registerLauncherHandlers(): void {
  ipcMain.handle('launcher:hide', () => hide())
  ipcMain.handle('launcher:to-main', (_e, m: unknown) => { const msg = clean(m); if (msg) toMain(msg) })
  ipcMain.handle('launcher:state', () => launcherState())
}
