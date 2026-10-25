import { expect, test } from '@playwright/test'
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'fs'
import { join } from 'path'
import { goTo, launch, type Launched } from './launch'
import { settledAxeIssues as settledAxe } from './axe'

/** v2.2 lot 6: the Next.js and Laravel workshops (CLI answers canned, files really written) */
let run: Launched
test.afterEach(async () => {
  expect(run.errors, 'uncaught page errors').toEqual([])
  await run.close()
})

const project = (id: string, name: string, path: string, framework: string) =>
  ({ id, name, path, framework, packageManager: 'npm', favorite: false, createdAt: '2026-01-01T00:00:00.000Z', lastOpenedAt: null })

// ─── Next.js ──────────────────────────────────────────────────────────────────

const SCHEMA = `generator client {
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

async function openNext(): Promise<string> {
  let dir = ''
  run = await launch({
    env: { DEVFORGE_TEST_NEXTJS: '{userData}/nextjs.json' },
    seed: data => {
      dir = join(data, 'site')
      mkdirSync(join(dir, 'prisma'), { recursive: true })
      mkdirSync(join(dir, 'app'), { recursive: true })
      writeFileSync(join(dir, 'package.json'), JSON.stringify({ dependencies: { next: '16.0.0' }, devDependencies: { prisma: '7.0.0' } }))
      writeFileSync(join(dir, 'tsconfig.json'), '{}')
      writeFileSync(join(dir, 'prisma', 'schema.prisma'), SCHEMA)
      writeFileSync(join(data, 'projects.json'), JSON.stringify([project('nx', 'site', dir, 'nextjs')]))
      writeFileSync(join(data, 'nextjs.json'), JSON.stringify({
        database: { reachable: true, error: null },
        migrations: [{ version: '20261025180000_catalogue', description: 'catalogue', executed: false, executedAt: null, file: 'prisma/migrations/20261025180000_catalogue/migration.sql', sql: ['CREATE TABLE "Produit" ("id" SERIAL NOT NULL)'], dangerous: false }]
      }))
    }
  })
  await goTo(run.page, '/project/nx?tab=nextjs')
  await expect(run.page.getByRole('navigation', { name: 'Atelier Next.js' })).toBeVisible()
  return dir
}

test('Next.js: a model written in schema.prisma, a migration prepared before it runs', async () => {
  const dir = await openNext()
  const { page } = run
  await expect(page.getByRole('tab', { name: 'Next.js' })).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByRole('article', { name: 'User' })).toContainText('email')
  expect(await settledAxe(page)).toEqual([])

  await page.getByRole('button', { name: 'Nouvelle entité' }).click()
  await page.getByLabel('Nom (une majuscule au début, sans espace)').fill('Produit')
  await page.getByRole('textbox', { name: 'Nom', exact: true }).first().fill('nom')
  await page.getByRole('button', { name: 'Ajouter un lien' }).click()
  await expect(page.getByText('~ prisma/schema.prisma')).toBeVisible()
  await page.getByRole('button', { name: "Créer l'entité" }).click()
  await expect(page.getByText('1 fichier(s) écrit(s)')).toBeVisible()
  const schema = readFileSync(join(dir, 'prisma', 'schema.prisma'), 'utf-8')
  expect(schema).toContain('model Produit {')
  expect(schema).toMatch(/produits\s+Produit\[\]/)

  const nav = page.getByRole('navigation', { name: 'Atelier Next.js' })
  await nav.getByRole('button', { name: /Migrations/ }).click()
  await expect(nav.getByRole('button', { name: /Migrations/ })).toContainText('1 en attente')
  await expect(page.getByText('npx prisma migrate dev --create-only --name modification')).toBeVisible()
  await page.getByLabel('Nom de la migration (minuscules, chiffres, _)').fill('Ajout Produit')
  await expect(page.getByText('npx prisma migrate dev --create-only --name ajout_produit')).toBeVisible()
  await expect(page.getByText('npx prisma migrate deploy && npx prisma generate')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Revenir en arrière' })).toHaveCount(0)
  await expect(page.getByLabel('SQL de la migration')).toContainText('CREATE TABLE "Produit"')
  expect(await settledAxe(page)).toEqual([])

  await nav.getByRole('button', { name: 'API' }).click()
  await expect(page.getByRole('radiogroup')).toHaveCount(0)
  await expect(page.getByText("lib/prisma.ts n'existe pas")).toHaveCount(0)
  await expect(page.getByText("Écris d'abord lib/prisma.ts (onglet Base et Prisma).")).toBeVisible()
  await nav.getByRole('button', { name: /Base et Prisma/ }).click()
  await expect(page.getByText('Prisma 7 · postgresql')).toBeVisible()
  await expect(page.getByText('npm install @prisma/client @prisma/adapter-pg && npx prisma generate')).toBeVisible()
  expect(await settledAxe(page)).toEqual([])
})

// ─── Laravel ──────────────────────────────────────────────────────────────────

const USER_PHP = `<?php

namespace App\\Models;

use Illuminate\\Database\\Eloquent\\Factories\\HasFactory;
use Illuminate\\Foundation\\Auth\\User as Authenticatable;

class User extends Authenticatable
{
    use HasFactory;

