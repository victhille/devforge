import { expect, test } from '@playwright/test'
import { mkdirSync, writeFileSync } from 'fs'
import { join } from 'path'
import { goTo, openProjectTab, launch, type Launched } from './launch'

/** n8n page and the Vercel tab, without a real server or account */
let run: Launched
test.afterEach(async () => {
  expect(run.errors, 'uncaught page errors').toEqual([])
  await run.close()
})

test('n8n offers an install on a saved server, and a Vercel-linked project gets its tab', async () => {
  run = await launch({
    seed: dir => {
      // A server nobody can reach: the check fails, the form is still there
      writeFileSync(join(dir, 'ssh-connections.json'), JSON.stringify([{ id: 'v1', name: 'Prod', host: '127.0.0.1', port: 1, username: 'root', authMethod: 'key', color: '', createdAt: '' }]))
      writeFileSync(join(dir, 'watch.json'), JSON.stringify({ watched: [], diskAlert: 85 }))
      const site = join(dir, 'site')
      mkdirSync(join(site, '.vercel'), { recursive: true })
      writeFileSync(join(site, '.vercel', 'project.json'), JSON.stringify({ projectId: 'prj_1', orgId: 'team_1' }))
      writeFileSync(join(dir, 'projects.json'), JSON.stringify([
        { id: 'p1', name: 'Site', path: site, framework: 'nextjs', packageManager: 'npm', favorite: false, createdAt: '2026-01-01T00:00:00.000Z', lastOpenedAt: null }
      ]))
    }
  })
  const { page } = run
  await goTo(page, '/n8n')
  await expect(page.getByRole('heading', { name: 'Installer n8n sur Prod' })).toBeVisible()
  await expect(page.getByRole('radio', { name: /HTTPS sur un sous-domaine/ })).toBeVisible()
  // A sub-domain that does not exist is caught before the install
  await page.getByPlaceholder('n8n.mondomaine.fr').fill('n8n.devforge.invalid')
  await expect(page.getByText(/n'existe pas dans le DNS/)).toBeVisible()
  await expect(page.getByRole('button', { name: 'Installer' })).toBeDisabled()
  await page.getByRole('radio', { name: /Seulement sur le serveur/ }).click()
  await expect(page.getByPlaceholder('n8n.mondomaine.fr')).toHaveCount(0)
  // The app is in French: the French n8n editor is proposed, and can be turned off
  const french = page.getByRole('switch', { name: 'Interface en français' })
  await expect(french).toHaveAttribute('aria-checked', 'true')
  await french.click()
  await expect(french).toHaveAttribute('aria-checked', 'false')

  // VPN page: same server picker, looks for wg-easy on it (unreachable here)
  await goTo(page, '/vpn')
  await expect(page.getByRole('heading', { name: 'VPN', level: 1 })).toBeVisible()
  await expect(page.getByRole('combobox')).toHaveValue(/.+/)

  await goTo(page, '/project/p1')
  await openProjectTab(page, 'Vercel')
  await expect(page.getByRole('heading', { name: 'Connecter Vercel' })).toBeVisible()
  await expect(page.getByPlaceholder("Jeton d'accès Vercel")).toBeVisible()
})
