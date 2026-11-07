import { expect, test } from '@playwright/test'
import { existsSync, mkdirSync, writeFileSync } from 'fs'
import { join } from 'path'
import { launch, type Launched } from './launch'

/** v2.3 lot 6: Forgy in the Laravel workshop (scripted model, status canned) */
let run: Launched
test.afterEach(async () => {
  expect(run.errors, 'uncaught page errors').toEqual([])
  await run.close()
})

const USER_PHP = "<?php\n\nnamespace App\\Models;\n\nuse Illuminate\\Foundation\\Auth\\User as Authenticatable;\n\nclass User extends Authenticatable\n{\n    protected $fillable = ['name', 'email'];\n}\n"
const USERS = "<?php\n\nreturn new class extends Migration\n{\n    public function up(): void\n    {\n        Schema::create('users', function (Blueprint $table) {\n            $table->id();\n            $table->string('email')->unique();\n        });\n    }\n};\n"

test('Forgy fills the Laravel form, and explains a pending migration', async () => {
  let dir = ''
  run = await launch({
    env: { DEVFORGE_TEST_LARAVEL: '{userData}/laravel.json', DEVFORGE_E2E_ASSISTANT_SCRIPT: '{userData}/script.json' },
    seed: data => {
      dir = join(data, 'atelier')
      mkdirSync(join(dir, 'app', 'Models'), { recursive: true })
      mkdirSync(join(dir, 'database', 'migrations'), { recursive: true })
      writeFileSync(join(dir, 'composer.json'), JSON.stringify({ require: { 'laravel/framework': '^13.0' } }))
      writeFileSync(join(dir, 'app', 'Models', 'User.php'), USER_PHP)
      writeFileSync(join(dir, 'database', 'migrations', '0001_01_01_000000_create_users_table.php'), USERS)
      writeFileSync(join(data, 'projects.json'), JSON.stringify([
        { id: 'lv', name: 'atelier', path: dir, framework: 'laravel', packageManager: 'npm', favorite: false, createdAt: '2026-01-01T00:00:00.000Z', lastOpenedAt: null }
      ]))
      writeFileSync(join(data, 'laravel.json'), JSON.stringify({
        status: { booted: true, error: null, version: '13.38.0', connection: 'pgsql', database: { reachable: true, error: null }, composeDatabase: true, api: true, faker: true, sail: false, appUrl: 'http://127.0.0.1:8000' },
        migrations: [{ version: '2026_10_25_120000_create_factures_table', description: 'create factures table', executed: false, executedAt: null, file: 'database/migrations/2026_10_25_120000_create_factures_table.php', sql: ['create table "factures" ("id" bigserial not null primary key)'], dangerous: false }],
        routes: []
      }))
      writeFileSync(join(data, 'script.json'), JSON.stringify([
        { stop_reason: 'tool_use', content: [{ type: 'tool_use', id: 't1', name: 'workshop_model_draft', input: { project: 'atelier', entity: 'Facture', fields: [{ name: 'numero', type: 'string' }], relations: [{ name: 'user', kind: 'ManyToOne', target: 'User', inverse: 'factures' }] } }] },
        { stop_reason: 'end_turn', content: [{ type: 'text', text: 'Le formulaire est prêt dans l\'atelier Laravel.' }] },
        { stop_reason: 'end_turn', content: [{ type: 'text', text: 'Elle crée la table factures, rien n\'est supprimé.' }] }
      ]))
    }
  })
  const { page } = run
  await page.keyboard.press('Control+J')
  const input = page.getByPlaceholder('Demande à Forgy…')
  await input.fill('Ajoute une facture liée au client dans atelier')
  await input.press('Enter')

  // The workshop opens on the form, filled in; nothing written yet
  await expect(page.getByRole('navigation', { name: 'Atelier Laravel' })).toBeVisible()
  await expect(page.getByLabel('Nom (une majuscule au début, sans espace)')).toHaveValue('Facture')
  await expect(page.getByRole('textbox', { name: 'Nom', exact: true }).first()).toHaveValue('numero')
  await expect(page.getByText('Chaque Facture appartient à un(e) User')).toBeVisible()
  await expect(page.getByText('Le formulaire est prêt dans l\'atelier Laravel.')).toBeVisible()
  expect(existsSync(join(dir, 'app', 'Models', 'Facture.php'))).toBe(false)

  // A pending migration explained by Forgy, its SQL in the question
  await page.getByRole('button', { name: 'Annuler' }).click()
  await page.getByRole('navigation', { name: 'Atelier Laravel' }).getByRole('button', { name: /Migrations/ }).click()
  await page.getByRole('button', { name: 'Expliquer avec Forgy' }).click()
  await expect(page.getByText('create table "factures"').last()).toBeVisible()
  await expect(page.getByText('Elle crée la table factures, rien n\'est supprimé.')).toBeVisible()
})
