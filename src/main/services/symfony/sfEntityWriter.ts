import type { SfEntityDraft, SfField, SfFieldType, SfRelation } from '@shared/types'

/**
 * Writes Doctrine entities the way MakerBundle does (attributes, getters and
 * setters), without driving make:entity and its one-by-one questions.
 * Pure text in, text out: the service reads and writes the files.
 */

export const ENTITY_RE = /^[A-Z][A-Za-z0-9]{0,62}$/
export const PROPERTY_RE = /^[a-z][A-Za-z0-9]{0,62}$/

/** Table names a database refuses unquoted */
const RESERVED = new Set(['user', 'order', 'group', 'select', 'table', 'check', 'column', 'from', 'where', 'grant', 'limit', 'offset', 'key', 'references'])

const ucfirst = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
const lcfirst = (s: string) => s.charAt(0).toLowerCase() + s.slice(1)

/** "factures" → "facture", "categories" → "category" */
export function singular(word: string): string {
  if (/ies$/.test(word) && word.length > 4) return word.slice(0, -3) + 'y'
  if (/(ss|us)$/.test(word)) return word
  if (/s$/.test(word) && word.length > 2) return word.slice(0, -1)
  return word
}

/** "facture" → "factures", "category" → "categories" */
export function plural(word: string): string {
  if (/[^aeiou]y$/.test(word)) return word.slice(0, -1) + 'ies'
  if (/(s|x|z)$/.test(word)) return word
  return word + 's'
}

const PHP_TYPE: Record<SfFieldType, string> = {
  string: 'string', text: 'string', integer: 'int', float: 'float', decimal: 'string',
  boolean: 'bool', date: '\\DateTimeImmutable', datetime: '\\DateTimeImmutable', json: 'array'
}

function columnAttribute(f: SfField): string {
  const args: string[] = []
  if (f.type === 'text') args.push('type: Types::TEXT')
  if (f.type === 'decimal') args.push('type: Types::DECIMAL', `precision: ${f.precision ?? 10}`, `scale: ${f.scale ?? 2}`)
  if (f.type === 'date') args.push('type: Types::DATE_IMMUTABLE')
  if (f.type === 'string') args.push(`length: ${f.length ?? 255}`)
  if (f.nullable && f.type !== 'json') args.push('nullable: true')
  if (f.unique) args.push('unique: true')
  return `    #[ORM\\Column${args.length ? `(${args.join(', ')})` : ''}]`
}

/** Property, getter and setter of one field */
export function fieldCode(f: SfField): { property: string; methods: string } {
  const t = PHP_TYPE[f.type], up = ucfirst(f.name)
  if (f.type === 'json') {
    return {
      property: `${columnAttribute(f)}\n    private array $${f.name} = [];\n`,
      methods: `    public function get${up}(): array\n    {\n        return $this->${f.name};\n    }\n\n` +
        `    public function set${up}(array $${f.name}): static\n    {\n        $this->${f.name} = $${f.name};\n\n        return $this;\n    }\n`
    }
  }
  const getter = f.type === 'boolean' ? `is${up}` : `get${up}`
  return {
    property: `${columnAttribute(f)}\n    private ?${t} $${f.name} = null;\n`,
    methods: `    public function ${getter}(): ?${t}\n    {\n        return $this->${f.name};\n    }\n\n` +
      `    public function set${up}(${f.nullable ? '?' : ''}${t} $${f.name}): static\n    {\n        $this->${f.name} = $${f.name};\n\n        return $this;\n    }\n`
  }
}

interface Members { property: string; methods: string; init: string | null; collection: boolean }

const method = (signature: string, body: string) => `    public function ${signature}\n    {\n${body}    }\n`

/**
 * One side of a relation, written in the entity that holds it. `owning`: the
 * side Doctrine saves (ManyToOne always, OneToMany never, ManyToMany and
 * OneToOne the side the user declared).
 */
