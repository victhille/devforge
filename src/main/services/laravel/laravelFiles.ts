import type { SfEntity, SfEntityDraft, SfField, SfFieldType, SfOperation, SfRelation, SfRelationKind } from '@shared/types'
import { singular } from '../symfony/sfEntityWriter'
import { creationOrder, fakerFor } from '../symfony/sfFixtures'
import { apiPath } from '../symfony/sfApi'
import { apiFields } from '../nextjs/nextFiles'

/**
 * Files the Laravel workshop reads and writes: Eloquent models, their
 * migrations, JSON controllers and the routes block, factories and the seeder.
 * Pure text; the service decides where. Columns are snake_case (en_vente),
 * relation methods keep the name typed (categorie, lignesCommande).
 */

export const GENERATED_MARK = '// Written by DevForge'

export const snake = (s: string) => s.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase()
/** Laravel's table for a model: snake_case, plural (LigneCommande → ligne_commandes) */
export function tableOf(model: string): string {
  const s = snake(model)
  if (/[^aeiou]y$/.test(s)) return s.slice(0, -1) + 'ies'
  if (/(s|x|z|ch|sh)$/.test(s)) return s + 'es'
  return s + 's'
}
const fkOf = (relation: string) => `${snake(relation)}_id`

// ─── Reading ──────────────────────────────────────────────────────────────────

export interface Column { name: string; type: SfFieldType | 'fk'; nullable: boolean; unique: boolean; length?: number; precision?: number; scale?: number }

const COLUMN_TYPE: Record<string, SfFieldType> = {
  string: 'string', char: 'string', uuid: 'string', ulid: 'string', ipAddress: 'string',
  text: 'text', mediumText: 'text', longText: 'text', tinyText: 'text',
  integer: 'integer', bigInteger: 'integer', smallInteger: 'integer', tinyInteger: 'integer', mediumInteger: 'integer',
  unsignedInteger: 'integer', unsignedBigInteger: 'integer', unsignedSmallInteger: 'integer', unsignedTinyInteger: 'integer',
  float: 'float', double: 'float', decimal: 'decimal', boolean: 'boolean',
  date: 'date', dateTime: 'datetime', dateTimeTz: 'datetime', timestamp: 'datetime', timestampTz: 'datetime',
  json: 'json', jsonb: 'json'
}

