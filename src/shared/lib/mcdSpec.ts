import type { Cardinality, McdAttribute, McdModel, McdType } from '../types/modeling'
import { CARDINALITIES, MCD_TYPES } from './mcd'
import { snake } from './mpd'
import { layoutMcd } from './mcdTidy'

/**
 * v4.1: an MCD from a description (what Forgy writes from the user's words):
 * entities with their attributes, associations with their legs. Checked, an
 * identifier added where none is given, then laid out like an imported base
 * (each association at a free spot near its entities).
 */

export interface McdSpecAttribute { name: string; type?: string; length?: number; identifier?: boolean }
export interface McdSpec {
  entities: { name: string; attributes?: McdSpecAttribute[] }[]
  associations?: { name: string; legs: { entity: string; card: string }[]; attributes?: McdSpecAttribute[] }[]
}

/** A wrong description, in words the model can fix */
export class McdSpecError extends Error {}

const MAX = { entities: 60, associations: 80, attributes: 40 }
const TYPES = new Set<string>(MCD_TYPES)
/** Words the model may use for a type */
const ALIASES: Record<string, McdType> = {
  integer: 'int', number: 'int', bigint: 'int', smallint: 'int', float: 'decimal', double: 'decimal', money: 'decimal', numeric: 'decimal',
  string: 'varchar', char: 'varchar', boolean: 'bool', timestamp: 'datetime', 'date-time': 'datetime'
}

function attributes(list: unknown, owner: string, next: (p: string) => string): McdAttribute[] {
  if (list === undefined) return []
  if (!Array.isArray(list)) throw new McdSpecError(`"attributes" of ${owner} must be a list`)
  if (list.length > MAX.attributes) throw new McdSpecError(`${owner} has more than ${MAX.attributes} attributes`)
  const seen = new Set<string>()
  return list.map((a: McdSpecAttribute) => {
    const name = typeof a?.name === 'string' ? a.name.trim().slice(0, 60) : ''
    if (!name) throw new McdSpecError(`An attribute of ${owner} has no name`)
    if (seen.has(name.toLowerCase())) throw new McdSpecError(`${owner} has two attributes named ${name}`)
    seen.add(name.toLowerCase())
    const raw = typeof a.type === 'string' ? a.type.trim().toLowerCase() : ''
    const type = TYPES.has(raw) ? raw as McdType : ALIASES[raw] ?? (raw ? null : '')
    if (type === null) throw new McdSpecError(`Unknown type "${a.type}" for ${owner}.${name}: use ${MCD_TYPES.join(', ')}`)
    const length = type === 'varchar' ? Math.min(Math.max(Number.isInteger(a.length) ? a.length! : 255, 1), 65535) : undefined
    return { id: next('a'), name, type, ...(length ? { length } : {}), ...(a.identifier === true ? { identifier: true } : {}) }
  })
}

export function mcdFromSpec(spec: unknown): McdModel {
  const s = spec as McdSpec
  if (!s || !Array.isArray(s.entities) || !s.entities.length) throw new McdSpecError('Give at least one entity in "entities"')
  if (s.entities.length > MAX.entities) throw new McdSpecError(`At most ${MAX.entities} entities`)
  const assocs = s.associations ?? []
  if (!Array.isArray(assocs)) throw new McdSpecError('"associations" must be a list')
  if (assocs.length > MAX.associations) throw new McdSpecError(`At most ${MAX.associations} associations`)

  let n = 0
  const next = (p: string) => `${p}${(++n).toString(36)}`
  const mcd: McdModel = { entities: [], associations: [], links: [], notes: [] }
  const byName = new Map<string, string>()
  const taken = new Set<string>()
  const claim = (name: string, what: string) => {
    if (taken.has(name.toLowerCase())) throw new McdSpecError(`Two ${what} are named ${name}: each name must be unique`)
    taken.add(name.toLowerCase())
  }

  for (const e of s.entities) {
    const name = typeof e?.name === 'string' ? e.name.trim().slice(0, 60) : ''
    if (!name) throw new McdSpecError('An entity has no name')
    claim(name, 'entities or associations')
    const attrs = attributes(e.attributes, name, next)
    // Merise: every entity has an identifier
    if (!attrs.some(a => a.identifier)) attrs.unshift({ id: next('a'), name: `id_${snake(name)}`, type: 'int', identifier: true })
    const id = next('e')
    mcd.entities.push({ id, name, x: 0, y: 0, attributes: attrs })
    byName.set(name.toLowerCase(), id)
  }

  for (const a of assocs) {
    const name = typeof a?.name === 'string' ? a.name.trim().slice(0, 60) : ''
    if (!name) throw new McdSpecError('An association has no name')
    claim(name, 'entities or associations')
    if (!Array.isArray(a.legs) || a.legs.length < 2) throw new McdSpecError(`Association ${name} needs at least two legs`)
    const id = next('s')
    mcd.associations.push({ id, name, x: 0, y: 0, attributes: attributes(a.attributes, name, next).map(({ identifier: _, ...x }) => x) })
    for (const leg of a.legs) {
      const entity = byName.get(String(leg?.entity ?? '').trim().toLowerCase())
      if (!entity) throw new McdSpecError(`Association ${name}: unknown entity "${leg?.entity}" (declare it in "entities")`)
      const card = String(leg.card ?? '').replace(/\s/g, '').replace(/^(\d)\.\.([\dn*])$/i, '$1,$2').replace('*', 'n').toLowerCase() as Cardinality
      if (!CARDINALITIES.includes(card)) throw new McdSpecError(`Association ${name}: cardinality "${leg.card}" must be one of ${CARDINALITIES.join(', ')}`)
      mcd.links.push({ id: next('l'), entity, association: id, card })
    }
  }
  return layoutMcd(mcd)
}
