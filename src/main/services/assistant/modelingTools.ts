import type { DiagramKind, ModelFile, Project } from '@shared/types'
import { checkMcd, MODEL_FILE_RE } from '@shared/lib/mcd'
import { checkMpd, mpdSql, sqlType, toMld } from '@shared/lib/mpd'
import { caseLinks } from '@shared/lib/uml'
import { listModels, readModel } from '../modeling/models'
import { ToolError } from './assistantTools'

/**
 * v3.9 lot 6: Forgy reads the Modeling page's models — the list, and one model
 * as text: an MCD with its MLD and the rules applied, an MPD with its SQL, a
 * diagram's parts and links. Read only.
 */

export function modelsText(p: Project): string {
  const list = listModels(p.path)
  if (!list.length) return `${p.name} has no model yet (Modeling page; files in conception/).`
  return [`Models of ${p.name} (conception/):`, ...list.map(m => {
    const what = m.mcd ? `${m.mcd.entities.length} entities, ${m.mcd.associations.length} associations`
      : m.mpd ? `${m.mpd.tables.length} tables, ${m.mpd.engine}${m.mpd.connection ? ', linked to a database' : ''}${m.sqlAt ? `, SQL written ${m.sqlAt.slice(0, 10)}` : ''}`
      : m.diagram ? `${m.diagram.nodes.length} parts, ${m.diagram.edges.length} links` : ''
    return `- ${m.file} · ${m.kind} · "${m.name}" · ${what} · updated ${m.updatedAt.slice(0, 10)}`
  })].join('\n')
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
