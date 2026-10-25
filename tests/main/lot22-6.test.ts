import { execSync } from 'child_process'
import { writeFileSync } from 'fs'
import { join } from 'path'
import { describe, expect, it } from 'vitest'
import { parseSchema, toEntities, writeModel } from '../../src/main/services/nextjs/prismaSchema'
import { routeFiles } from '../../src/main/services/nextjs/nextFiles'
import * as lv from '../../src/main/services/laravel/laravelFiles'
import { nextCommandLine } from '../../src/shared/lib/nextCommands'
import { laravelCommandLine } from '../../src/shared/lib/laravelCommands'
import { planSetup, stepCommand } from '../../src/shared/lib/projectSetup'
import { tempDir } from '../helpers'

const BASE = `generator client {
  provider = "prisma-client"
  output   = "../app/generated/prisma"
}

datasource db {
  provider = "postgresql"
}

model User {
  id    Int    @id @default(autoincrement())
  email String @unique
}
`

function build(): string {
  let s = writeModel(BASE, { name: 'Categorie', existing: false, fields: [{ name: 'nom', type: 'string', nullable: false, unique: true, length: 80 }], relations: [] })
  s = writeModel(s, {
    name: 'Produit', existing: false,
    fields: [
      { name: 'nom', type: 'string', nullable: false, unique: false },
      { name: 'prix', type: 'decimal', nullable: false, unique: false, precision: 10, scale: 2 },
      { name: 'description', type: 'text', nullable: true, unique: false },
      { name: 'ajouteLe', type: 'date', nullable: false, unique: false },
      { name: 'options', type: 'json', nullable: true, unique: false }
    ],
    relations: [{ name: 'categorie', kind: 'ManyToOne', target: 'Categorie', inverse: 'produits', nullable: false }]
  })
  s = writeModel(s, { name: 'Tag', existing: false, fields: [{ name: 'libelle', type: 'string', nullable: false, unique: false }], relations: [{ name: 'produits', kind: 'ManyToMany', target: 'Produit', inverse: 'tags', nullable: true }] })
  s = writeModel(s, { name: 'Profil', existing: false, fields: [{ name: 'bio', type: 'text', nullable: true, unique: false }], relations: [{ name: 'user', kind: 'OneToOne', target: 'User', inverse: null, nullable: false }] })
  s = writeModel(s, { name: 'Commande', existing: false, fields: [], relations: [
    { name: 'client', kind: 'ManyToOne', target: 'User', inverse: 'commandes', nullable: false },
    { name: 'parent', kind: 'ManyToOne', target: 'Commande', inverse: 'enfants', nullable: true }
  ] })
  return writeModel(s, { name: 'User', existing: true, fields: [{ name: 'age', type: 'integer', nullable: true, unique: false }], relations: [] })
}

describe('v2.2 lot 6: Prisma schema', () => {
  it('reads models as entities, relations on both sides', () => {
    const e = toEntities(parseSchema(build()))
    expect(e.map(x => x.name)).toEqual(['Categorie', 'Commande', 'Produit', 'Profil', 'Tag', 'User'])
    const produit = e.find(x => x.name === 'Produit')!
    expect(produit.fields.map(f => `${f.name}:${f.type}${f.nullable ? '?' : ''}`)).toEqual(['nom:string', 'prix:decimal', 'description:text?', 'ajouteLe:date', 'options:json?', 'createdAt:datetime'])
    expect(produit.relations).toEqual([
      { name: 'categorie', kind: 'ManyToOne', target: 'Categorie', inverse: 'produits', nullable: false, fk: 'categorieId' },
      { name: 'tags', kind: 'ManyToMany', target: 'Tag', inverse: 'produits', nullable: false }
    ])
    const user = e.find(x => x.name === 'User')!
    expect(user.relations.map(r => `${r.name}:${r.kind}>${r.target}`).sort()).toEqual(['commandes:OneToMany>Commande', 'profil:OneToOne>Profil'])
    expect(user.fields.map(f => f.name)).toEqual(['email', 'age'])
  })

  it('names a link to itself on both sides', () => {
    const s = build()
    expect(s).toContain('@relation("CommandeParent", fields: [parentId], references: [id])')
    expect(s).toMatch(/enfants\s+Commande\[\] @relation\("CommandeParent"\)/)
  })

  it('refuses a field that exists', () => {
    expect(() => writeModel(build(), { name: 'User', existing: true, fields: [{ name: 'email', type: 'string', nullable: false, unique: false }], relations: [] })).toThrow('EXISTS:email')
  })

  // The real Prisma says whether the written schema is valid
  it.runIf(process.env.DEVFORGE_NEXT_DIR)('prisma validate accepts it', () => {
    const dir = tempDir('prisma')
    const file = join(dir, 'schema.prisma')
    writeFileSync(file, build())
    const out = execSync(`npx prisma validate --schema "${file}"`, { cwd: process.env.DEVFORGE_NEXT_DIR, encoding: 'utf-8', env: { ...process.env, DATABASE_URL: 'postgresql://a:b@localhost:5432/c' } })
    expect(out).toMatch(/valid/i)
  }, 120_000)
})

