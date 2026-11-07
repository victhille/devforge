import type { DiagramModel, McdModel, MpdModel, MpdTable } from '../types'
import { uid, type Point } from './mcd'

/**
 * v4.2 lot 2: parts copied, then pasted or duplicated, in an MCD, a diagram
 * or an MPD. The copy gets new ids, keeps the links between the parts copied
 * (only those), and names not already taken.
 */

/**
 * A name nobody has yet: CLIENT, then CLIENT_2, CLIENT_3… (a copy of
 * CLIENT_2 is CLIENT_3, not CLIENT_2_2). `taken` holds the names in upper
 * case; the name given back is added to it.
 */
export function uniqueName(name: string, taken: Set<string>, sep: '_' | ' ' = '_'): string {
  const numbered = /^(.*?)([_ ])(\d+)$/.exec(name)
  const base = numbered && numbered[2] === sep ? numbered[1] : name
  let out = name
  for (let n = 2; taken.has(out.toUpperCase()); n++) out = `${base}${sep}${n}`
  taken.add(out.toUpperCase())
  return out
}

const moved = <T extends { x: number; y: number }>(p: T, by: Point, rowOnly = false): T => ({ ...p, x: p.x + by.x, y: rowOnly ? p.y : p.y + by.y })

// ── MCD ──────────────────────────────────────────────────────────────────────

/** The entities, associations and notes of `ids`, with the legs between them */
export function copyMcd(m: McdModel, ids: Iterable<string>): McdModel {
  const set = new Set(ids)
  return {
    entities: m.entities.filter(x => set.has(x.id)),
    associations: m.associations.filter(x => set.has(x.id)),
    notes: m.notes.filter(x => set.has(x.id)),
    links: m.links.filter(l => set.has(l.entity) && set.has(l.association))
  }
}

/** The copy added, moved by `by`; `ids`: the new parts, to pick */
export function pasteMcd(m: McdModel, copy: McdModel, by: Point): { mcd: McdModel; ids: string[] } {
  const ids = new Map<string, string>()
  const fresh = (old: string, prefix: string) => { const id = uid(prefix); ids.set(old, id); return id }
  const taken = new Set([...m.entities, ...m.associations].map(x => x.name.toUpperCase()))
  const attrs = <T extends { attributes: { id: string }[] }>(x: T): T => ({ ...x, attributes: x.attributes.map(a => ({ ...a, id: uid('a') })) })
  const entities = copy.entities.map(x => attrs(moved({ ...x, id: fresh(x.id, 'e'), name: uniqueName(x.name, taken) }, by)))
  const associations = copy.associations.map(x => attrs(moved({ ...x, id: fresh(x.id, 's'), name: uniqueName(x.name, taken) }, by)))
  const notes = copy.notes.map(x => moved({ ...x, id: fresh(x.id, 't') }, by))
  const links = copy.links.filter(l => ids.has(l.entity) && ids.has(l.association))
    .map(l => ({ ...l, id: uid('l'), entity: ids.get(l.entity)!, association: ids.get(l.association)! }))
  return {
    mcd: { entities: [...m.entities, ...entities], associations: [...m.associations, ...associations], notes: [...m.notes, ...notes], links: [...m.links, ...links] },
    ids: [...entities, ...associations, ...notes].map(x => x.id)
  }
}

// ── Diagrams ─────────────────────────────────────────────────────────────────

/** The parts and notes of `ids`, with the links between them */
export function copyDiagram(d: DiagramModel, ids: Iterable<string>): DiagramModel {
  const set = new Set(ids)
  return {
    nodes: d.nodes.filter(n => set.has(n.id)),
    notes: d.notes.filter(n => set.has(n.id)),
    edges: d.edges.filter(l => set.has(l.from) && set.has(l.to))
  }
}

/** The copy added, moved by `by` (`rowOnly`: a sequence's participants stay in their row); a system goes behind the rest */
export function pasteDiagram(d: DiagramModel, copy: DiagramModel, by: Point, rowOnly = false): { diagram: DiagramModel; ids: string[] } {
  const ids = new Map<string, string>()
  const fresh = (old: string, prefix: string) => { const id = uid(prefix); ids.set(old, id); return id }
  const taken = new Set(d.nodes.map(n => n.name.toUpperCase()))
  const nodes = copy.nodes.map(n => moved({ ...n, id: fresh(n.id, 'n'), name: uniqueName(n.name, taken, ' ') }, by, rowOnly))
  const notes = copy.notes.map(n => moved({ ...n, id: fresh(n.id, 't') }, by))
  const edges = copy.edges.filter(l => ids.has(l.from) && ids.has(l.to)).map(l => ({ ...l, id: uid('l'), from: ids.get(l.from)!, to: ids.get(l.to)! }))
  return {
    diagram: {
      nodes: [...nodes.filter(n => n.type === 'system'), ...d.nodes, ...nodes.filter(n => n.type !== 'system')],
      notes: [...d.notes, ...notes],
      edges: [...d.edges, ...edges]
    },
    ids: [...nodes, ...notes].map(x => x.id)
  }
}

// ── MPD ──────────────────────────────────────────────────────────────────────

/** The tables of `ids` */
export function copyMpd(m: MpdModel, ids: Iterable<string>): MpdTable[] {
  const set = new Set(ids)
  return m.tables.filter(t => set.has(t.id))
}

/**
 * The tables added, moved by `by`. A foreign key to a table copied with it
 * points at the copy; to another table, at that same table. The copies are
 * drawn by hand: no more tie to the MCD.
 */
export function pasteMpd(m: MpdModel, copy: MpdTable[], by: Point): { mpd: MpdModel; ids: string[] } {
  const tableIds = new Map(copy.map(t => [t.id, uid('t')]))
  const columnIds = new Map(copy.flatMap(t => t.columns.map(c => [`${t.id}:${c.id}`, uid('c')] as const)))
  const taken = new Set(m.tables.map(t => t.name.toUpperCase()))
  const tables: MpdTable[] = copy.map(t => {
    const name = uniqueName(t.name, taken)
    const { from: _, ...rest } = t
    return {
      ...moved(rest, by),
      id: tableIds.get(t.id)!,
      name,
      columns: t.columns.map(c => {
        const { from: _f, ...col } = c
        const inside = c.ref && tableIds.has(c.ref.table)
        return {
          ...col, id: columnIds.get(`${t.id}:${c.id}`)!,
          ...(c.ref ? { ref: inside ? { table: tableIds.get(c.ref.table)!, column: columnIds.get(`${c.ref.table}:${c.ref.column}`) ?? c.ref.column } : c.ref } : {})
        }
      }),
      indexes: t.indexes.map(ix => ({
        ...ix, id: uid('i'),
        name: name !== t.name && ix.name.includes(t.name) ? ix.name.replace(t.name, name) : ix.name,
        columns: ix.columns.map(c => columnIds.get(`${t.id}:${c}`) ?? c)
      }))
    }
  })
  return { mpd: { ...m, tables: [...m.tables, ...tables] }, ids: tables.map(t => t.id) }
}