export function relationCode(r: SfRelation, owning: boolean): Members {
  const up = ucfirst(r.name), T = r.target, inv = r.inverse, invUp = inv ? ucfirst(inv) : ''

  if (r.kind === 'ManyToOne' || r.kind === 'OneToOne') {
    const args = owning ? (inv ? [`inversedBy: '${inv}'`] : []) : [`mappedBy: '${inv}'`]
    const join = owning && !r.nullable ? '    #[ORM\\JoinColumn(nullable: false)]\n' : ''
    // OneToOne, side that is not saved: keep the other side in step
    const sync = r.kind === 'OneToOne' && !owning
      ? `        // Unlink the previous one, link the new one\n        if ($${r.name} === null && $this->${r.name} !== null) {\n            $this->${r.name}->set${invUp}(null);\n        }\n        if ($${r.name} !== null && $${r.name}->get${invUp}() !== $this) {\n            $${r.name}->set${invUp}($this);\n        }\n\n`
      : ''
    return {
      property: `    #[ORM\\${r.kind}${args.length ? `(${args.join(', ')})` : ''}]\n${join}    private ?${T} $${r.name} = null;\n`,
      methods: method(`get${up}(): ?${T}`, `        return $this->${r.name};\n`) + '\n' +
        method(`set${up}(?${T} $${r.name}): static`, `${sync}        $this->${r.name} = $${r.name};\n\n        return $this;\n`),
      init: null, collection: false
    }
  }

  // Collections: OneToMany (the other side of a ManyToOne) and ManyToMany
  const item = singular(r.name)
  const v = item === r.name ? `${item}Item` : item
  const vUp = ucfirst(item)
  const attr = r.kind === 'OneToMany'
    ? `#[ORM\\OneToMany(targetEntity: ${T}::class, mappedBy: '${inv}')]`
    : `#[ORM\\ManyToMany(targetEntity: ${T}::class${owning ? (inv ? `, inversedBy: '${inv}'` : '') : `, mappedBy: '${inv}'`})]`
  let onAdd = '', onRemove = ''
  if (r.kind === 'OneToMany') {
    onAdd = `            $${v}->set${invUp}($this);\n`
    onRemove = `            // It pointed here: unlink it\n            if ($${v}->get${invUp}() === $this) {\n                $${v}->set${invUp}(null);\n            }\n`
  } else if (!owning) {
    onAdd = `            $${v}->add${ucfirst(singular(inv ?? ''))}($this);\n`
    onRemove = `            $${v}->remove${ucfirst(singular(inv ?? ''))}($this);\n`
  }
  const remove = onRemove
    ? `        if ($this->${r.name}->removeElement($${v})) {\n${onRemove}        }\n`
    : `        $this->${r.name}->removeElement($${v});\n`
  return {
    property: `    /**\n     * @var Collection<int, ${T}>\n     */\n    ${attr}\n    private Collection $${r.name};\n`,
    methods:
      `    /**\n     * @return Collection<int, ${T}>\n     */\n` + method(`get${up}(): Collection`, `        return $this->${r.name};\n`) + '\n' +
      method(`add${vUp}(${T} $${v}): static`, `        if (!$this->${r.name}->contains($${v})) {\n            $this->${r.name}->add($${v});\n${onAdd}        }\n\n        return $this;\n`) + '\n' +
      method(`remove${vUp}(${T} $${v}): static`, `${remove}\n        return $this;\n`),
    init: `        $this->${r.name} = new ArrayCollection();`,
    collection: true
  }
}

/** The side written in the target entity, or null for a one-way link */
export function inverseOf(owner: string, r: SfRelation): SfRelation | null {
  if (!r.inverse) return null
  const kind = r.kind === 'ManyToOne' ? 'OneToMany' : r.kind === 'OneToMany' ? 'ManyToOne' : r.kind
  return { name: r.inverse, kind, target: owner, inverse: r.name, nullable: r.nullable }
}

/** Is this side, declared by the user in the draft, the one Doctrine saves? */
export const declaredOwning = (r: SfRelation) => r.kind !== 'OneToMany'

function uses(needCollections: boolean, needTypes: boolean, repository: string | null): string {
  const lines = [
    ...(repository ? [`use App\\Repository\\${repository};`] : []),
    ...(needCollections ? ['use Doctrine\\Common\\Collections\\ArrayCollection;', 'use Doctrine\\Common\\Collections\\Collection;'] : []),
    ...(needTypes ? ['use Doctrine\\DBAL\\Types\\Types;'] : []),
    'use Doctrine\\ORM\\Mapping as ORM;'
  ]
  return lines.join('\n')
}

const needsTypes = (fields: SfField[]) => fields.some(f => f.type === 'text' || f.type === 'decimal' || f.type === 'date')

/** src/Entity/<Name>.php of a new entity (the relations' own sides included) */
export function newEntityFile(d: SfEntityDraft, selfInverse: SfRelation[] = []): string {
  const fields = d.fields.map(fieldCode)
  const rels = [...d.relations.map(r => relationCode(r, declaredOwning(r))), ...selfInverse.map(r => relationCode(r, !declaredOwning(inverseOf(d.name, r)!)))]
  const inits = rels.map(r => r.init).filter((x): x is string => !!x)
  const table = RESERVED.has(d.name.toLowerCase()) ? `#[ORM\\Table(name: '\`${d.name.toLowerCase()}\`')]\n` : ''
  const ctor = inits.length ? `    public function __construct()\n    {\n${inits.join('\n')}\n    }\n\n` : ''
  return `<?php

namespace App\\Entity;

${uses(rels.some(r => r.collection), needsTypes(d.fields), `${d.name}Repository`)}

#[ORM\\Entity(repositoryClass: ${d.name}Repository::class)]
${table}class ${d.name}
{
    #[ORM\\Id]
    #[ORM\\GeneratedValue]
    #[ORM\\Column]
    private ?int $id = null;

${[...fields.map(f => f.property), ...rels.map(r => r.property)].join('\n')}
${ctor}    public function getId(): ?int
    {
        return $this->id;
    }

${[...fields.map(f => f.methods), ...rels.map(r => r.methods)].join('\n')}}
`
}

