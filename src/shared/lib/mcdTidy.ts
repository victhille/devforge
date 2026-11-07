import type { DbDiagramLink, DbDiagramTable } from '../types/database'
import type { Cardinality, McdModel, MpdModel } from '../types/modeling'
import { associationBox, entityBox, noteBox, type Box, type Point } from './mcd'
import { snake } from './mpd'
import { autoLayout } from './schemaLayout'

/**
 * v4.1: an MCD made tidy. Each part where it can be read (none on another),
 * one name per element, the tables a framework keeps for itself left out,
 * an entity whose key points at another one linked to it. The editor shows
 * the result before the user keeps it or not; an import is laid out the same.
 */

/** Tables a framework creates for itself: not part of the domain */
export const FRAMEWORK_TABLES = new Set([
  'doctrine_migration_versions', 'messenger_messages', 'migrations', '_prisma_migrations',
  'failed_jobs', 'job_batches', 'password_reset_tokens', 'password_resets', 'personal_access_tokens', 'cache_locks'
])
export const isFrameworkTable = (name: string) => FRAMEWORK_TABLES.has(name.toLowerCase())

const GAP = 16
const hit = (a: Box, b: Box, m = 0) => a.x < b.x + b.w + m && b.x < a.x + a.w + m && a.y < b.y + b.h + m && b.y < a.y + a.h + m
const mid = (b: Box): Point => ({ x: b.x + b.w / 2, y: b.y + b.h / 2 })

/** Pairs of parts drawn one on another (entities and associations), by name */
export function overlaps(m: McdModel): [string, string][] {
  const boxes = [...m.entities.map(e => ({ id: e.id, name: e.name, box: entityBox(e) })), ...m.associations.map(a => ({ id: a.id, name: a.name, box: associationBox(a) }))]
  const out: [string, string][] = []
  for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) if (hit(boxes[i].box, boxes[j].box)) out.push([boxes[i].name, boxes[j].name])
  return out
}

/**
 * The middle of the nearest spot to `want` where a box of this size touches
 * none of `taken`: rings around it, wider and wider. The editor puts a new
 * association there too.
 */
export function freeSpot(taken: Box[], want: Point, w: number, h: number): Point {
  const fits = (p: Point) => !taken.some(b => hit({ x: p.x - w / 2, y: p.y - h / 2, w, h }, b, GAP))
  if (fits(want)) return want
  for (let r = 14; r < 4000; r += 14) {
    const steps = Math.max(12, Math.round(r / 6))
    for (let s = 0; s < steps; s++) {
      const t = (s / steps) * Math.PI * 2
      const p = { x: Math.round(want.x + Math.cos(t) * r), y: Math.round(want.y + Math.sin(t) * r * 0.75) }
      if (fits(p)) return p
    }
  }
  return want
}

/**
 * Entities in columns (each one right of what it points at), wide gaps
 * between them, then each association at the nearest free spot from the
 * middle of its entities, and the notes where nothing is.
 */
