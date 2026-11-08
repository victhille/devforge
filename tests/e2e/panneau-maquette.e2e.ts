import { expect, test } from '@playwright/test'
import { execFileSync } from 'child_process'
import { mkdirSync, writeFileSync } from 'fs'
import { join } from 'path'
import { goTo, launch, type Launched } from './launch'
import { settledAxeIssues } from './axe'

/** The menu's panel of the « Forge » mock-up: projects with their repository's state, a note, the Settings' sections */
let run: Launched
test.afterEach(async () => {
  expect(run.errors, 'uncaught page errors').toEqual([])
  await run.close()
})

const git = (cwd: string, ...args: string[]) => execFileSync('git', args, { cwd, stdio: 'pipe', env: { ...process.env, GIT_AUTHOR_NAME: 'Alex', GIT_AUTHOR_EMAIL: 'alex@example.com', GIT_COMMITTER_NAME: 'Alex', GIT_COMMITTER_EMAIL: 'alex@example.com' } })

test('the panel lists the projects, says where things stand, and holds the Settings sections', async () => {
  run = await launch({
    settings: { onboarded: true, motion: 'reduced' },
    seed: dir => {
      const names = ['Shop', 'Blog', 'Api', 'Docs']
      names.forEach((name, i) => {
        const p = join(dir, name.toLowerCase())
        mkdirSync(p)
        writeFileSync(join(p, 'package.json'), JSON.stringify({ name: name.toLowerCase() }))
        git(p, 'init', '-q', '-b', 'main')
        git(p, 'add', '-A')
        git(p, 'commit', '-q', '-m', 'first')
        if (i === 0) { writeFileSync(join(p, 'a.txt'), 'a'); writeFileSync(join(p, 'b.txt'), 'b') }
      })
      writeFileSync(join(dir, 'projects.json'), JSON.stringify(names.map((name, i) => ({
        id: `p${i + 1}`, name, path: join(dir, name.toLowerCase()), framework: 'node', packageManager: 'npm', favorite: false,
        createdAt: '2026-01-01T00:00:00.000Z', lastOpenedAt: `2026-11-0${7 - i}T10:00:00.000Z`
      }))))
      writeFileSync(join(dir, 'ssh-connections.json'), JSON.stringify([{ id: 'v1', name: 'Prod', host: '127.0.0.1', port: 1, username: 'root', authMethod: 'privateKey', color: '', createdAt: '' }]))
    }
  })
  const { page } = run
  const menu = page.getByRole('navigation', { name: 'Menu principal' })

  // Home: the three projects opened last, the first with its two changed files; a note at the bottom
  await goTo(page, '/')
  await expect(menu.getByText('Projets récents')).toBeVisible()
  await expect(menu.getByRole('link', { name: /^Shop/ })).toContainText('2 fichier(s) modifié(s)')
  await expect(menu.getByRole('link', { name: /^(Shop|Blog|Api|Docs)/ })).toHaveCount(3)
  await expect(menu.getByText('Ctrl K mène à n’importe quelle page, projet ou script.')).toBeVisible()
  expect(await settledAxeIssues(page)).toEqual([])

  // Development: every project by name, the one on screen marked
  await menu.getByRole('button', { name: 'Développement' }).click()
  await expect(menu.getByRole('link', { name: /^(Shop|Blog|Api|Docs)/ })).toHaveText([/^Api, à jour$/, /^Blog/, /^Docs/, /^Shop2, 2 fichier/])
  await menu.getByRole('link', { name: /^Blog/ }).click()
  await expect(menu.getByRole('link', { name: /^Blog/ })).toHaveAttribute('aria-current', 'page')
  await expect(menu.locator('[aria-current="page"]')).toHaveCount(1)
  expect(await settledAxeIssues(page)).toEqual([])

  // Servers: the server's name at the bottom
  await menu.getByRole('button', { name: 'Serveurs' }).click()
  await expect(menu.getByText('Serveur : Prod')).toBeVisible()

  // Release notes light Updates
  await goTo(page, '/settings?section=updates&notes=all')
  await expect(menu.getByRole('link', { name: 'Mises à jour' })).toHaveAttribute('aria-current', 'page')

  // Settings: its sections in the panel
  await goTo(page, '/settings?section=data')
  await expect(menu.getByRole('link', { name: 'Données' })).toHaveAttribute('aria-current', 'page')
  await menu.getByRole('link', { name: 'Apparence' }).click()
  await expect(page.getByRole('radio', { name: 'Clair' })).toBeVisible()
  await expect(menu.getByRole('link', { name: 'Apparence' })).toHaveAttribute('aria-current', 'page')
  expect(await settledAxeIssues(page)).toEqual([])
})
