import { BrowserWindow } from 'electron'
import type { Project, SfEntityDraft, SfField, SfFieldType, SfRelation, SfRelationKind } from '@shared/types'
import { inspect, isSymfony } from '../symfony/symfonyService'
import { checkDraft } from '../symfony/sfEntityWriter'
import { ToolError } from './assistantTools'

/**
 * Forgy and the Symfony workshop: it reads the entities, and prepares a new
 * one in the workshop's form. Nothing is written until the user clicks there.
 */

const FIELD_TYPES: SfFieldType[] = ['string', 'text', 'integer', 'float', 'decimal', 'boolean', 'date', 'datetime', 'json']
const KINDS: SfRelationKind[] = ['ManyToOne', 'OneToMany', 'ManyToMany', 'OneToOne']

function symfonyProject(p: Project): void {
  if (!isSymfony(p.path)) throw new ToolError(`${p.name} is not a Symfony project`)
}

export async function symfonyEntitiesText(p: Project): Promise<string> {
  symfonyProject(p)
  const { status, entities, migrations } = await inspect(p.path)
  if (!status.booted) return `Symfony does not start: ${status.error ?? 'unknown error'}`
  const pending = migrations.filter(m => !m.executed).length
  return [
    `Symfony ${status.version} · database ${status.database?.reachable ? 'reachable' : 'NOT reachable'} · ${pending} pending migration(s)`,
    ...entities.map(e => [
      `${e.name} (${e.file}${e.apiResource ? ', API Platform' : ''})`,
      ...e.fields.map(f => `  ${f.name}: ${f.type}${f.nullable ? '' : ', required'}${f.unique ? ', unique' : ''}`),
      ...e.relations.map(r => `  ${r.name}: ${r.kind} → ${r.target}${r.inverse ? ` (other side: ${r.inverse})` : ''}`)
    ].join('\n'))
  ].join('\n') || 'No entity.'
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
export async function symfonyDraft(p: Project, input: Record<string, unknown>): Promise<string> {
  symfonyProject(p)
  const { entities } = await inspect(p.path)
  const names = entities.map(e => e.name)
  const name = String(input.entity ?? '')
  const draft: SfEntityDraft = {
    name, existing: names.includes(name),
    fields: Array.isArray(input.fields) ? input.fields.map(field) : [],
    relations: Array.isArray(input.relations) ? input.relations.map(relation) : []
  }
  const error = checkDraft(draft, names)
  if (error) throw new ToolError(`The draft is not valid (${error}). Entities: ${names.join(', ') || 'none'}. Names: entity PascalCase, properties camelCase, not "id".`)
  for (const w of BrowserWindow.getAllWindows()) if (!w.isDestroyed()) w.webContents.send('symfony:draft', { projectId: p.id, projectPath: p.path, draft })
  return `The ${draft.existing ? `additions to ${name}` : `new entity ${name}`} are filled in the Symfony workshop of ${p.name}. Nothing is written yet: the user checks the form and clicks to create it, then prepares the migration.`
}
