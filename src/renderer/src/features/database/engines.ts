import type { DbType } from '@shared/types'

/** « SQLite », « PostgreSQL », « MySQL »: the engine as people name it */
export const ENGINE_NAME: Record<DbType, string> = { sqlite: 'SQLite', postgres: 'PostgreSQL', mysql: 'MySQL' }
