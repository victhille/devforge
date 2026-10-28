import { expect, test } from '@playwright/test'
import { execFileSync } from 'child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { goTo, launch, type Launched } from './launch'
import { settledAxeIssues as settledAxe } from './axe'

/** v3.8 lot 5: a project saved as a template, then a new project from it (piste A) */
let run: Launched
test.afterEach(async () => {
  expect(run.errors, 'uncaught page errors').toEqual([])
  await run.close()
})

test('a project saved as a template gives a renamed new project, without .env, node_modules or its Git history', async () => {
  let dir = ''
  run = await launch({
    seed: d => {
      dir = d
      writeFileSync(join(d, 'gitconfig'), '[user]\n\tname = Test\n\temail = test@example.invalid\n')
      const starter = join(d, 'starter')
      const put = (p: string, s: string) => { mkdirSync(join(starter, p, '..'), { recursive: true }); writeFileSync(join(starter, p), s) }
      put('package.json', '{\n  "name": "starter",\n  "version": "1.0.0"\n}\n')
      put('README.md', '# starter\n\nMy usual Node API.\n')
      put('index.js', 'console.log("hello")\n')
      put('.env', 'API_KEY=secret')
      put('.env.example', 'API_KEY=')
      put('node_modules/dep/index.js', 'module.exports = 1')
      execFileSync('git', ['init', '-q'], { cwd: starter })
      writeFileSync(join(d, 'projects.json'), JSON.stringify([{ id: 's', name: 'starter', path: starter, framework: 'nodejs', packageManager: 'npm', favorite: false, createdAt: '', lastOpenedAt: null }]))
    },
    env: { GIT_CONFIG_GLOBAL: '{userData}/gitconfig' }
  })
  const { page } = run

  // Saved from the project's page: what is copied, what is left out
  await goTo(page, '/project/s')
  await page.getByRole('button', { name: 'Enregistrer comme modèle' }).click()
  const dialog = page.getByRole('dialog', { name: 'Enregistrer « starter » comme modèle' })
  await dialog.getByLabel('Nom du modèle').fill('API Node')
  await dialog.getByLabel('Description').fill('Express, tests et lint')
  await expect(dialog.getByTestId('template-preview')).toContainText('4 fichier(s) copiés')
  await expect(dialog.getByTestId('template-preview')).toContainText('Laissés de côté : .env, .git, node_modules')
  expect(await settledAxe(page)).toEqual([])
  await dialog.getByRole('button', { name: 'Enregistrer comme modèle' }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Modèle enregistré' })).toBeVisible()

  // New project › My templates
  await goTo(page, '/new-project')
  const mine = page.getByRole('region', { name: 'Mes modèles' })
  await mine.getByRole('button', { name: /API Node/ }).click()
  await expect(page.getByRole('heading', { name: 'Nouveau projet depuis « API Node »' })).toBeVisible()
  await page.getByLabel('Nom du projet').fill('my-shop')
  await page.getByRole('checkbox', { name: 'Installer les dépendances' }).uncheck({ force: true })
  await page.getByRole('button', { name: 'Suivant →' }).click()

  // Straight to Git: no database, no libraries, no welcome page
  const recap = page.getByRole('list', { name: 'Récapitulatif · ce qui va être lancé' })
  await expect(recap).toContainText('Copie du modèle « API Node », le nom du projet remplacé')
  await expect(recap).toContainText('git init -b main')
  await expect(recap).not.toContainText('npm install')
  await page.getByRole('checkbox', { name: 'Ouvrir dans VS Code à la fin' }).uncheck({ force: true })
  await page.getByRole('button', { name: 'Créer le projet' }).click()

  const made = join(dir, 'my-shop')
  await expect.poll(() => { try { return JSON.parse(readFileSync(join(dir, 'projects.json'), 'utf-8')).some((p: { name: string }) => p.name === 'my-shop') } catch { return false } }, { timeout: 30_000 }).toBe(true)
  expect(JSON.parse(readFileSync(join(made, 'package.json'), 'utf-8')).name).toBe('my-shop')
  expect(readFileSync(join(made, 'README.md'), 'utf-8')).toContain('# my-shop')
  expect(existsSync(join(made, '.env'))).toBe(false)
  expect(existsSync(join(made, 'node_modules'))).toBe(false)
  expect(readFileSync(join(made, '.env.example'), 'utf-8')).toBe('API_KEY=')
  // A new history: one commit, DevForge's
  expect(execFileSync('git', ['log', '--format=%s'], { cwd: made }).toString().trim()).toBe('chore: initial commit (DevForge)')

  // Settings › Templates: renamed, then deleted
  await goTo(page, '/settings?section=templates')
  const list = page.getByRole('list', { name: 'Modèles' })
  await expect(list).toContainText('API Node')
  await expect(list).toContainText('4 fichier(s)')
  await list.getByRole('button', { name: 'Renommer' }).click()
  await list.getByLabel('Nom du modèle').fill('API Node + Docker')
  await list.getByRole('button', { name: 'Enregistrer' }).click()
  await expect(list).toContainText('API Node + Docker')
  expect(await settledAxe(page)).toEqual([])
  page.once('dialog', d => d.accept())
  await list.getByRole('button', { name: 'Supprimer le modèle' }).click()
  await expect(page.getByText('Aucun modèle : sur la fiche d\'un projet')).toBeVisible()
})
