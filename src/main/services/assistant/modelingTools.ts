import type { DiagramKind, DiagramModel, ModelFile, MpdModel, Project } from '@shared/types'
import { checkMcd, MODEL_FILE_RE } from '@shared/lib/mcd'
import { mcdFromSpec, McdSpecError } from '@shared/lib/mcdSpec'
import { mpdFromSpec } from '@shared/lib/mpdSpec'
import { diagramFromSpec } from '@shared/lib/diagramSpec'
import { checkMpd, mpdSql, sqlType, toMld } from '@shared/lib/mpd'
import { caseLinks, DIAGRAM_KINDS, isDiagramKind } from '@shared/lib/uml'
import { createModel, listModels, projectEngine, readModel, saveModel } from '../modeling/models'
import { modelFromDatabase, removeModels } from '../modeling/fromDatabase'
import { listDbConnections } from '../database/dbStorage'
import { getProjectHub } from '../projects/projectHub'
import { ToolError } from './assistantTools'

/**
 * v3.9 lot 6: Forgy reads the Modeling page's models — the list, and one model
 * as text: an MCD with its MLD and the rules applied, an MPD with its SQL, a
 * diagram's parts and links. Read only.
 */

/** The connections linked to a project (its Database tab), by name */
async function linkedDatabases(p: Project): Promise<{ id: string; name: string; type: string }[]> {
  const ids = (await getProjectHub(p.id).catch(() => null))?.databases.map(d => d.id) ?? []
  return listDbConnections().filter(c => ids.includes(c.id)).map(c => ({ id: c.id, name: c.name, type: c.type }))
}

export async function modelsText(p: Project): Promise<string> {
  const list = listModels(p.path)
  const dbs = await linkedDatabases(p)
  const linked = dbs.length ? `Linked database(s): ${dbs.map(d => `"${d.name}" (${d.type})`).join(', ')} — create_model with source "database" reads one.` : 'No database linked to this project.'
  if (!list.length) return `${p.name} has no model yet (Modeling page; files in conception/).\n${linked}`
  return [`Models of ${p.name} (conception/):`, ...list.map(m => {
    const what = m.mcd ? `${m.mcd.entities.length} entities, ${m.mcd.associations.length} associations`
      : m.mpd ? `${m.mpd.tables.length} tables, ${m.mpd.engine}${m.mpd.connection ? ', linked to a database' : ''}${m.sqlAt ? `, SQL written ${m.sqlAt.slice(0, 10)}` : ''}`
      : m.diagram ? `${m.diagram.nodes.length} parts, ${m.diagram.edges.length} links` : ''
    return `- ${m.file} · ${m.kind} · "${m.name}" · ${what} · updated ${m.updatedAt.slice(0, 10)}`
  }), linked].join('\n')
}

// ─── v4.1: Forgy makes a model ────────────────────────────────────────────────

export type ModelsUndo = { type: 'models-remove'; path: string; files: string[] }

/** A wrong description, in words the model can fix */
function described<T>(make: () => T): T {
  try { return make() } catch (err) {
    if (err instanceof McdSpecError) throw new ToolError(err.message)
    throw err
  }
}

const KIND_NAMES: Record<DiagramKind, string> = { usecase: 'use case', class: 'class', sequence: 'sequence', flow: 'flowchart', architecture: 'architecture' }

/**
 * A model made by Forgy: an MCD read from the project's database (and its
 * MPD, linked to it), or drawn from a description it worked out with the
 * user; v4.2: an MPD (its tables) or a diagram (its parts and links)
 * described the same way. Nothing is written before the click; the undo
 * removes the files made.
 */
