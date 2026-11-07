import type { DbConnection, Project } from '@shared/types'
import { useLive } from '@renderer/lib/live'

/** v4.2: the saved projects, the same list for every page; read again when one is added, changed or removed */
export const useProjectList = () => useLive<Project[]>('projects', () => window.devforge.getProjects(), { topic: 'projects' })

/** v4.2: the database connections, the same list for every page; read again when one is saved or removed */
export const useDbConnections = () => useLive<DbConnection[]>('db-connections', () => window.devforge.db.list(), { topic: 'db-connections' })

/** An empty list that stays the same between renders (for effects that depend on it) */
export const NO_CONNECTIONS: DbConnection[] = []
export const NO_PROJECTS: Project[] = []