    protected $fillable = [
        'name',
        'email',
        'password',
    ];
}
`
const USERS_MIGRATION = `<?php

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('users', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('email')->unique();
            $table->string('password');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('users');
    }
};
`

async function openLaravel(): Promise<string> {
  let dir = ''
  run = await launch({
    env: { DEVFORGE_TEST_LARAVEL: '{userData}/laravel.json' },
    seed: data => {
      dir = join(data, 'atelier')
      mkdirSync(join(dir, 'app', 'Models'), { recursive: true })
      mkdirSync(join(dir, 'database', 'migrations'), { recursive: true })
      mkdirSync(join(dir, 'routes'), { recursive: true })
      writeFileSync(join(dir, 'composer.json'), JSON.stringify({ require: { 'laravel/framework': '^12.0' } }))
      writeFileSync(join(dir, 'app', 'Models', 'User.php'), USER_PHP)
      writeFileSync(join(dir, 'database', 'migrations', '0001_01_01_000000_create_users_table.php'), USERS_MIGRATION)
      writeFileSync(join(dir, 'routes', 'api.php'), "<?php\n\nuse Illuminate\\Support\\Facades\\Route;\n")
      writeFileSync(join(data, 'projects.json'), JSON.stringify([project('lv', 'atelier', dir, 'laravel')]))
      writeFileSync(join(data, 'laravel.json'), JSON.stringify({
        status: { booted: true, error: null, version: '12.30.1', connection: 'pgsql', database: { reachable: true, error: null }, composeDatabase: true, api: true, faker: true },
        migrations: [
          { version: '2026_10_25_120000_create_factures_table', description: 'create factures table', executed: false, executedAt: null, file: 'database/migrations/2026_10_25_120000_create_factures_table.php', sql: ['create table "factures" ("id" bigserial not null primary key)'], dangerous: false },
          { version: '0001_01_01_000000_create_users_table', description: 'create users table', executed: true, executedAt: null, file: 'database/migrations/0001_01_01_000000_create_users_table.php', sql: [], dangerous: false }
        ],
        routes: [{ name: 'factures.index', path: '/api/factures', methods: ['GET'], controller: 'App\\Http\\Controllers\\Api\\FactureController@index' }]
      }))
    }
  })
  await goTo(run.page, '/project/lv?tab=laravel')
  await expect(run.page.getByRole('navigation', { name: 'Atelier Laravel' })).toBeVisible()
  return dir
}

test('Laravel: a model and its migration, the other side of the link, then the API', async () => {
  const dir = await openLaravel()
  const { page } = run
  await expect(page.getByRole('tab', { name: 'Laravel' })).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByRole('article', { name: 'User' })).toContainText('email')
  expect(await settledAxe(page)).toEqual([])

  await page.getByRole('button', { name: 'Nouvelle entité' }).click()
  await page.getByLabel('Nom (une majuscule au début, sans espace)').fill('Facture')
  await page.getByRole('textbox', { name: 'Nom', exact: true }).first().fill('numero')
  await page.getByRole('button', { name: 'Ajouter un lien' }).click()
  await page.getByRole('combobox', { name: 'Entité liée' }).selectOption('User')
  await expect(page.getByText('~ app/Models/User.php')).toBeVisible()
  await page.getByRole('button', { name: "Créer l'entité" }).click()
  await expect(page.getByText('3 fichier(s) écrit(s)')).toBeVisible()
  expect(readFileSync(join(dir, 'app', 'Models', 'Facture.php'), 'utf-8')).toContain("return $this->belongsTo(User::class, 'user_id');")
  expect(readFileSync(join(dir, 'app', 'Models', 'User.php'), 'utf-8')).toContain("return $this->hasMany(Facture::class, 'user_id');")
  const migration = readdirSync(join(dir, 'database', 'migrations')).find(n => n.endsWith('_create_factures_table.php'))!
  expect(readFileSync(join(dir, 'database', 'migrations', migration), 'utf-8')).toContain("$table->foreignId('user_id')->constrained('users')->cascadeOnDelete();")
  await expect(page.getByRole('article', { name: 'Facture' })).toContainText('numero')

  const nav = page.getByRole('navigation', { name: 'Atelier Laravel' })
  await nav.getByRole('button', { name: /Migrations/ }).click()
  await expect(page.getByText('php artisan make:migration modification')).toBeVisible()
  await expect(page.getByText('php artisan migrate --no-interaction')).toBeVisible()
  await expect(page.getByText('php artisan migrate:rollback --step=1 --no-interaction')).toBeVisible()
  await expect(page.getByLabel('SQL de la migration')).toContainText('create table "factures"')
  expect(await settledAxe(page)).toEqual([])

  await nav.getByRole('button', { name: 'API' }).click()
  await page.getByRole('checkbox', { name: 'Lister Facture' }).check({ force: true })
  await expect(page.getByRole('listitem', { name: 'Facture' })).toContainText('/api/factures')
  await page.getByRole('button', { name: "Appliquer à l'API" }).click()
  await expect(page.getByText('2 fichier(s) écrit(s)')).toBeVisible()
  expect(existsSync(join(dir, 'app', 'Http', 'Controllers', 'Api', 'FactureController.php'))).toBe(true)
  expect(readFileSync(join(dir, 'routes', 'api.php'), 'utf-8')).toContain("Route::apiResource('factures', \\App\\Http\\Controllers\\Api\\FactureController::class)->only(['index']);")
  expect(await settledAxe(page)).toEqual([])

  await nav.getByRole('button', { name: 'Routes' }).click()
  await expect(page.getByRole('list', { name: 'Routes · 1' })).toContainText('/api/factures')
  await nav.getByRole('button', { name: /Fausses données/ }).click()
  await expect(page.getByText('php artisan db:seed --class=DevForgeSeeder --no-interaction')).toBeVisible()
  await nav.getByRole('button', { name: 'Serveur' }).click()
  await expect(page.getByText('php artisan serve', { exact: true })).toBeVisible()
  expect(await settledAxe(page)).toEqual([])
})