export function repositoryFile(name: string): string {
  return `<?php

namespace App\\Repository;

use App\\Entity\\${name};
use Doctrine\\Bundle\\DoctrineBundle\\Repository\\ServiceEntityRepository;
use Doctrine\\Persistence\\ManagerRegistry;

/**
 * @extends ServiceEntityRepository<${name}>
 */
class ${name}Repository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, ${name}::class);
    }
}
`
}

/** Adds use lines that are missing, after the namespace or the last use */
function addUses(src: string, lines: string[]): string {
  const missing = lines.filter(l => !src.includes(l))
  if (!missing.length) return src
  const lastUse = [...src.matchAll(/^use [^;]+;\r?$/gm)].pop()
  const at = lastUse ? lastUse.index! + lastUse[0].length : src.search(/^namespace [^;]+;/m) + src.match(/^namespace [^;]+;/m)![0].length + 1
  return src.slice(0, at) + '\n' + missing.join('\n') + src.slice(at)
}

/** Start of the first method's line, its docblock and attributes included */
function methodStart(src: string): number {
  const m = /^[ \t]*public function /m.exec(src)
  if (!m) throw new Error('NO_METHODS')
  let at = m.index
  while (at > 1) {
    const prevStart = src.lastIndexOf('\n', at - 2) + 1
    const line = src.slice(prevStart, at - 1).trim()
    if (!/^(\/\*\*|\*|#\[)/.test(line)) break
    at = prevStart
  }
  return at
}

/**
 * Adds fields and relation sides to an existing entity file: properties
 * before the first method, methods before the closing brace, collections
 * created in the constructor.
 */
export function extendEntity(src: string, fields: SfField[], relations: SfRelation[], owning: boolean[]): string {
  for (const p of [...fields.map(f => f.name), ...relations.map(r => r.name)]) {
    if (new RegExp(`(private|protected|public)\\s+[^;=(]*\\$${p}\\b`).test(src)) throw new Error(`EXISTS:${p}`)
  }
  const parts = [...fields.map(fieldCode), ...relations.map((r, i) => relationCode(r, owning[i]))]
  if (!parts.length) return src
  const rels = parts.slice(fields.length) as Members[]
  let out = src
  const useLines = [
    ...(rels.some(r => r.collection) ? ['use Doctrine\\Common\\Collections\\ArrayCollection;', 'use Doctrine\\Common\\Collections\\Collection;'] : []),
    ...(needsTypes(fields) ? ['use Doctrine\\DBAL\\Types\\Types;'] : [])
  ]
  out = addUses(out, useLines)

  const firstMethod = methodStart(out)
  out = out.slice(0, firstMethod) + parts.map(p => p.property).join('\n') + '\n' + out.slice(firstMethod)

  const inits = rels.map(r => r.init).filter((x): x is string => !!x)
  if (inits.length) {
    const ctor = out.match(/public function __construct\([^)]*\)\s*\{\r?\n/)
    if (ctor) out = out.replace(ctor[0], ctor[0] + inits.join('\n') + '\n')
    else {
      const at = methodStart(out)
      out = out.slice(0, at) + `    public function __construct()\n    {\n${inits.join('\n')}\n    }\n\n` + out.slice(at)
    }
  }

  const close = out.lastIndexOf('}')
  out = out.slice(0, close).replace(/\s*$/, '\n') + '\n' + parts.map(p => p.methods).join('\n') + out.slice(close)
  return out
}

/** Checks a draft before anything is written; returns an error code or null */
export function checkDraft(d: SfEntityDraft, existing: string[]): string | null {
  if (!ENTITY_RE.test(d.name)) return 'BAD_ENTITY_NAME'
  if (!d.existing && existing.includes(d.name)) return 'ENTITY_EXISTS'
  if (d.existing && !existing.includes(d.name)) return 'NO_ENTITY'
  const names = [...d.fields.map(f => f.name), ...d.relations.map(r => r.name)]
  if (!names.length) return 'EMPTY'
  if (names.some(n => !PROPERTY_RE.test(n) || n === 'id')) return 'BAD_PROPERTY'
  if (new Set(names).size !== names.length) return 'DUPLICATE_PROPERTY'
  for (const r of d.relations) {
    if (!existing.includes(r.target) && r.target !== d.name) return 'NO_TARGET'
    if (r.inverse !== null && !PROPERTY_RE.test(r.inverse)) return 'BAD_PROPERTY'
    if (r.kind === 'OneToMany' && !r.inverse) return 'NEEDS_INVERSE'
  }
  return null
}

/** Suggested name of the other side: "factures" in User for Facture.client */
export function suggestInverse(owner: string, kind: SfRelation['kind']): string {
  const base = lcfirst(owner)
  return kind === 'ManyToOne' || kind === 'ManyToMany' ? plural(base) : base
}
