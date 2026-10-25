/**
 * Going back on a Prisma migration (v2.3 lot 3). Prisma has no "down"
 * migration: DevForge writes one. `prisma migrate diff` compares the database
 * with the migrations minus the last one, replayed in a shadow database, and
 * gives the SQL that undoes it. The schema goes back with Git. Pure helpers
 * here; the service runs Prisma.
 */

/** The shadow database's URL: same server, the database's name + _devforge_shadow */
export function shadowUrl(url: string, provider: string): string | null {
  if (provider === 'sqlite') return 'file:./devforge-shadow.db'
  const m = url.match(/^([a-z]+:\/\/[^/]+\/)([^/?#]+)(.*)$/i)
  return m ? `${m[1]}${m[2]}_devforge_shadow${m[3]}` : null
}

/** Name of the database in a URL, for CREATE and DROP DATABASE (letters, digits, _ and -) */
export function databaseName(url: string): string | null {
  const name = url.match(/^[a-z]+:\/\/[^/]+\/([^/?#]+)/i)?.[1]
  return name && /^[\w-]+$/.test(name) ? name : null
}

const quoteDb = (name: string, provider: string) => provider === 'mysql' ? `\`${name}\`` : `"${name}"`
export const createDatabaseSql = (name: string, provider: string) => `CREATE DATABASE ${quoteDb(name, provider)};\n`
export const dropDatabaseSql = (name: string, provider: string) => `DROP DATABASE IF EXISTS ${quoteDb(name, provider)};\n`

/** A Prisma 7 config next to the project's, with the shadow database (read from the environment) */
export function revertConfig(projectConfig: string): string {
  const from = './' + projectConfig.replace(/\.(ts|mts|js|mjs)$/, '')
  return `// Written by DevForge for a moment, while it prepares the undoing of a migration; then removed.
import base from '${from}'

export default { ...base, datasource: { ...base.datasource, shadowDatabaseUrl: process.env.DEVFORGE_SHADOW_URL } }
`
}

/** The project's Prisma config file, if any (prisma.config.ts, prisma7.config.ts…) */
export const findConfig = (files: string[]) => files.find(f => /^prisma\d*\.config\.(ts|mts|js|mjs)$/.test(f)) ?? null

/** "20261025181601_catalogue" → "20261026093000_revert_catalogue" */
export const revertFolder = (migration: string, stamp: string) => `${stamp}_revert_${migration.replace(/^\d{14}_/, '')}`.slice(0, 80)

/** "20261026093000" from a date (Prisma's migration stamps, local time) */
export function prismaStamp(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`
}

/** The SQL of `migrate diff --script`, without Prisma's own lines around it */
export function cleanDiff(out: string): string {
  const lines = out.split(/\r?\n/).filter(l => !/^(Loaded Prisma config|Prisma schema loaded|Environment variables loaded|warn |┌|│|└)/.test(l))
  const sql = lines.join('\n').trim()
  return /^-- This is an empty migration\.?$/.test(sql) ? '' : sql
}

export function revertMigration(migration: string, sql: string): string {
  return `-- Written by DevForge: undoes ${migration}.\n-- Read it before "Apply": dropped tables and columns lose their data.\n\n${sql}\n`
}
