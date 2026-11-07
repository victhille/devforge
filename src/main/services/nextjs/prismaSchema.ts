import type { SfEntity, SfEntityDraft, SfField, SfFieldType, SfRelation } from '@shared/types'
import { plural } from '../symfony/sfEntityWriter'

/**
 * schema.prisma read and written by DevForge: models shown like the Symfony
 * workshop's entities, new models and fields written as plain Prisma, both
 * sides of each relation included.
 */

export interface PrismaField { name: string; type: string; list: boolean; optional: boolean; attrs: string }
export interface PrismaModel { name: string; fields: PrismaField[]; table: string | null }
export interface PrismaSchema {
  provider: string
  /** "prisma-client" (Prisma 7) or "prisma-client-js" */
  generator: string
  /** Generated client folder, relative to the schema (null: node_modules/@prisma/client) */
  output: string | null
  models: PrismaModel[]
}

const SCALARS: Record<string, SfFieldType> = {
  String: 'string', Int: 'integer', BigInt: 'integer', Float: 'float', Decimal: 'decimal',
  Boolean: 'boolean', DateTime: 'datetime', Json: 'json', Bytes: 'text'
}

const block = (src: string, kind: string, name?: string) =>
  src.match(new RegExp(`^${kind}\\s+${name ?? '\\w+'}\\s*\\{([\\s\\S]*?)^\\}`, 'm'))?.[1] ?? ''

const setting = (body: string, key: string) => body.match(new RegExp(`^\\s*${key}\\s*=\\s*"([^"]*)"`, 'm'))?.[1] ?? null

export function parseSchema(src: string): PrismaSchema {
  const models: PrismaModel[] = []
  for (const m of src.matchAll(/^model\s+(\w+)\s*\{([\s\S]*?)^\}/gm)) {
    const fields: PrismaField[] = []
    let table: string | null = null
    for (const raw of m[2].split('\n')) {
      const line = raw.replace(/\/\/.*$/, '').trim()
      if (!line) continue
      const map = line.match(/^@@map\("([^"]+)"\)/)
      if (map) { table = map[1]; continue }
      if (line.startsWith('@@')) continue
      const f = line.match(/^(\w+)\s+(\w+)(\[\])?(\?)?\s*(.*)$/)
      if (f) fields.push({ name: f[1], type: f[2], list: !!f[3], optional: !!f[4], attrs: f[5] })
    }
    models.push({ name: m[1], fields, table })
  }
  const gen = block(src, 'generator')
  return { provider: setting(block(src, 'datasource'), 'provider') ?? 'postgresql', generator: setting(gen, 'provider') ?? 'prisma-client-js', output: setting(gen, 'output'), models }
}

/** Models as the workshop shows entities */
export function toEntities(schema: PrismaSchema): SfEntity[] {
  const names = new Set(schema.models.map(m => m.name))
  return schema.models.map(m => {
    const fkNames = new Set(m.fields.flatMap(f => [...f.attrs.matchAll(/fields:\s*\[([^\]]*)\]/g)].flatMap(x => x[1].split(',').map(s => s.trim()))))
    const fields: SfField[] = m.fields
      .filter(f => !names.has(f.type) && !/@id\b/.test(f.attrs) && !fkNames.has(f.name) && SCALARS[f.type])
      .map(f => ({
        name: f.name,
        type: f.type === 'DateTime' && /@db\.Date\b/.test(f.attrs) ? 'date' as const : f.type === 'String' && /@db\.Text\b/.test(f.attrs) ? 'text' as const : SCALARS[f.type],
        nullable: f.optional, unique: /@unique\b/.test(f.attrs)
      }))
    const relations: SfRelation[] = m.fields.filter(f => names.has(f.type)).map(f => {
      const other = schema.models.find(x => x.name === f.type)!
      const back = other.fields.find(x => x.type === m.name && (other !== m || x.name !== f.name))
      const kind: SfRelation['kind'] = f.list ? (back?.list ? 'ManyToMany' : 'OneToMany') : (back && !back.list ? 'OneToOne' : 'ManyToOne')
      const fk = f.attrs.match(/fields:\s*\[\s*(\w+)/)?.[1]
      return { name: f.name, kind, target: f.type, inverse: back?.name ?? null, nullable: f.optional, ...(fk ? { fk } : {}) }
    })
    return { name: m.name, table: m.table ?? m.name, file: 'prisma/schema.prisma', fields, relations, apiResource: false }
  }).sort((a, b) => a.name.localeCompare(b.name))
}

// ─── Writing ──────────────────────────────────────────────────────────────────

const PRISMA_TYPE: Record<SfFieldType, string> = {
  string: 'String', text: 'String', integer: 'Int', float: 'Float', decimal: 'Decimal',
  boolean: 'Boolean', date: 'DateTime', datetime: 'DateTime', json: 'Json'
}