export async function createModelPlan(p: Project, input: Record<string, unknown>): Promise<{
  title: string; preview: string; run: () => Promise<{ output: string; undo: ModelsUndo }>
}> {
  const name = typeof input.name === 'string' && input.name.trim() ? input.name.trim().slice(0, 120) : p.name
  const kind = input.kind === undefined ? 'mcd' : String(input.kind)
  if (kind !== 'mcd' && kind !== 'mpd' && !isDiagramKind(kind)) throw new ToolError(`"kind" must be mcd, mpd or a diagram: ${DIAGRAM_KINDS.join(', ')}`)
  if (input.source === 'database' && isDiagramKind(kind)) throw new ToolError('A diagram is drawn from a description: source "description"')
  if (input.source === 'database') {
    const dbs = await linkedDatabases(p)
    const all = listDbConnections()
    const ref = typeof input.connection === 'string' ? input.connection.trim().toLowerCase() : ''
    const conn = ref ? all.find(c => c.name.toLowerCase() === ref || c.id === input.connection) : dbs[0] && all.find(c => c.id === dbs[0].id)
    if (!conn) throw new ToolError(ref ? `Unknown connection "${input.connection}" (db_connections lists them)` : `${p.name} has no linked database: give "connection" (db_connections), or use source "description"`)
    return {
      title: `Create an MCD from the database · ${p.name}`,
      preview: `Read "${conn.name}" (${conn.type}): its tables become an MCD, and an MPD linked to the database.\nconception/ of ${p.name}, named "${name}"`,
      run: async () => {
        const r = await modelFromDatabase(p.path, conn.id, name)
        return { output: `${r.tables} tables read: conception/${r.mcd} and conception/${r.mpd}`, undo: { type: 'models-remove', path: p.path, files: [r.mcd, r.mpd] } }
      }
    }
  }
  if (input.source !== 'description') throw new ToolError('"source" must be "database" or "description"')
  if (kind === 'mpd') return mpdPlan(p, name, described(() => mpdFromSpec({ tables: input.tables }, projectEngine(p.path))))
  if (isDiagramKind(kind)) return diagramPlan(p, name, kind, described(() => diagramFromSpec(kind, { nodes: input.nodes, links: input.links })))
  const mcd = described(() => mcdFromSpec({ entities: input.entities, associations: input.associations }))
  const entity = (id: string) => mcd.entities.find(e => e.id === id)?.name ?? '?'
  return {
    title: `Create an MCD · ${p.name}`,
    preview: [
      `"${name}" in conception/ of ${p.name}`,
      ...mcd.entities.map(e => `■ ${e.name} (${e.attributes.map(a => `${a.identifier ? '#' : ''}${a.name}${a.type ? `: ${a.type}` : ''}`).join(', ')})`),
      ...mcd.associations.map(a => `◇ ${a.name}: ${mcd.links.filter(l => l.association === a.id).map(l => `${entity(l.entity)} ${l.card}`).join(' — ')}`)
    ].join('\n').slice(0, 4000),
    run: async () => {
      const file = createModel(p.path, 'mcd', name)
      saveModel(p.path, file, { v: 1, kind: 'mcd', name, updatedAt: '', mcd })
      return { output: `conception/${file}: ${mcd.entities.length} entities, ${mcd.associations.length} associations`, undo: { type: 'models-remove', path: p.path, files: [file] } }
    }
  }
}

/** An MPD drawn from its tables: written as a new model, on the project's engine */
function mpdPlan(p: Project, name: string, mpd: MpdModel) {
  const table = (id: string) => mpd.tables.find(t => t.id === id)?.name ?? '?'
  return {
    title: `Create an MPD · ${p.name}`,
    preview: [
      `"${name}" in conception/ of ${p.name}, for ${mpd.engine}`,
      ...mpd.tables.map(t => `▦ ${t.name} (${t.columns.map(c => `${c.pk ? '#' : ''}${c.name} ${sqlType(c, mpd.engine)}${c.ref ? ` → ${table(c.ref.table)}` : ''}`).join(', ')})`)
    ].join('\n').slice(0, 4000),
    run: async () => {
      const file = createModel(p.path, 'mpd', name)
      saveModel(p.path, file, { v: 1, kind: 'mpd', name, updatedAt: '', mpd })
      return { output: `conception/${file}: ${mpd.tables.length} tables`, undo: { type: 'models-remove' as const, path: p.path, files: [file] } }
    }
  }
}

/** A diagram drawn from its parts and links */
function diagramPlan(p: Project, name: string, kind: DiagramKind, diagram: DiagramModel) {
  const part = (id: string) => diagram.nodes.find(n => n.id === id)?.name ?? '?'
  return {
    title: `Create a ${KIND_NAMES[kind]} diagram · ${p.name}`,
    preview: [
      `"${name}" in conception/ of ${p.name}`,
      ...diagram.nodes.map(n => `■ ${n.type} ${n.name}${n.attributes?.length ? ` (${n.attributes.join(', ')})` : ''}`),
      ...diagram.edges.map(e => `→ ${e.type}: ${part(e.from)} → ${part(e.to)}${e.label ? ` "${e.label}"` : ''}`)
    ].join('\n').slice(0, 4000),
    run: async () => {
      const file = createModel(p.path, kind, name)
      saveModel(p.path, file, { v: 1, kind, name, updatedAt: '', diagram })
      return { output: `conception/${file}: ${diagram.nodes.length} parts, ${diagram.edges.length} links`, undo: { type: 'models-remove' as const, path: p.path, files: [file] } }
    }
  }
}

