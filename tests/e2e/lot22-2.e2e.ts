import { expect, test } from '@playwright/test'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { goTo, launch, type Launched } from './launch'
import { settledAxeIssues as settledAxe } from './axe'

/** v2.2 lot 2: the Symfony workshop (project reading canned, files really written) */
let run: Launched
test.afterEach(async () => {
  expect(run.errors, 'uncaught page errors').toEqual([])
  await run.close()
})

const USER_PHP = '<?php\n\nnamespace App\\Entity;\n\nuse Doctrine\\ORM\\Mapping as ORM;\n\n#[ORM\\Entity]\nclass User\n{\n    #[ORM\\Id]\n    #[ORM\\Column]\n    private ?int $id = null;\n\n    public function getId(): ?int\n    {\n        return $this->id;\n    }\n}\n'

const status = {
  symfony: true, booted: true, error: null, version: '7.3.4',
  database: { configured: true, driver: 'pdo_pgsql', target: '127.0.0.1:5433/boutique', reachable: true, error: null },
  composeDatabase: true, symfonyCli: true, hasUserEntity: true,
  packages: { orm: true, maker: true, apiPlatform: false, serializer: true, validator: true, security: true, fixtures: false, foundry: false }
}
const entities = [
  { name: 'Categorie', table: 'categorie', file: 'src/Entity/Categorie.php', apiResource: false, fields: [{ name: 'nom', type: 'string', nullable: false, unique: true, length: 80 }], relations: [{ name: 'produits', kind: 'OneToMany', target: 'Produit', inverse: 'categorie', nullable: false }] },
  { name: 'Produit', table: 'produit', file: 'src/Entity/Produit.php', apiResource: false, fields: [{ name: 'nom', type: 'string', nullable: false, unique: false }, { name: 'prix', type: 'decimal', nullable: false, unique: false, precision: 10, scale: 2 }, { name: 'stock', type: 'integer', nullable: false, unique: false }], relations: [{ name: 'categorie', kind: 'ManyToOne', target: 'Categorie', inverse: 'produits', nullable: false }] },
  { name: 'User', table: 'user', file: 'src/Entity/User.php', apiResource: false, fields: [{ name: 'email', type: 'string', nullable: false, unique: true, length: 180 }, { name: 'password', type: 'string', nullable: false, unique: false }], relations: [] }
]
const migrations = [
  { version: 'DoctrineMigrations\\Version20261025160000', description: 'Ajout de Facture', executed: false, executedAt: null, file: 'migrations/Version20261025160000.php', sql: ['CREATE TABLE facture (id INT NOT NULL, numero VARCHAR(30) NOT NULL, PRIMARY KEY(id))'], dangerous: false },
  { version: 'DoctrineMigrations\\Version20261024100000', description: '', executed: true, executedAt: '2026-10-24 10:00:00', file: 'migrations/Version20261024100000.php', sql: ['CREATE TABLE produit (id INT NOT NULL)'], dangerous: false }
]

async function openWorkshop(): Promise<{ project: string }> {
  let project = ''
  run = await launch({
    env: { DEVFORGE_TEST_SYMFONY: '{userData}/symfony.json' },
    seed: dir => {
      project = join(dir, 'boutique')
      mkdirSync(join(project, 'src', 'Entity'), { recursive: true })
      writeFileSync(join(project, 'composer.json'), JSON.stringify({ require: { 'symfony/framework-bundle': '7.3.*' } }))
      writeFileSync(join(project, 'src', 'Entity', 'User.php'), USER_PHP)
      writeFileSync(join(dir, 'projects.json'), JSON.stringify([
        { id: 'sf', name: 'boutique', path: project, framework: 'symfony', packageManager: 'npm', favorite: false, createdAt: '2026-01-01T00:00:00.000Z', lastOpenedAt: null }
      ]))
      writeFileSync(join(dir, 'symfony.json'), JSON.stringify({
        inspect: { status, entities, migrations },
        serverUrl: 'http://127.0.0.1:8000',
        routes: [{ name: 'api_health', path: '/api/health', methods: ['GET'], controller: 'App\\Controller\\HealthController' }, { name: 'app_produit_show', path: '/produits/{id}', methods: ['GET'], controller: 'App\\Controller\\ProduitController::show' }]
      }))
    }
  })
  await goTo(run.page, '/project/sf?tab=symfony')
  await expect(run.page.getByRole('navigation', { name: 'Atelier Symfony' })).toBeVisible()
  return { project }
}

