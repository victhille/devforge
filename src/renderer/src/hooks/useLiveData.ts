import type { AppSettings, DbConnection, Project, SSHConnection, UserTemplate } from '@shared/types'
import type { IdeInfo } from '@shared/data/ides'
import { setLive, useLive } from '@renderer/lib/live'

/** v4.2: the saved projects, the same list for every page; read again when one is added, changed or removed */
export const useProjectList = () => useLive<Project[]>('projects', () => window.devforge.getProjects(), { topic: 'projects' })

/** v4.2: the database connections, the same list for every page; read again when one is saved or removed */
export const useDbConnections = () => useLive<DbConnection[]>('db-connections', () => window.devforge.db.list(), { topic: 'db-connections' })

/** The boxes left to check in each project's notes; read again when a note changes (a page, Forgy, the Modeling page) */
export const NOTE_COUNTS = 'notes-counts'
export const useNoteCounts = () => useLive<Record<string, number>>(NOTE_COUNTS, () => window.devforge.notes.counts(), { topic: 'notes' })

/** An empty list that stays the same between renders (for effects that depend on it) */
export const NO_CONNECTIONS: DbConnection[] = []
export const NO_PROJECTS: Project[] = []

/** The settings, one copy for every page (and window): shown at once when a page comes back, read again when saved anywhere */
export const SETTINGS = 'settings'
export const useSettings = () => useLive<AppSettings>(SETTINGS, () => window.devforge.getSettings(), { topic: 'settings' })

/** A part of the settings written apart (favorites, Home's widgets): shown at once, before the main process confirms it */
export function patchSettings(patch: Partial<AppSettings>): void {
  setLive<AppSettings>(SETTINGS, s => (s ? { ...s, ...patch } : (s as unknown as AppSettings)))
}

/** Settings changed here: every page shows them at once, then they are written (the main process tells the other windows) */
export async function saveSettings(next: AppSettings): Promise<void> {
  setLive<AppSettings>(SETTINGS, () => next)
  await window.devforge.saveSettings(next)
}

/** The SSH servers, one list for every page; read again when one is added, changed or removed */
export const SSH_CONNECTIONS = 'ssh-connections'
export const useSshConnections = () => useLive<SSHConnection[]>(SSH_CONNECTIONS, () => window.devforge.getSshConnections(), { topic: 'ssh' })
export const NO_SERVERS: SSHConnection[] = []

/** The project templates (New project, Settings › Templates), one list */
export const TEMPLATES = 'templates'
export const useTemplates = () => useLive<UserTemplate[]>(TEMPLATES, () => window.devforge.templates.list(), { topic: 'templates' })

/** The IDEs found on this PC: a scan, kept five minutes (Settings › General looks again on the disk and writes it here) */
export const IDES = 'ides'
export const useIdes = () => useLive<IdeInfo[]>(IDES, () => window.devforge.listIdes(false), { freshMs: 5 * 60_000 })
