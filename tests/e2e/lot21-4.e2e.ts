import { expect, test } from '@playwright/test'
import { execFileSync } from 'child_process'
import { mkdirSync, writeFileSync } from 'fs'
import { join } from 'path'
import { goTo, launch, type Launched } from './launch'

/** v2.1 lot 4: .env sync panel, GitHub tab (no network call: the repo here has no GitHub origin) */
let run: Launched
test.afterEach(async () => {
  expect(run.errors, 'uncaught page errors').toEqual([])
  await run.close()
})

test('the deploy tab opens the .env sync of a target; no GitHub tab without a GitHub origin', async () => {
  run = await launch({
    settings: { onboarded: true, motion: 'reduced' },
    seed: dir => {
      const app = join(dir, 'app')
      mkdirSync(app)
      writeFileSync(join(app, '.env'), 'A=1\n')
      writeFileSync(join(app, '.env.production'), 'A=2\n')
      execFileSync('git', ['init', '-q', app])
      execFileSync('git', ['-C', app, 'remote', 'add', 'origin', 'https://gitlab.com/me/app.git'])
      writeFileSync(join(dir, 'projects.json'), JSON.stringify([{ id: 'p1', name: 'App', path: app, framework: 'nextjs', packageManager: 'npm', favorite: false, createdAt: '2026-01-01T00:00:00.000Z', lastOpenedAt: null }]))
      writeFileSync(join(dir, 'ssh-connections.json'), JSON.stringify([{ id: 'v1', name: 'Prod', host: '127.0.0.1', port: 1, username: 'root', authMethod: 'privateKey', color: '', createdAt: '' }]))
      writeFileSync(join(dir, 'deploy.json'), JSON.stringify({ targets: [{ id: 't1', name: 'Prod app', connectionId: 'v1', remotePath: '/srv/app', script: '', projectPath: app }] }))
    }
  })
  const { page } = run
  await goTo(page, '/project/p1')
  await expect(page.getByRole('tab', { name: 'Déploiement' })).toBeVisible()
  await expect(page.getByRole('tab', { name: 'GitHub' })).toHaveCount(0)

  await page.getByRole('tab', { name: 'Déploiement' }).click()
  await page.getByRole('button', { name: 'Synchroniser le .env' }).click()
  await expect(page.getByRole('combobox', { name: 'Fichier sur ce PC' })).toHaveValue('.env')
  await expect(page.getByRole('combobox', { name: 'Fichier sur ce PC' }).locator('option')).toHaveText(['.env', '.env.production'])
  await expect(page.getByRole('textbox', { name: 'Fichier sur le serveur' })).toHaveValue('.env')
  await expect(page.getByText('Seul l\'état de chaque clé s\'affiche')).toBeVisible()
})