/** The part of a migration that runs on "migrate": the body of up() */
export function upBody(php: string): string {
  const start = php.search(/function\s+up\s*\(/)
  if (start < 0) return ''
  const end = php.search(/function\s+down\s*\(/)
  return php.slice(start, end > start ? end : undefined)
}

/**
 * Tables and their columns after running these migrations in order: create,
 * then table (added and dropped columns), then drop. Read without a database.
 */
export function readMigrations(files: string[]): Map<string, Column[]> {
  const tables = new Map<string, Column[]>()
  for (const php of files) {
    const up = upBody(php)
    for (const m of up.matchAll(/Schema::(create|table|drop|dropIfExists)\(\s*'(\w+)'(?:\s*,\s*function\s*\([^)]*\)\s*(?::\s*void\s*)?\{([\s\S]*?)\n\s*\}\s*\))?/g)) {
      const [, op, table, body = ''] = m
      if (op === 'drop' || op === 'dropIfExists') { tables.delete(table); continue }
      const cols = op === 'create' ? [] : tables.get(table) ?? []
      for (const c of body.matchAll(/\$table->(\w+)\(([^;]*?)\)((?:->\w+\([^;]*?\))*)\s*;/g)) {
        const [, method, rawArgs, chain] = c
        const args = [...rawArgs.matchAll(/'(\w+)'|\[([^\]]*)\]|(\d+)/g)]
        const name = args[0]?.[1]
        const nullable = /->nullable\(\s*(true)?\s*\)/.test(chain)
        const unique = /->unique\(/.test(chain)
        if (method === 'dropColumn' || method === 'dropConstrainedForeignId' || method === 'dropForeign') {
          const names = args[0]?.[2] ? [...args[0][2].matchAll(/'(\w+)'/g)].map(x => x[1]) : name ? [name] : []
          for (const n of names) { const i = cols.findIndex(x => x.name === n); if (i >= 0 && method !== 'dropForeign') cols.splice(i, 1) }
          continue
        }
        if (method === 'unique' && name) { const col = cols.find(x => x.name === name); if (col) col.unique = true; continue }
        if (method === 'renameColumn' && name && args[1]?.[1]) { const col = cols.find(x => x.name === name); if (col) col.name = args[1][1]; continue }
        if (!name) continue
        if (method === 'foreignId' || method === 'foreignIdFor' || ((method === 'unsignedBigInteger' || method === 'bigInteger') && name.endsWith('_id'))) {
          cols.push({ name, type: 'fk', nullable, unique })
          continue
        }
        const type = COLUMN_TYPE[method]
        if (!type) continue
        const nums = args.filter(a => a[3]).map(a => Number(a[3]))
        cols.push({
          name, type, nullable, unique,
          ...(type === 'string' && nums[0] ? { length: nums[0] } : {}),
          ...(type === 'decimal' ? { precision: nums[0] ?? 8, scale: nums[1] ?? 2 } : {})
        })
      }
      tables.set(table, cols)
    }
  }
  return tables
}

export interface ModelInfo {
  name: string
  file: string
  table: string
  relations: { method: string; kind: 'belongsTo' | 'hasMany' | 'hasOne' | 'belongsToMany'; target: string; args: string[] }[]
}

/** An Eloquent model read from its file: table, and the relation methods */
export function readModel(name: string, file: string, php: string): ModelInfo {
  const table = php.match(/protected\s+\$table\s*=\s*'(\w+)'/)?.[1] ?? tableOf(name)
  const relations: ModelInfo['relations'] = []
  for (const m of php.matchAll(/function\s+(\w+)\s*\(\s*\)\s*(?::\s*\\?[\w\\]+\s*)?\{\s*return\s+\$this->(belongsTo|hasMany|hasOne|belongsToMany)\(\s*\\?(?:[\w\\]+\\)?(\w+)::class\s*((?:,\s*'[^']*'\s*)*)\)/g)) {
    relations.push({ method: m[1], kind: m[2] as ModelInfo['relations'][number]['kind'], target: m[3], args: [...m[4].matchAll(/'([^']*)'/g)].map(x => x[1]) })
  }
  return { name, file, table, relations }
}

/** Models and migrations as the workshop's entities: fields from the columns, links from the methods */
export function toEntities(models: ModelInfo[], tables: Map<string, Column[]>): SfEntity[] {
  const names = new Set(models.map(m => m.name))
  return models.map(model => {
    const cols = tables.get(model.table) ?? []
    const relations: SfRelation[] = []
    const fks = new Set<string>()
    for (const r of model.relations) {
      if (!names.has(r.target)) continue
      const target = models.find(m => m.name === r.target)!
      let kind: SfRelationKind
      let fk: string | undefined
      let nullable = true
      if (r.kind === 'belongsTo') {
        fk = r.args[0] ?? fkOf(r.method)
        const col = cols.find(c => c.name === fk)
        fks.add(fk)
        kind = col?.unique ? 'OneToOne' : 'ManyToOne'
        nullable = col?.nullable ?? true
      } else {
        kind = r.kind === 'hasMany' ? 'OneToMany' : r.kind === 'hasOne' ? 'OneToOne' : 'ManyToMany'
      }
      // The other side: a method of the target pointing back here with the same key
      const back = target.relations.find(x => x.target === model.name && x.method !== r.method && (
        r.kind === 'belongsTo' ? (x.kind === 'hasMany' || x.kind === 'hasOne') && (x.args[0] ?? fkOf(model.name)) === fk
          : r.kind === 'belongsToMany' ? x.kind === 'belongsToMany'
            : x.kind === 'belongsTo' && (x.args[0] ?? fkOf(x.method)) === (r.args[0] ?? fkOf(model.name))))
      // A hasOne is the inverse side of a OneToOne: shown from the side that holds the key
      if (r.kind === 'hasOne' && back) continue
      relations.push({ name: r.method, kind, target: r.target, inverse: back?.method ?? null, nullable, ...(fk ? { fk } : {}) })
    }
    const fields: SfField[] = cols.filter(c => c.type !== 'fk' && !fks.has(c.name)).map(c => ({
      name: c.name, type: c.type as SfFieldType, nullable: c.nullable, unique: c.unique,
      ...(c.length ? { length: c.length } : {}), ...(c.precision !== undefined ? { precision: c.precision, scale: c.scale } : {})
    }))
    return { name: model.name, table: model.table, file: model.file, fields, relations, apiResource: false }
  })
}

// ─── Migrations: status and SQL ───────────────────────────────────────────────

/** `php artisan migrate:status`: ran or pending, per migration */
export function parseMigrateStatus(out: string): { ran: Map<string, boolean>; tableMissing: boolean } {
  const ran = new Map<string, boolean>()
  for (const m of out.matchAll(/^\s*(\S+)\s+\.{2,}\s+(?:\[\d+\]\s+)?(Ran|Pending)\s*$/gm)) ran.set(m[1], m[2] === 'Ran')
  return { ran, tableMissing: /Migration table not found/i.test(out) }
}

/** `php artisan migrate --pretend`: the SQL of each pending migration */
export function parsePretend(out: string): Map<string, string[]> {
  const sql = new Map<string, string[]>()
  let current: string | null = null
  for (const line of out.split(/\r?\n/)) {
    const head = line.match(/^\s*(\d{4}_\d{2}_\d{2}_\d{6}_\w+)\s*\.*\s*$/)
    if (head) { current = head[1]; sql.set(current, []); continue }
    const q = line.match(/^\s*⇂\s+(.+?)\s*$/)
    if (q && current) sql.get(current)!.push(q[1])
  }
  return sql
}

/** "2025_10_25_120000_create_produits_table" → "create produits table" */
export const migrationLabel = (name: string) => name.replace(/^\d{4}_\d{2}_\d{2}_\d{6}_/, '').replace(/_/g, ' ')

// ─── Writing models and migrations ────────────────────────────────────────────

const castOf: Partial<Record<SfFieldType, (f: SfField) => string>> = {
  decimal: f => `decimal:${f.scale ?? 2}`, boolean: () => 'boolean', date: () => 'date',
  datetime: () => 'datetime', json: () => 'array', float: () => 'float'
}

function columnLine(f: SfField): string {
  const n = snake(f.name)
  const call = {
    string: f.length && f.length !== 255 ? `string('${n}', ${f.length})` : `string('${n}')`,
    text: `text('${n}')`, integer: `integer('${n}')`, float: `double('${n}')`,
    decimal: `decimal('${n}', ${f.precision ?? 10}, ${f.scale ?? 2})`, boolean: `boolean('${n}')`,
    date: `date('${n}')`, datetime: `dateTime('${n}')`, json: `json('${n}')`
  }[f.type]
  return `$table->${call}${f.nullable ? '->nullable()' : ''}${f.unique ? '->unique()' : ''};`
}

const fkLine = (column: string, table: string, nullable: boolean, unique = false) =>
  `$table->foreignId('${column}')${nullable ? '->nullable()' : ''}${unique ? '->unique()' : ''}->constrained('${table}')${nullable ? '->nullOnDelete()' : '->cascadeOnDelete()'};`

/** Where each link of a draft lives: a key on a table, a pivot, and the methods of both models */
export interface LinkPlan {
  /** Key columns added to a table */
  keys: { table: string; line: string; column: string }[]
  pivots: { table: string; lines: string[] }[]
  methods: { model: string; method: string; code: string; uses: string[] }[]
}

const relMethod = (name: string, type: string, body: string) =>
  `    public function ${name}(): ${type}\n    {\n        return $this->${body};\n    }\n`

export function planLinks(owner: string, relations: SfRelation[], tableFor: (model: string) => string): LinkPlan {
  const plan: LinkPlan = { keys: [], pivots: [], methods: [] }
  const add = (model: string, method: string, type: string, body: string) =>
    plan.methods.push({ model, method, code: relMethod(method, type, body), uses: [`Illuminate\\Database\\Eloquent\\Relations\\${type}`] })
  for (const r of relations) {
    const T = r.target
    switch (r.kind) {
      case 'ManyToOne': {
        const fk = fkOf(r.name)
        plan.keys.push({ table: tableFor(owner), column: fk, line: fkLine(fk, tableFor(T), r.nullable) })
        add(owner, r.name, 'BelongsTo', `belongsTo(${T}::class, '${fk}')`)
        if (r.inverse) add(T, r.inverse, 'HasMany', `hasMany(${owner}::class, '${fk}')`)
        break
      }
      case 'OneToOne': {
        const fk = fkOf(r.name)
        plan.keys.push({ table: tableFor(owner), column: fk, line: fkLine(fk, tableFor(T), r.nullable, true) })
        add(owner, r.name, 'BelongsTo', `belongsTo(${T}::class, '${fk}')`)
        if (r.inverse) add(T, r.inverse, 'HasOne', `hasOne(${owner}::class, '${fk}')`)
        break
      }
      case 'OneToMany': {
        // The key is on the other table, named after the other side's link
        const fk = fkOf(r.inverse ?? owner)
        plan.keys.push({ table: tableFor(T), column: fk, line: fkLine(fk, tableFor(owner), r.nullable) })
        add(owner, r.name, 'HasMany', `hasMany(${T}::class, '${fk}')`)
        if (r.inverse) add(T, r.inverse, 'BelongsTo', `belongsTo(${owner}::class, '${fk}')`)
        break
      }
      case 'ManyToMany': {
        const self = T === owner
        const a = `${snake(owner)}_id`
        const b = self ? `${snake(singular(r.name))}_id` : `${snake(T)}_id`
        const pivot = self ? `${snake(owner)}_${snake(r.name)}` : [snake(owner), snake(T)].sort().join('_')
        plan.pivots.push({ table: pivot, lines: [
          `$table->foreignId('${a}')->constrained('${tableFor(owner)}')->cascadeOnDelete();`,
          `$table->foreignId('${b}')->constrained('${tableFor(T)}')->cascadeOnDelete();`,
          `$table->primary(['${a}', '${b}']);`
        ] })
        add(owner, r.name, 'BelongsToMany', `belongsToMany(${T}::class, '${pivot}', '${a}', '${b}')`)
        if (r.inverse) add(T, r.inverse, 'BelongsToMany', `belongsToMany(${owner}::class, '${pivot}', '${b}', '${a}')`)
        break
      }
    }
  }
  return plan
}

const indent = (lines: string[], n: number) => lines.map(l => ' '.repeat(n) + l).join('\n')

/** A migration that creates, or adds columns to, tables; and the pivots of many-to-many links */
export function migrationFile(creates: { table: string; lines: string[] }[], alters: { table: string; lines: string[]; columns: string[] }[]): string {
  const up = [
    ...creates.map(c => `        Schema::create('${c.table}', function (Blueprint $table) {\n${indent(c.lines, 12)}\n        });`),
    ...alters.map(a => `        Schema::table('${a.table}', function (Blueprint $table) {\n${indent(a.lines, 12)}\n        });`)
  ].join('\n\n')
  const down = [
    ...[...alters].reverse().map(a => {
      const keys = a.lines.filter(l => l.includes('foreignId(')).map(l => l.match(/foreignId\('(\w+)'\)/)![1])
      const plain = a.columns.filter(c => !keys.includes(c))
      return `        Schema::table('${a.table}', function (Blueprint $table) {\n${indent([
        ...keys.map(k => `$table->dropConstrainedForeignId('${k}');`),
        ...(plain.length ? [`$table->dropColumn([${plain.map(c => `'${c}'`).join(', ')}]);`] : [])
      ], 12)}\n        });`
    }),
    ...[...creates].reverse().map(c => `        Schema::dropIfExists('${c.table}');`)
  ].join('\n')
  return `<?php

use Illuminate\\Database\\Migrations\\Migration;
use Illuminate\\Database\\Schema\\Blueprint;
use Illuminate\\Support\\Facades\\Schema;

return new class extends Migration
{
    public function up(): void
    {
${up}
    }

    public function down(): void
    {
${down}
    }
};
`
}

/** Columns of a new model's table, in order: id, fields, keys, timestamps */
export function createLines(fields: SfField[], keys: string[]): string[] {
  return ['$table->id();', ...fields.map(columnLine), ...keys, '$table->timestamps();']
}
export const addLines = (fields: SfField[], keys: string[]) => [...fields.map(columnLine), ...keys]

/** app/Models/<Name>.php for a new model */
export function newModelFile(d: SfEntityDraft, fillable: string[], methods: LinkPlan['methods']): string {
  const own = methods.filter(m => m.model === d.name)
  const types = [...new Set(own.flatMap(m => m.uses))].sort()
  const casts = d.fields.filter(f => castOf[f.type]).map(f => `            '${snake(f.name)}' => '${castOf[f.type]!(f)}',`)
  return `<?php

namespace App\\Models;

use Illuminate\\Database\\Eloquent\\Factories\\HasFactory;
use Illuminate\\Database\\Eloquent\\Model;
${types.map(t => `use ${t};\n`).join('')}
class ${d.name} extends Model
{
    use HasFactory;

    protected $table = '${tableOf(d.name)}';

    /** Filled from a form or an API request */
    protected $fillable = [${fillable.map(f => `'${f}'`).join(', ')}];
${casts.length ? `
    protected function casts(): array
    {
        return [
${casts.join('\n')}
        ];
    }
` : ''}${own.map(m => '\n' + m.code).join('')}}
`
}

function addUses(src: string, uses: string[]): string {
  const missing = uses.filter(u => !new RegExp(`^use\\s+${u.replace(/\\/g, '\\\\')};`, 'm').test(src))
  if (!missing.length) return src
  const lines = missing.map(u => `use ${u};`).join('\n')
  const last = [...src.matchAll(/^use\s+[\w\\]+;\s*$/gm)].pop()
  if (last) { const at = last.index! + last[0].length; return src.slice(0, at) + '\n' + lines + src.slice(at) }
  return src.replace(/^(namespace\s+[\w\\]+;\s*\n)/m, `$1\n${lines}\n`)
}

/** Adds fillable names, casts and relation methods to a model written by hand or by DevForge */
export function extendModel(src: string, fillable: string[], fields: SfField[], methods: LinkPlan['methods']): string {
  let out = src
  const fill = out.match(/(protected\s+\$fillable\s*=\s*\[)([\s\S]*?)(\])/)
  if (fill && fillable.length) {
    const have = [...fill[2].matchAll(/'(\w+)'/g)].map(m => m[1])
    const add = fillable.filter(f => !have.includes(f))
    if (add.length) {
      const body = fill[2].trimEnd()
      const multiline = body.includes('\n')
      const sep = body.replace(/,\s*$/, '') ? (multiline ? ',\n        ' : ', ') : ''
      const joined = add.map(f => `'${f}'`).join(multiline ? ',\n        ' : ', ')
      out = out.replace(fill[0], `${fill[1]}${body.replace(/,\s*$/, '')}${sep}${joined}${multiline ? ',\n    ' : ''}${fill[3]}`)
    }
  }
  const casts = fields.filter(f => castOf[f.type]).map(f => `'${snake(f.name)}' => '${castOf[f.type]!(f)}',`)
  if (casts.length) {
    const fn = out.match(/(function\s+casts\(\)\s*:\s*array\s*\{\s*return\s*\[)([\s\S]*?)(\n\s*\];)/)
    if (fn) out = out.replace(fn[0], `${fn[1]}${fn[2].replace(/,?\s*$/, ',')}\n${casts.map(c => '            ' + c).join('\n')}${fn[3]}`)
    else methods = [{ model: '', method: 'casts', uses: [], code: `    protected function casts(): array\n    {\n        return [\n${casts.map(c => '            ' + c).join('\n')}\n        ];\n    }\n` }, ...methods]
  }
  if (methods.length) {
    const end = out.lastIndexOf('}')
    out = out.slice(0, end).replace(/\s*$/, '\n') + methods.map(m => '\n' + m.code).join('') + out.slice(end)
    out = addUses(out, [...new Set(methods.flatMap(m => m.uses))])
  }
  return out
}

/** "2025_10_25_143000" from a date, plus `offset` seconds: files written together keep their order */
export function migrationStamp(date: Date, offset = 0): string {
  const d = new Date(date.getTime() + offset * 1000)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}_${p(d.getMonth() + 1)}_${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`
}

// ─── API ──────────────────────────────────────────────────────────────────────

export const ROUTES_START = '// DevForge API: start (rewritten by the Laravel workshop)'
export const ROUTES_END = '// DevForge API: end'
const ACTION: Record<SfOperation, string> = { list: 'index', show: 'show', create: 'store', update: 'update', delete: 'destroy' }

/** Validation rules of a field: required to create, optional to update */
function rules(f: { name: string; type: SfFieldType | 'fk'; nullable: boolean; unique: boolean; length?: number; target?: string }, table: string): string {
  const base = f.nullable ? `'nullable'` : '$required'
  const type = {
    string: [`'string'`, `'max:${f.length ?? 255}'`], text: [`'string'`], integer: [`'integer'`], float: [`'numeric'`],
    decimal: [`'numeric'`], boolean: [`'boolean'`], date: [`'date'`], datetime: [`'date'`], json: [`'array'`],
    fk: [`'integer'`, `'exists:${f.target},id'`]
  }[f.type]
  const unique = f.unique ? [`Rule::unique('${table}', '${f.name}')->ignore($id)`] : []
  return `            '${f.name}' => [${[base, ...type, ...unique].join(', ')}],`
}

/** app/Http/Controllers/Api/<Name>Controller.php: the chosen operations, plain Eloquent */
export function controllerFile(e: SfEntity, table: string, ops: SfOperation[], hidden: string[], tableFor: (model: string) => string): string | null {
  if (!ops.length) return null
  const has = (o: SfOperation) => ops.includes(o)
  const { input } = apiFields(e, hidden)
  const writes = has('create') || has('update')
  const fieldRules = writes ? [
    ...e.fields.filter(f => input.includes(f.name)).map(f => rules(f, table)),
    ...e.relations.filter(r => r.fk && input.includes(r.fk)).map(r => rules({ name: r.fk!, type: 'fk', nullable: r.nullable, unique: r.kind === 'OneToOne', target: tableFor(r.target) }, table))
  ] : []
  const unique = fieldRules.some(r => r.includes('Rule::unique'))
  const M = e.name
  const methods = [
    has('list') && `    public function index(): JsonResponse
    {
        return response()->json(${M}::query()->orderBy('id')->get()->makeHidden(self::HIDDEN));
    }`,
    has('show') && `    public function show(string $id): JsonResponse
    {
        return response()->json($this->find($id)->makeHidden(self::HIDDEN));
    }`,
    has('create') && `    public function store(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), $this->rules(null));
        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }
        $item = new ${M}();
        $item->forceFill($validator->safe()->only(self::INPUT))->save();

        return response()->json($item->refresh()->makeHidden(self::HIDDEN), 201);
    }`,
    has('update') && `    public function update(Request $request, string $id): JsonResponse
    {
        $item = $this->find($id);
        $validator = Validator::make($request->all(), $this->rules($item->id));
        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }
        $item->forceFill($validator->safe()->only(self::INPUT))->save();

        return response()->json($item->refresh()->makeHidden(self::HIDDEN));
    }`,
    has('delete') && `    public function destroy(string $id): JsonResponse
    {
        $this->find($id)->delete();

        return response()->json(null, 204);
    }`,
    writes && `    /** Required to create; to update, only what is sent is checked */
    private function rules(?int $id): array
    {
        $required = $id === null ? 'required' : 'sometimes';

        return [
${fieldRules.join('\n')}
        ];
    }`,
    (has('show') || has('update') || has('delete')) && `    /** The record behind the id of the URL, or a 404 */
    private function find(string $id): ${M}
    {
        abort_unless(ctype_digit($id), 404);

        return ${M}::query()->findOrFail((int) $id);
    }`
  ].filter(Boolean)
  return `<?php
${GENERATED_MARK}: rewritten when the API settings change in the Laravel workshop.

namespace App\\Http\\Controllers\\Api;

use App\\Http\\Controllers\\Controller;
use App\\Models\\${M};
use Illuminate\\Http\\JsonResponse;
${writes ? 'use Illuminate\\Http\\Request;\nuse Illuminate\\Support\\Facades\\Validator;\n' : ''}${unique ? 'use Illuminate\\Validation\\Rule;\n' : ''}
class ${M}Controller extends Controller
{
    /** Fields accepted in a request body (links by id: categorie_id) */
    private const INPUT = [${input.map(i => `'${i}'`).join(', ')}];

    /** Fields never sent back */
    private const HIDDEN = [${hidden.map(h => `'${h}'`).join(', ')}];

${methods.join('\n\n')}
}
`
}

/** DevForge's block of routes/api.php: one apiResource per exposed model */
export function routesBlock(routes: { entity: string; ops: SfOperation[] }[]): string {
  const lines = routes.filter(r => r.ops.length).map(r =>
    `Route::apiResource('${apiPath(r.entity).replace(/^\/api\//, '')}', \\App\\Http\\Controllers\\Api\\${r.entity}Controller::class)->only([${r.ops.map(o => `'${ACTION[o]}'`).join(', ')}]);`)
  return [ROUTES_START, ...lines, ROUTES_END].join('\n')
}

/** routes/api.php with DevForge's block replaced (or added at the end) */
export function withRoutesBlock(src: string, block: string): string {
  const start = src.indexOf(ROUTES_START)
  const end = src.indexOf(ROUTES_END)
  if (start >= 0 && end > start) return src.slice(0, start) + block + src.slice(end + ROUTES_END.length)
  return src.replace(/\s*$/, '\n\n') + block + '\n'
}

// ─── Fake data ────────────────────────────────────────────────────────────────

function fakeFor(f: SfField): string | null {
  const php = fakerFor(f)?.replace(/self::faker\(\)->/g, 'fake()->')
  if (php) return php
  switch (f.type) {
    case 'boolean': return 'fake()->boolean()'
    case 'date': return `fake()->date()`
    case 'datetime': return 'fake()->dateTimeBetween(\'-1 year\')'
    case 'json': return '[]'
    default: return null
  }
}

/** database/factories/<Name>Factory.php: a fake value for every field it knows */
export function factoryFile(e: SfEntity): string {
  const lines = e.fields.map(f => ({ f, call: fakeFor(f) })).filter(x => x.call || !x.f.nullable)
    .map(({ f, call }) => `            '${f.name}' => ${call ?? `''`},`)
  return `<?php
${GENERATED_MARK}: rewritten from the Laravel workshop (fake data).

namespace Database\\Factories;

use App\\Models\\${e.name};
use Illuminate\\Database\\Eloquent\\Factories\\Factory;

/** @extends Factory<${e.name}> */
class ${e.name}Factory extends Factory
{
    protected $model = ${e.name}::class;

    public function definition(): array
    {
        return [
${lines.join('\n')}
        ];
    }
}
`
}

/**
 * database/seeders/DevForgeSeeder.php: the chosen counts, parents first,
 * each child linked to a random parent. Throws NEEDS_PARENT when a required
 * link points to a model that gets no rows.
 */
export function seederFile(entities: SfEntity[], counts: Record<string, number>): string {
  const order = creationOrder(entities, counts)
  const missing = order.flatMap(e => e.relations.filter(r => (r.kind === 'ManyToOne' || r.kind === 'OneToOne') && r.fk && !r.nullable && !(counts[r.target] > 0)).map(r => r.target))
  if (missing.length) throw new Error(`NEEDS_PARENT:${[...new Set(missing)].join(', ')}`)
  const v = (name: string) => `$${name.charAt(0).toLowerCase() + name.slice(1)}Ids`
  const uses = [...new Set(order.map(e => e.name))].sort()
  const body: string[] = []
  for (const e of order) {
    const links = e.relations.filter(r => (r.kind === 'ManyToOne' || r.kind === 'OneToOne') && r.fk && counts[r.target] > 0)
    const one = links.find(r => r.kind === 'OneToOne')
    const n = counts[e.name]
    const count = one ? `min(${n}, ${v(one.target)}->count())` : String(n)
    const many = links.filter(r => r.kind === 'ManyToOne')
    let line = `        ${e.name}Factory::new()->count(${count})`
    if (one) line += `\n            ->sequence(fn (Sequence $s) => ['${one.fk}' => ${v(one.target)}[$s->index]])`
    if (many.length) line += `\n            ->state(fn () => [${many.map(r => `'${r.fk}' => ${v(r.target)}->random()`).join(', ')}])`
    body.push(`${line}\n            ->create();`, `        ${v(e.name)} = ${e.name}::query()->pluck('id');`, `        $this->command?->info('${e.name}: ' . ${v(e.name)}->count());`, '')
  }
  // Many-to-many links: two to three random partners each, once both sides exist
  for (const e of order) {
    for (const r of e.relations.filter(x => x.kind === 'ManyToMany' && counts[x.target] > 0)) {
      body.push(`        ${e.name}::query()->each(fn (${e.name} $item) => $item->${r.name}()->syncWithoutDetaching(${v(r.target)}->random(min(${r.target === e.name ? 2 : 3}, ${v(r.target)}->count()))));`)
    }
  }
  const sequence = order.some(e => e.relations.some(r => r.kind === 'OneToOne' && r.fk && counts[r.target] > 0))
  return `<?php
${GENERATED_MARK}: rewritten from the Laravel workshop (fake data).

namespace Database\\Seeders;

${uses.map(u => `use App\\Models\\${u};\n`).join('')}${uses.map(u => `use Database\\Factories\\${u}Factory;\n`).join('')}${sequence ? 'use Illuminate\\Database\\Eloquent\\Factories\\Sequence;\n' : ''}use Illuminate\\Database\\Seeder;

class DevForgeSeeder extends Seeder
{
    public function run(): void
    {
        // The current rows go first, children before parents
${[...order].reverse().map(e => `        ${e.name}::query()->delete();`).join('\n')}

${body.join('\n').replace(/\n+$/, '')}
    }
}
`
}