describe('v2.2 lot 6: Next.js files and commands', () => {
  const produit = toEntities(parseSchema(build())).find(e => e.name === 'Produit')!
  const imports = { collection: { client: '../../generated/prisma/client', lib: '../../../lib/prisma' }, item: { client: '../../../generated/prisma/client', lib: '../../../../lib/prisma' } }

  it('prepares a migration without running it, then applies and generates', () => {
    expect(nextCommandLine('prisma:migrate', 'npm', 'catalogue')).toBe('npx prisma migrate dev --create-only --name catalogue')
    expect(nextCommandLine('prisma:deploy', 'npm')).toBe('npx prisma migrate deploy && npx prisma generate')
    expect(nextCommandLine('install:client', 'pnpm', 'postgresql')).toBe('pnpm add @prisma/client @prisma/adapter-pg && npx prisma generate')
    expect(nextCommandLine('prisma:migrate', 'npm', 'Bad Name')).toBe('')
  })

  it('writes route handlers: casts, 404 for a bad or missing id, only the chosen operations', () => {
    const f = routeFiles(produit, ['list', 'show', 'create', 'update', 'delete'], ['description'], true, imports)
    expect(f.collection).toContain('data: data as Prisma.ProduitUncheckedCreateInput')
    expect(f.collection).not.toContain('NOT_FOUND')
    expect(f.item).toContain("err.code === 'P2025') return NOT_FOUND()")
    expect(f.item).toContain('const id = await idOf(params)')
    expect(f.item).toMatch(/OMIT = \{ description: true \}/)
    const only = routeFiles(produit, ['list'], [], true, imports)
    expect(only.item).toBeNull()
    expect(only.collection).not.toContain('export async function POST')
  })
})

