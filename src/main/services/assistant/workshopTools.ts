import { BrowserWindow } from 'electron'
import { existsSync, readFileSync } from 'fs'
import { join } from 'path'
import type { Project, SfEntity, SfEntityDraft, SfField, SfFieldType, SfMigration, SfRelation, SfRelationKind } from '@shared/types'
import { inspect as symfonyInspect, isSymfony } from '../symfony/symfonyService'
import { inspect as nextInspect } from '../nextjs/nextService'
import { inspect as laravelInspect } from '../laravel/laravelService'
import { checkDraft } from '../symfony/sfEntityWriter'
import { ToolError } from './assistantTools'

/**
 * Forgy and the workshops (Symfony, Laravel, Next.js): it reads the models,
 * and prepares a new one in the workshop's form. Nothing is written until
 * the user clicks there.
 */

export type Workshop = 'symfony' | 'laravel' | 'nextjs'
const LABEL: Record<Workshop, string> = { symfony: 'Symfony (Doctrine entities)', laravel: 'Laravel (Eloquent models)', nextjs: 'Next.js (Prisma models)' }

const FIELD_TYPES: SfFieldType[] = ['string', 'text', 'integer', 'float', 'decimal', 'boolean', 'date', 'datetime', 'json']
const KINDS: SfRelationKind[] = ['ManyToOne', 'OneToMany', 'ManyToMany', 'OneToOne']

const readJson = (file: string): Record<string, Record<string, string> | undefined> => {
  try { return JSON.parse(readFileSync(file, 'utf-8')) } catch { return {} }
}

/** Which workshop a project has */
export function workshopOf(p: Project): Workshop {
  if (isSymfony(p.path)) return 'symfony'
  if (readJson(join(p.path, 'composer.json')).require?.['laravel/framework']) return 'laravel'
  const pkg = readJson(join(p.path, 'package.json'))
  if ((pkg.dependencies?.next || pkg.devDependencies?.next) && existsSync(join(p.path, 'prisma', 'schema.prisma'))) return 'nextjs'
  throw new ToolError(`${p.name} has no workshop: Symfony, Laravel, or Next.js with Prisma (prisma/schema.prisma)`)
}

async function read(p: Project, w: Workshop): Promise<{ head: string; entities: SfEntity[]; migrations: SfMigration[]; down: string | null }> {
  if (w === 'symfony') {
    const { status, entities, migrations } = await symfonyInspect(p.path)
    return { head: `Symfony ${status.version} · database ${status.database?.reachable ? 'reachable' : 'NOT reachable'}`, entities, migrations, down: status.booted ? null : `Symfony does not start: ${status.error ?? 'unknown error'}` }
  }
  if (w === 'laravel') {
    const { status, entities, migrations } = await laravelInspect(p.path)
    return { head: `Laravel ${status.version ?? '?'}${status.sail ? ' (Sail)' : ''} · database ${status.database.reachable ? 'reachable' : 'NOT reachable'}`, entities, migrations, down: status.booted || status.error === 'SAIL_DOWN' ? null : `Laravel does not start: ${status.error ?? 'unknown error'}` }
  }
  const { status, entities, migrations } = await nextInspect(p.path)
  return { head: `Next.js · Prisma ${status.prismaVersion ?? '?'} (${status.provider ?? '?'}) · database ${status.database.reachable ? 'reachable' : 'NOT reachable'}`, entities, migrations, down: null }
}

export async function workshopModelsText(p: Project): Promise<string> {
  const w = workshopOf(p)
  const { head, entities, migrations, down } = await read(p, w)
  if (down) return down
  const pending = migrations.filter(m => !m.executed)
  return [
    `${LABEL[w]} · ${head} · ${pending.length} pending migration(s)`,
    ...entities.map(e => [
      `${e.name} (${e.file}${e.apiResource ? ', API Platform' : ''})`,
      ...e.fields.map(f => `  ${f.name}: ${f.type}${f.nullable ? '' : ', required'}${f.unique ? ', unique' : ''}`),
      ...e.relations.map(r => `  ${r.name}: ${r.kind} → ${r.target}${r.inverse ? ` (other side: ${r.inverse})` : ''}`)
    ].join('\n')),
    // What applying would run, so it can be explained first
    ...pending.map(m => `Pending migration ${m.version}${m.dangerous ? ' (DROPS DATA)' : ''}:\n${m.sql.join(';\n').slice(0, 3000) || '(no SQL known)'}`)
  ].join('\n') || 'No model.'
}

function field(v: unknown): SfField {
  const f = (v ?? {}) as Record<string, unknown>
  const type = FIELD_TYPES.includes(f.type as SfFieldType) ? f.type as SfFieldType : 'string'
  return {
    name: String(f.name ?? ''), type, nullable: f.required === false, unique: f.unique === true,
    ...(type === 'string' && Number(f.length) > 0 ? { length: Number(f.length) } : {})
  }
}

function relation(v: unknown): SfRelation {
  const r = (v ?? {}) as Record<string, unknown>
  const kind = KINDS.includes(r.kind as SfRelationKind) ? r.kind as SfRelationKind : 'ManyToOne'
  return { name: String(r.name ?? ''), kind, target: String(r.target ?? ''), inverse: typeof r.inverse === 'string' && r.inverse ? r.inverse : null, nullable: r.required === false }
}

/** Checks the draft like the workshop would, then opens the form filled in */
export async function workshopDraft(p: Project, input: Record<string, unknown>): Promise<string> {
  const w = workshopOf(p)
  const { entities } = await read(p, w)
  const names = entities.map(e => e.name)
  const name = String(input.entity ?? '')
  const draft: SfEntityDraft = {
    name, existing: names.includes(name),
    fields: Array.isArray(input.fields) ? input.fields.map(field) : [],
    relations: Array.isArray(input.relations) ? input.relations.map(relation) : []
  }
  const error = checkDraft(draft, names)
  if (error) throw new ToolError(`The draft is not valid (${error}). Models: ${names.join(', ') || 'none'}. Names: model PascalCase, fields camelCase, not "id".`)
  for (const win of BrowserWindow.getAllWindows()) if (!win.isDestroyed()) win.webContents.send('symfony:draft', { projectId: p.id, projectPath: p.path, tab: w, draft })
  return `The ${draft.existing ? `additions to ${name}` : `new model ${name}`} are filled in the ${LABEL[w].split(' ')[0]} workshop of ${p.name}. Nothing is written yet: the user checks the form and clicks to create it, then prepares the migration.`
}