export function layoutMcd(m: McdModel): McdModel {
  const tables: DbDiagramTable[] = m.entities.map(e => ({
    name: e.id, schema: '', type: 'table',
    columns: e.attributes.map(a => ({ name: a.name, type: a.type || 'text', nullable: !a.identifier, pk: !!a.identifier }))
  }))
  const links: DbDiagramLink[] = []
  for (const a of m.associations) {
    const legs = m.links.filter(l => l.association === a.id)
    // The side that holds the key (1,1 or 0,1) points at the others
    const child = legs.find(l => l.card === '1,1' || l.card === '0,1') ?? legs[0]
    for (const l of legs) if (child && l.entity !== child.entity) links.push({ from: { name: child.entity, schema: '' }, columns: ['k'], to: { name: l.entity, schema: '' }, refColumns: ['k'] })
  }
  const pos = autoLayout(tables, links)

  // A column longer than ROWS (everything around one central entity) goes on in a column beside it, the next ones further right
  const ROWS = 7
  const byId = new Map(m.entities.map(e => [e.id, e]))
  const columns = new Map<number, string[]>()
  for (const e of m.entities) { const x = pos[`.${e.id}`]?.x ?? 0; columns.set(x, [...(columns.get(x) ?? []), e.id]) }
  const spot = new Map<string, Point>()
  let shift = 0
  for (const x of [...columns.keys()].sort((a, b) => a - b)) {
    const ids = columns.get(x)!.sort((a, b) => (pos[`.${a}`]?.y ?? 0) - (pos[`.${b}`]?.y ?? 0))
    const step = Math.max(...ids.map(id => entityBox(byId.get(id)!).w)) + 200
    ids.forEach((id, i) => spot.set(id, { x: x + shift + Math.floor(i / ROWS) * step, y: pos[`.${ids[i % ROWS]}`]?.y ?? 0 }))
    shift += (Math.ceil(ids.length / ROWS) - 1) * step
  }

  // Room between the columns for the associations, between the rows for the legs
  let entities = m.entities.map(e => ({ ...e, x: Math.round((spot.get(e.id)?.x ?? 0) * 1.7), y: Math.round((spot.get(e.id)?.y ?? 0) * 1.35) }))
  // The entities linked to nothing: in a row just under the others
  const alone = new Set(m.entities.filter(e => !m.links.some(l => l.entity === e.id)).map(e => e.id))
  const rest = entities.filter(e => !alone.has(e.id))
  if (alone.size && rest.length) {
    let x = Math.min(...rest.map(e => e.x))
    const y = Math.max(...rest.map(e => e.y + entityBox(e).h)) + 120
    entities = entities.map(e => {
      if (!alone.has(e.id)) return e
      const placed = { ...e, x, y }
      x += entityBox(e).w + 60
      return placed
    })
  }
  // Two entities that still touch: the lower one goes down
  entities = [...entities].sort((a, b) => a.y - b.y || a.x - b.x)
  for (let i = 0; i < entities.length; i++) {
    for (let j = 0; j < i; j++) {
      const a = entityBox(entities[j]), b = entityBox(entities[i])
      if (hit(a, b, GAP * 2)) entities[i] = { ...entities[i], y: a.y + a.h + GAP * 3 }
    }
  }

  const taken: Box[] = entities.map(entityBox)
  const at = new Map(entities.map(e => [e.id, entityBox(e)]))
  const free = (want: Point, w: number, h: number) => freeSpot(taken, want, w, h)

  // The associations with the most legs first: they have the least choice
  const order = [...m.associations].sort((a, b) => m.links.filter(l => l.association === b.id).length - m.links.filter(l => l.association === a.id).length)
  const placed = new Map<string, Point>()
  for (const a of order) {
    const boxes = m.links.filter(l => l.association === a.id).map(l => at.get(l.entity)).filter((b): b is Box => !!b)
    const size = associationBox(a)
    const ends = [...new Set(boxes)]
    let want: Point
    if (!ends.length) want = { x: a.x, y: a.y }
    else if (ends.length === 1) want = { x: ends[0].x + ends[0].w + 70 + size.w / 2, y: mid(ends[0]).y } // on itself: beside it
    else want = { x: ends.reduce((s, b) => s + mid(b).x, 0) / ends.length, y: ends.reduce((s, b) => s + mid(b).y, 0) / ends.length }
    const p = free(want, size.w, size.h)
    taken.push({ x: p.x - size.w / 2, y: p.y - size.h / 2, w: size.w, h: size.h })
    placed.set(a.id, { x: Math.round(p.x - size.w / 2), y: Math.round(p.y - size.h / 2) })
  }
  const associations = m.associations.map(a => ({ ...a, ...placed.get(a.id)! }))

  const notes = m.notes.map(n => {
    const b = noteBox(n)
    const p = free(mid(b), b.w, b.h)
    taken.push({ x: p.x - b.w / 2, y: p.y - b.h / 2, w: b.w, h: b.h })
    return { ...n, x: Math.round(p.x - b.w / 2), y: Math.round(p.y - b.h / 2) }
  })

  // Starting at the top left
  const all = [...entities.map(entityBox), ...associations.map(associationBox), ...notes.map(noteBox)]
  const dx = 40 - Math.min(...all.map(b => b.x)), dy = 40 - Math.min(...all.map(b => b.y))
  const move = <T extends Point>(p: T): T => ({ ...p, x: p.x + dx, y: p.y + dy })
  return { ...m, entities: entities.map(move), associations: associations.map(move), notes: notes.map(move) }
}

// ── The tidy proposal ────────────────────────────────────────────────────────

export type TidyChange =
  | { code: 'removed'; name: string }
  | { code: 'linked'; name: string; to: string; attribute: string }
  | { code: 'renamed'; name: string; to: string }
  | { code: 'moved'; count: number }

/** What a foreign key column says of its role: requester_id → REQUESTER, id_auteur → AUTEUR */
const roleOf = (column: string) => snake(column.replace(/^id_|_id$/i, '')).toUpperCase()