function fieldLine(f: SfField, provider: string): string {
  const attrs: string[] = []
  if (f.unique) attrs.push('@unique')
  // Column types only where the database knows them
  if (provider === 'postgresql' || provider === 'mysql') {
    if (f.type === 'text') attrs.push('@db.Text')
    if (f.type === 'decimal') attrs.push(`@db.Decimal(${f.precision ?? 10}, ${f.scale ?? 2})`)
    if (f.type === 'date') attrs.push('@db.Date')
    if (f.type === 'string' && f.length && f.length !== 255 && f.length <= 10485760) attrs.push(`@db.VarChar(${f.length})`)
  }
  return `${f.name} ${PRISMA_TYPE[f.type]}${f.nullable ? '?' : ''}${attrs.length ? ' ' + attrs.join(' ') : ''}`
}

/** The lines a relation adds to its model (the link, and the foreign key on the owning side) */
function relationLines(r: SfRelation, owning: boolean, relName: string | null): string[] {
  const opt = r.nullable ? '?' : ''
  const fk = `${r.name}Id`
  // Two links between the same models (or a model and itself) need a name on both sides
  const named = relName ? `"${relName}", ` : ''
  const nameOnly = relName ? ` @relation("${relName}")` : ''
  switch (r.kind) {
    case 'ManyToOne':
      return [`${r.name} ${r.target}${opt} @relation(${named}fields: [${fk}], references: [id])`, `${fk} Int${opt}`]
    case 'OneToMany':
    case 'ManyToMany':
      return [`${r.name} ${r.target}[]${nameOnly}`]
    case 'OneToOne':
      return owning
        ? [`${r.name} ${r.target}${opt} @relation(${named}fields: [${fk}], references: [id])`, `${fk} Int${opt} @unique`]
        : [`${r.name} ${r.target}?${nameOnly}`]
  }
}

/** The other side of a relation, written in the target model */
export function inverseOf(owner: string, r: SfRelation): SfRelation | null {
  if (!r.inverse) return null
  const kind = r.kind === 'ManyToOne' ? 'OneToMany' : r.kind === 'OneToMany' ? 'ManyToOne' : r.kind
  return { name: r.inverse, kind, target: owner, inverse: r.name, nullable: r.nullable }
}

/** Aligned like `prisma format` does: names, types, attributes */
function format(lines: string[]): string[] {
  const parts = lines.map(l => l.split(/\s+/))
  const w0 = Math.max(...parts.map(p => p[0].length))
  const w1 = Math.max(...parts.map(p => (p[1] ?? '').length))
  return parts.map(p => `  ${p[0].padEnd(w0)} ${(p[1] ?? '').padEnd(p.length > 2 ? w1 : 0)}${p.length > 2 ? ' ' + p.slice(2).join(' ') : ''}`.trimEnd())
}

function addToModel(src: string, model: string, lines: string[]): string {
  const re = new RegExp(`^(model\\s+${model}\\s*\\{[\\s\\S]*?)(^\\})`, 'm')
  const m = src.match(re)
  if (!m) throw new Error('NO_ENTITY')
  const body = m[1]
  const existing = body.split('\n').slice(1).filter(l => l.trim() && !l.trim().startsWith('//') && !l.trim().startsWith('@@'))
  for (const l of lines) if (existing.some(e => e.trim().split(/\s+/)[0] === l.split(/\s+/)[0])) throw new Error(`EXISTS:${l.split(/\s+/)[0]}`)
  // The block is rewritten aligned; its @@ lines and comments stay at the end
  const rest = body.split('\n').slice(1).filter(l => l.trim() && (l.trim().startsWith('//') || l.trim().startsWith('@@')))
  const head = body.split('\n')[0]
  const fresh = [head, ...format([...existing.map(l => l.trim()), ...lines]), ...(rest.length ? ['', ...rest.map(l => `  ${l.trim()}`)] : []), '']
  return src.replace(re, `${fresh.join('\n')}$2`)
}

/** New model, or fields added to an existing one; the other side of each relation too */
export function writeModel(src: string, d: SfEntityDraft): string {
  const schema = parseSchema(src)
  const lcOwner = d.name.charAt(0).toLowerCase() + d.name.slice(1)
  // Prisma wants both sides of every link: a name is made up when the user gave none
  const rels = d.relations.map(r => r.inverse ? r : { ...r, inverse: r.kind === 'OneToOne' ? lcOwner : plural(lcOwner) })
  const linked = (target: string) =>
    rels.filter(r => r.target === target).length > 1 ||
    (schema.models.find(m => m.name === d.name)?.fields.some(f => f.type === target) ?? false)
  const relName = (r: SfRelation) => r.target === d.name || linked(r.target) ? `${d.name}${r.name.charAt(0).toUpperCase()}${r.name.slice(1)}` : null

  const lines = [
    ...d.fields.map(f => fieldLine(f, schema.provider)),
    ...rels.flatMap(r => relationLines(r, r.kind !== 'OneToMany', relName(r)))
  ]
  let out = src
  if (d.existing) out = addToModel(out, d.name, lines)
  else {
    const body = format(['id Int @id @default(autoincrement())', ...lines, 'createdAt DateTime @default(now())'])
    out = out.replace(/\s*$/, '\n') + `\nmodel ${d.name} {\n${body.join('\n')}\n}\n`
  }
  // The other sides, the self-relations included (written in the same model)
  for (const r of rels) {
    const inv = inverseOf(d.name, r)!
    out = addToModel(out, r.target, relationLines(inv, r.kind === 'OneToMany', relName(r)))
  }
  return out
}