export function undoModels(u: ModelsUndo): string {
  const removed = removeModels(u.path, u.files)
  return removed.length ? `Removed ${removed.map(f => `conception/${f}`).join(', ')}` : 'Already removed'
}

export function modelText(p: Project, file: unknown): string {
  if (typeof file !== 'string' || !MODEL_FILE_RE.test(file)) throw new ToolError('Give "file", a model file name from project_models (e.g. boutique.mcd.json)')
  let m: ModelFile
  try { m = readModel(p.path, file) } catch { throw new ToolError(`No model ${file} in ${p.name}`) }
  const out = [`${m.kind.toUpperCase()} "${m.name}" (conception/${file})`]
  if (m.mcd) {
    const mcd = m.mcd
    const name = (id: string) => mcd.entities.find(x => x.id === id)?.name ?? '?'
    out.push('', 'Entities:', ...mcd.entities.map(e => `- ${e.name} (${e.attributes.map(a => `${a.identifier ? '*' : ''}${a.name}${a.type ? `: ${a.type}${a.length ? `(${a.length})` : ''}` : ''}`).join(', ')})`))
    out.push('', 'Associations (entity cardinality):', ...mcd.associations.map(a =>
      `- ${a.name}: ${mcd.links.filter(l => l.association === a.id).map(l => `${name(l.entity)} ${l.card}`).join(' — ')}${a.attributes.length ? ` · carries ${a.attributes.map(x => x.name).join(', ')}` : ''}`))
    const mld = toMld(mcd)
    out.push('', 'MLD (* primary key, # foreign key):', ...mld.relations.map(r => `${r.name.toUpperCase()} (${r.columns.map(c => `${c.pk ? '*' : ''}${c.fk ? '#' : ''}${c.name}`).join(', ')})`))
    out.push('', 'Rules applied:', ...mld.rules.map(r => `- ${JSON.stringify(r)}`))
    const issues = checkMcd(mcd)
    out.push('', issues.length ? `Check: ${issues.map(i => `${i.level} ${i.code} ${i.name}`).join('; ')}` : 'Check: nothing to report')
  }
  if (m.mpd) {
    const mpd = m.mpd
    out.push(`Engine ${mpd.engine}${mpd.source ? ` · made from ${mpd.source}` : ''}${mpd.connection ? ' · linked to a database connection' : ''}`, '', 'Tables:')
    for (const t of mpd.tables) out.push(`- ${t.name}: ${t.columns.map(c => `${c.pk ? '*' : ''}${c.name} ${sqlType(c, mpd.engine)}${c.nullable && !c.pk ? '' : ' NOT NULL'}${c.ref ? ` → ${mpd.tables.find(x => x.id === c.ref!.table)?.name ?? '?'}` : ''}`).join(', ')}`)
    const issues = checkMpd(mpd)
    out.push('', issues.length ? `Check: ${issues.map(i => `${i.level} ${i.code} ${i.name}`).join('; ')}` : 'Check: nothing to report', '', 'SQL:', mpdSql(mpd))
  }
  if (m.diagram) {
    const d = m.diagram
    const name = (id: string) => d.nodes.find(n => n.id === id)?.name ?? '?'
    out.push('', 'Parts:', ...d.nodes.map(n => {
      const extra = n.type === 'case' && m.kind === 'usecase' as DiagramKind
        ? (() => { const l = caseLinks(d, n.id); return `${l.actors.length ? ` · actors ${l.actors.join(', ')}` : ''}${l.includes.length ? ` · includes ${l.includes.join(', ')}` : ''}${l.extendedBy.length ? ` · extended by ${l.extendedBy.join(', ')}` : ''}${n.steps?.length ? `\n  scenario: ${n.steps.map((s, i) => `${i + 1}. ${s}`).join(' ')}` : ''}` })()
        : `${n.attributes?.length ? ` · ${n.attributes.join('; ')}` : ''}${n.methods?.length ? ` · ${n.methods.join('; ')}` : ''}`
      return `- ${n.type} "${n.name}"${extra}`
    }))
    const links = [...d.edges].sort((a, b) => (a.y ?? 0) - (b.y ?? 0))
    out.push('', 'Links:', ...links.map(e => `- ${e.type}: ${name(e.from)} → ${name(e.to)}${e.label ? ` "${e.label}"` : ''}`))
    if (d.notes.length) out.push('', 'Notes:', ...d.notes.map(n => `- ${n.text}`))
  }
  return out.join('\n')
}