test('entities: schema, then a new entity linked to User, written on disk', async () => {
  const { project } = await openWorkshop()
  const { page } = run
  await expect(page.getByRole('tab', { name: 'Symfony' })).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByRole('article', { name: 'Produit' })).toContainText('categorie')
  expect(await settledAxe(page)).toEqual([])

  await page.getByRole('button', { name: 'Nouvelle entité' }).click()
  await page.getByLabel('Nom (une majuscule au début, sans espace)').fill('Facture')
  await page.getByRole('textbox', { name: 'Nom', exact: true }).first().fill('numero')
  await page.getByRole('button', { name: 'Ajouter un lien' }).click()
  await page.getByRole('combobox', { name: 'Entité liée' }).selectOption('User')
  await expect(page.getByText('Chaque Facture appartient à un(e) User')).toBeVisible()
  await expect(page.getByText('~ src/Entity/User.php')).toBeVisible()
  expect(await settledAxe(page)).toEqual([])
  await page.getByRole('button', { name: "Créer l'entité" }).click()

  await expect(page.getByText('3 fichier(s) écrit(s)')).toBeVisible()
  expect(readFileSync(join(project, 'src', 'Entity', 'Facture.php'), 'utf-8')).toContain("#[ORM\\ManyToOne(inversedBy: 'factures')]")
  expect(readFileSync(join(project, 'src', 'Entity', 'User.php'), 'utf-8')).toContain('public function addFacture(Facture $facture): static')
  expect(existsSync(join(project, 'src', 'Repository', 'FactureRepository.php'))).toBe(true)
})

test('migrations, API, routes and server: each button shows its command', async () => {
  await openWorkshop()
  const { page } = run
  const nav = page.getByRole('navigation', { name: 'Atelier Symfony' })

  await nav.getByRole('button', { name: /Migrations/ }).click()
  await expect(nav.getByRole('button', { name: /Migrations/ })).toContainText('1 en attente')
  await expect(page.getByRole('region', { name: 'SQL de la migration' }).or(page.getByLabel('SQL de la migration'))).toContainText('CREATE TABLE facture')
  await expect(page.getByText('php bin/console doctrine:migrations:migrate --no-interaction --allow-no-migration')).toBeVisible()
  expect(await settledAxe(page)).toEqual([])

  await nav.getByRole('button', { name: 'API' }).click()
  await expect(page.getByRole('radio', { name: /Contrôleurs JSON/ })).toHaveAttribute('aria-checked', 'true')
  await page.getByRole('radio', { name: /API Platform/ }).click()
  await expect(page.getByText("API Platform n'est pas installé dans ce projet.")).toBeVisible()
  await expect(page.getByText('composer require api')).toBeVisible()
  await page.getByRole('radio', { name: /Contrôleurs JSON/ }).click()
  await page.getByRole('checkbox', { name: 'Lister Produit' }).check({ force: true })
  await expect(page.getByRole('listitem', { name: 'Produit' })).toContainText('/api/produits')
  // A password is never exposed by default
  await page.getByRole('checkbox', { name: 'Lister User' }).check({ force: true })
  await expect(page.getByRole('button', { name: 'password' })).toHaveAttribute('aria-pressed', 'false')
  expect(await settledAxe(page)).toEqual([])
  await page.getByRole('listitem', { name: 'Produit' }).getByRole('button', { name: 'Tester' }).click()
  await expect(page.locator('input[value="http://127.0.0.1:8000/api/produits"]')).toBeVisible()

  await goTo(page, '/project/sf?tab=symfony')
  await nav.getByRole('button', { name: 'Routes' }).click()
  await expect(page.getByRole('list', { name: 'Routes · 2' })).toContainText('/produits/{id}')
  await nav.getByRole('button', { name: /Serveur et cache/ }).click()
  await expect(page.getByText('En marche sur http://127.0.0.1:8000')).toBeVisible()
  await expect(page.getByText('php bin/console cache:clear')).toBeVisible()
  await nav.getByRole('button', { name: /Fausses données/ }).click()
  await expect(page.getByText('Les fixtures et Foundry ne sont pas installés.')).toBeVisible()
  expect(await settledAxe(page)).toEqual([])
})