describe('v2.2 lot 6: Laravel', () => {
  type Draft = Parameters<typeof lv.planLinks>[1]
  type Fields = Parameters<typeof lv.createLines>[0]
  const tableFor = (m: string) => lv.tableOf(m)

  /** What writeModel does, in memory: model files and migrations */
  function project() {
    const files = new Map<string, string>()
    const migrations: string[] = []
    const save = (owner: string, relations: Draft, raw: Fields) => {
      const plan = lv.planLinks(owner, relations, tableFor)
      const own = plan.keys.filter(k => k.table === tableFor(owner))
      const fields = raw.map(f => ({ ...f, name: lv.snake(f.name) }))
      const fill = (m: string) => [...(m === owner ? fields.map(f => f.name) : []), ...plan.keys.filter(k => k.table === tableFor(m)).map(k => k.column)]
      const existing = files.has(owner)
      const others = [...new Set(plan.keys.filter(k => k.table !== tableFor(owner)).map(k => k.table))]
      migrations.push(lv.migrationFile(
        [...(existing ? [] : [{ table: tableFor(owner), lines: lv.createLines(fields, own.map(k => k.line)) }]), ...plan.pivots],
        [
          ...(existing ? [{ table: tableFor(owner), lines: lv.addLines(fields, own.map(k => k.line)), columns: [...fields.map(f => f.name), ...own.map(k => k.column)] }] : []),
          ...others.map(t => ({ table: t, lines: plan.keys.filter(k => k.table === t).map(k => k.line), columns: plan.keys.filter(k => k.table === t).map(k => k.column) }))
        ]
      ))
      files.set(owner, existing
        ? lv.extendModel(files.get(owner)!, fill(owner), fields, plan.methods.filter(m => m.model === owner))
        : lv.newModelFile({ name: owner, existing: false, fields, relations }, fill(owner), plan.methods))
      for (const t of new Set(plan.methods.map(m => m.model).filter(m => m !== owner))) {
        files.set(t, lv.extendModel(files.get(t)!, fill(t), [], plan.methods.filter(m => m.model === t)))
      }
    }
    save('Categorie', [], [{ name: 'nom', type: 'string', nullable: false, unique: true, length: 80 }])
    save('Produit', [{ name: 'categorie', kind: 'ManyToOne', target: 'Categorie', inverse: 'produits', nullable: false }], [
      { name: 'nom', type: 'string', nullable: false, unique: false },
      { name: 'prix', type: 'decimal', nullable: false, unique: false, precision: 10, scale: 2 },
      { name: 'enVente', type: 'boolean', nullable: false, unique: false },
      { name: 'notes', type: 'text', nullable: true, unique: false }
    ])
    save('Tag', [], [{ name: 'libelle', type: 'string', nullable: false, unique: true }])
    save('Produit', [{ name: 'tags', kind: 'ManyToMany', target: 'Tag', inverse: 'produits', nullable: true }], [{ name: 'poids', type: 'float', nullable: true, unique: false }])
    save('Categorie', [{ name: 'parent', kind: 'ManyToOne', target: 'Categorie', inverse: 'enfants', nullable: true }], [])
    const entities = lv.toEntities([...files].map(([n, php]) => lv.readModel(n, `app/Models/${n}.php`, php)), lv.readMigrations(migrations))
    return { files, migrations, entities }
  }

  it('reads back what it writes: fields from the migrations, links from the models', () => {
    const { files, migrations, entities } = project()
    const produit = entities.find(e => e.name === 'Produit')!
    expect(produit.table).toBe('produits')
    expect(produit.fields.map(f => `${f.name}:${f.type}${f.nullable ? '?' : ''}`)).toEqual(['nom:string', 'prix:decimal', 'en_vente:boolean', 'notes:text?', 'poids:float?'])
    expect(produit.relations).toEqual([
      { name: 'categorie', kind: 'ManyToOne', target: 'Categorie', inverse: 'produits', nullable: false, fk: 'categorie_id' },
      { name: 'tags', kind: 'ManyToMany', target: 'Tag', inverse: 'produits', nullable: true }
    ])
    const categorie = entities.find(e => e.name === 'Categorie')!
    expect(categorie.fields).toEqual([{ name: 'nom', type: 'string', nullable: false, unique: true, length: 80 }])
    expect(categorie.relations.map(r => `${r.name}:${r.kind}:${r.inverse}`)).toEqual(['produits:OneToMany:categorie', 'parent:ManyToOne:enfants', 'enfants:OneToMany:parent'])
    expect(files.get('Produit')).toContain("protected $fillable = ['nom', 'prix', 'en_vente', 'notes', 'categorie_id', 'poids'];")
    expect(files.get('Produit')).toContain("'en_vente' => 'boolean',\n            'poids' => 'float',")
    expect(files.get('Tag')).toMatch(/use Illuminate\\Database\\Eloquent\\Relations\\BelongsToMany;/)
    expect(migrations[3]).toContain("Schema::create('produit_tag'")
    expect(migrations[3]).toContain("$table->dropColumn(['poids']);")
  })

  it('follows a migration that drops or renames a column, or a table', () => {
    const t = lv.readMigrations([
      "public function up(): void { Schema::create('notes', function (Blueprint $table) {\n$table->id();\n$table->string('titre', 100);\n$table->string('vieux');\n$table->foreignId('user_id')->nullable()->constrained();\n});\nSchema::create('tmp', function (Blueprint $table) {\n$table->id();\n});\n}\npublic function down(): void { Schema::dropIfExists('notes'); }",
      "public function up(): void { Schema::table('notes', function (Blueprint $table) {\n$table->dropColumn('vieux');\n$table->renameColumn('titre', 'nom');\n$table->unique('nom');\n});\nSchema::drop('tmp');\n}"
    ])
    expect([...t.keys()]).toEqual(['notes'])
    expect(t.get('notes')).toEqual([{ name: 'nom', type: 'string', nullable: false, unique: true, length: 100 }, { name: 'user_id', type: 'fk', nullable: true, unique: false }])
  })

  it('reads migrate:status and migrate --pretend', () => {
    const st = lv.parseMigrateStatus('  Migration name .............. Batch / Status\n  0001_01_01_000000_create_users_table ........ [1] Ran\n  2026_10_25_120000_create_produits_table ...... Pending\n')
    expect([...st.ran]).toEqual([['0001_01_01_000000_create_users_table', true], ['2026_10_25_120000_create_produits_table', false]])
    expect(lv.parseMigrateStatus('   ERROR  Migration table not found.').tableMissing).toBe(true)
    const sql = lv.parsePretend('   INFO  Running migrations.\n\n  2026_10_25_120000_create_produits_table .............\n  ⇂ create table "produits" ("id" bigserial not null primary key)\n  ⇂ alter table "produits" add constraint "x" unique ("nom")\n')
    expect(sql.get('2026_10_25_120000_create_produits_table')).toEqual(['create table "produits" ("id" bigserial not null primary key)', 'alter table "produits" add constraint "x" unique ("nom")'])
    expect(lv.migrationLabel('2026_10_25_120000_create_produits_table')).toBe('create produits table')
  })

  it('writes a controller with validation, and the routes block', () => {
    const { entities } = project()
    const produit = entities.find(e => e.name === 'Produit')!
    const php = lv.controllerFile(produit, 'produits', ['list', 'show', 'create', 'update', 'delete'], ['notes'], tableFor)!
    expect(php).toContain("private const INPUT = ['nom', 'prix', 'en_vente', 'poids', 'categorie_id'];")
    expect(php).toContain("'categorie_id' => [$required, 'integer', 'exists:categories,id'],")
    expect(php).toContain("'poids' => ['nullable', 'numeric'],")
    expect(php).toContain('abort_unless(ctype_digit($id), 404);')
    expect(php).not.toContain('Rule::unique')
    expect(lv.controllerFile(produit, 'produits', [], [], tableFor)).toBeNull()
    const cat = lv.controllerFile(entities.find(e => e.name === 'Categorie')!, 'categories', ['list', 'create'], [], tableFor)!
    expect(cat).toContain("Rule::unique('categories', 'nom')->ignore($id)")
    expect(cat).not.toContain('function find(')

    const block = lv.routesBlock([{ entity: 'Produit', ops: ['list', 'create'] }, { entity: 'LigneCommande', ops: ['show'] }, { entity: 'Tag', ops: [] }])
    expect(block).toContain("Route::apiResource('produits', \\App\\Http\\Controllers\\Api\\ProduitController::class)->only(['index', 'store']);")
    expect(block).toContain("Route::apiResource('ligne_commandes',")
    const once = lv.withRoutesBlock("<?php\n\nRoute::get('/user', fn () => 1);\n", block)
    expect(lv.withRoutesBlock(once, lv.routesBlock([]))).toBe(`<?php\n\nRoute::get('/user', fn () => 1);\n\n${lv.ROUTES_START}\n${lv.ROUTES_END}\n`)
  })

  it('seeds parents first, and needs the parent of a required link', () => {
    const { entities } = project()
    const php = lv.seederFile(entities, { Categorie: 4, Produit: 20, Tag: 5 })
    expect(php.indexOf('CategorieFactory::new()')).toBeLessThan(php.indexOf('ProduitFactory::new()'))
    expect(php).toContain("->state(fn () => ['categorie_id' => $categorieIds->random()])")
    expect(php).toContain('$item->tags()->syncWithoutDetaching(')
    expect(php.indexOf('Produit::query()->delete();')).toBeLessThan(php.indexOf('Categorie::query()->delete();'))
    expect(() => lv.seederFile(entities, { Produit: 3 })).toThrow('NEEDS_PARENT:Categorie')
    expect(lv.factoryFile(entities.find(e => e.name === 'Produit')!)).toContain("'en_vente' => fake()->boolean(),")
  })

  it('creates the project: DB_* in .env, Sanctum and CI', () => {
    expect(laravelCommandLine('make:migration', 'add_prix')).toBe('php artisan make:migration add_prix')
    expect(laravelCommandLine('migrate:rollback')).toBe('php artisan migrate:rollback --step=1 --no-interaction')
    const steps = planSetup({
      name: 'atelier', framework: 'laravel', packageManager: 'npm', typescript: false, eslint: false,
      setup: { database: 'postgres', dbName: 'atelier', dbPort: 5461, features: ['api', 'ci'], git: false, github: null, openVSCode: false }
    }, { password: 'pw', secret: 's', lang: 'fr', composeName: 'atelier-a1b2c3' })
    const env = steps.find(s => s.kind === 'env' && s.file === '.env')
    expect(env?.kind === 'env' && env.vars).toEqual({ DB_CONNECTION: 'pgsql', DB_HOST: '127.0.0.1', DB_PORT: '5461', DB_DATABASE: 'atelier', DB_USERNAME: 'app', DB_PASSWORD: 'pw' })
    const lines = steps.map(stepCommand).join('\n')
    expect(lines).toContain('php artisan install:api --without-migration-prompt --no-interaction')
    expect(lines).toContain('+ .github/workflows/ci.yml')
    expect(lines).toContain('+ compose.yaml')
  })
})