export function tidyMcd(input: McdModel, mpd?: MpdModel | null): { mcd: McdModel; changes: TidyChange[] } {
  let m: McdModel = structuredClone(input)
  const changes: TidyChange[] = []
  const linked = (id: string) => m.links.some(l => l.entity === id)
  let n = 0
  const fresh = (p: string) => { let id: string; do id = `${p}t${(++n).toString(36)}`; while ([...m.entities, ...m.associations, ...m.links].some(x => x.id === id)); return id }

  // 1. The framework's own tables, when nothing points at them
  for (const e of m.entities.filter(x => isFrameworkTable(x.name) && !linked(x.id))) {
    m = { ...m, entities: m.entities.filter(x => x.id !== e.id) }
    changes.push({ code: 'removed', name: e.name })
  }

  // 2. An entity linked to nothing whose attribute names another entity's key (user_id, id_user): that link, made
  // The names an entity's key goes by elsewhere (user_id, id_user), then its identifiers' names when no other entity has them
  const keyOf = new Map<string, string>()
  for (const e of m.entities) for (const k of [`${snake(e.name)}_id`, `id_${snake(e.name)}`]) keyOf.set(k, keyOf.has(k) && keyOf.get(k) !== e.id ? '' : e.id)
  for (const e of m.entities) for (const a of e.attributes.filter(x => x.identifier)) if (!keyOf.has(snake(a.name))) keyOf.set(snake(a.name), e.id)
  for (const e of [...m.entities]) {
    if (linked(e.id)) continue
    const attr = e.attributes.find(a => { const t = keyOf.get(snake(a.name)); return t && t !== e.id })
    if (!attr) continue
    const parent = m.entities.find(x => x.id === keyOf.get(snake(attr.name)))!
    // Its key was that attribute: one each side (1,1 — 0,1), and an identifier of its own
    const shared = !!attr.identifier
    const attributes = e.attributes.filter(a => a.id !== attr.id)
    if (!attributes.some(a => a.identifier)) attributes.unshift({ id: fresh('a'), name: `id_${snake(e.name)}`, type: 'int', identifier: true })
    const assoc = { id: fresh('s'), name: `${e.name}_${parent.name}`, x: e.x, y: e.y, attributes: [] }
    const legs: { entity: string; card: Cardinality }[] = [{ entity: e.id, card: '1,1' }, { entity: parent.id, card: shared ? '0,1' : '0,n' }]
    m = {
      ...m,
      entities: m.entities.map(x => (x.id === e.id ? { ...x, attributes } : x)),
      associations: [...m.associations, assoc],
      links: [...m.links, ...legs.map(l => ({ id: fresh('l'), association: assoc.id, ...l }))]
    }
    changes.push({ code: 'linked', name: e.name, to: parent.name, attribute: attr.name })
  }

  // 3. One name each: a foreign key's role when the MPD knows it (ACCESS_REQUEST_REVIEWER), else a number
  const nameOf = (id: string) => [...m.entities, ...m.associations].find(x => x.id === id)?.name ?? ''
  const roleName = (assocId: string): string | null => {
    const legs = m.links.filter(l => l.association === assocId)
    const child = legs.find(l => l.card === '1,1' || l.card === '0,1')
    const parent = legs.find(l => l !== child)
    if (!child || !parent || !mpd) return null
    const col = mpd.tables.flatMap(t => t.columns).find(c => c.from?.startsWith(`${parent.id}:`))
    const role = col ? roleOf(col.name) : ''
    return role && role !== snake(nameOf(parent.entity)).toUpperCase() ? `${nameOf(child.entity)}_${role}` : null
  }
  const used = new Map<string, number>()
  for (const x of [...m.entities, ...m.associations]) used.set(x.name.trim().toLowerCase(), (used.get(x.name.trim().toLowerCase()) ?? 0) + 1)
  const names = new Set(m.entities.map(e => e.name.trim().toLowerCase()))
  const renamed = new Map<string, string>()
  for (const a of m.associations) {
    const key = a.name.trim().toLowerCase()
    if ((used.get(key) ?? 0) < 2) { names.add(key); continue }
    let next = roleName(a.id) ?? a.name
    if (names.has(next.toLowerCase())) { let i = 2; while (names.has(`${a.name}_${i}`.toLowerCase())) i++; next = `${a.name}_${i}` }
    names.add(next.toLowerCase())
    if (next !== a.name) { renamed.set(a.id, next); changes.push({ code: 'renamed', name: a.name, to: next }) }
  }
  m = { ...m, associations: m.associations.map(a => (renamed.has(a.id) ? { ...a, name: renamed.get(a.id)! } : a)) }

  // 4. Where each part can be read
  const before = overlaps(m).length
  m = layoutMcd(m)
  if (before) changes.push({ code: 'moved', count: before })
  return { mcd: m, changes }
}
