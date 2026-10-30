import { expect, test } from '@playwright/test'
import { goTo, launch, type Launched } from './launch'
import { settledAxeIssues as axeIssues } from './axe'

/** v2.2 lot 1: the wizard up to the summary (nothing is created) */
let run: Launched
test.afterEach(async () => {
  expect(run.errors, 'uncaught page errors').toEqual([])
  await run.close()
})

test('Symfony: database, options, Git and the summary of commands', async () => {
  run = await launch()
  const { page } = run
  await goTo(page, '/new-project')
  await page.getByRole('button', { name: /Symfony/ }).click()
  await page.getByLabel('Nom du projet').fill('boutique')
  await page.getByRole('button', { name: 'Continuer' }).click()

  // Step 3: database and options
  await expect(page.getByRole('list', { name: 'Étapes' }).locator('[aria-current="step"]')).toHaveText('3 · Base et options')
  await expect(page.getByRole('list', { name: 'Étapes' })).toContainText('2 · Nom : boutique')
  await expect(page.getByRole('radio', { name: /PostgreSQL 16/ })).toHaveAttribute('aria-checked', 'true')
  await expect(page.getByLabel('Nom de la base')).toHaveValue('boutique')
  await page.getByRole('checkbox', { name: /Utilisateurs et connexion/ }).check({ force: true })
  expect(await axeIssues(page)).toEqual([])
  await page.getByRole('button', { name: 'Continuer' }).click()

  // Last step: Git, GitHub and the exact commands
  const recap = page.getByRole('list', { name: 'Récapitulatif · ce qui va être lancé' })
  await expect(recap).toContainText('composer require symfony/orm-pack')
  await expect(recap).toContainText('docker compose up -d --wait database')
  // v3.4: the contract's User entity is written, then migrated
  await expect(recap).toContainText('src/Entity/User.php')
  await expect(recap).toContainText('doctrine:migrations:migrate')
  await expect(recap).toContainText('git commit -m')
  await expect(recap).not.toContainText('gh repo create')

  await page.getByRole('checkbox', { name: /Créer le dépôt sur GitHub/ }).check({ force: true })
  // Under the gh account when one is signed in
  await expect(recap).toContainText(/gh repo create (\S+\/)?boutique --private --source \. --push/)
  await page.getByRole('radio', { name: 'Public' }).click()
  await page.getByLabel('Nom du dépôt').fill('mauvais nom')
  await expect(page.getByText('Format attendu : nom ou compte/nom')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Créer le projet' })).toBeDisabled()
  await page.getByLabel('Nom du dépôt').fill('victhille/boutique')
  await expect(recap).toContainText('gh repo create victhille/boutique --public')
  expect(await axeIssues(page)).toEqual([])

  // Back keeps the choices
  await page.getByRole('button', { name: 'Retour', exact: true }).first().click()
  await expect(page.getByRole('checkbox', { name: /Utilisateurs et connexion/ })).toBeChecked()
})

test('React: no database step, straight to libraries then Git', async () => {
  run = await launch()
  const { page } = run
  await goTo(page, '/new-project')
  await page.getByRole('button', { name: /^React/ }).click()
  await page.getByLabel('Nom du projet').fill('site')
  await page.getByRole('button', { name: 'Continuer' }).click()
  await expect(page.getByRole('list', { name: 'Étapes' }).locator('[aria-current="step"]')).toHaveText('3 · Librairies')
  await page.getByRole('button', { name: 'Passer' }).click()
  const recap = page.getByRole('list', { name: 'Récapitulatif · ce qui va être lancé' })
  await expect(recap).toContainText('Création du projet React')
  await expect(recap).toContainText('git init')
  await expect(recap).not.toContainText('compose')
})
