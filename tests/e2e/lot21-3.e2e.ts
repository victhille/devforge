import { expect, test } from '@playwright/test'
import { readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { goTo, launch, type Launched } from './launch'

/** v2.1 lot 3: customizable Home, palette actions, compact mode */
let run: Launched
test.afterEach(async () => {
  expect(run.errors, 'uncaught page errors').toEqual([])
  await run.close()
})

const SEP = '\n@@DF@@\n'
const seed = (dir: string) => {
  writeFileSync(join(dir, 'projects.json'), JSON.stringify([{ id: 'p1', name: 'Site', path: dir, framework: 'nextjs', packageManager: 'npm', favorite: false, createdAt: '2026-01-01T00:00:00.000Z', lastOpenedAt: null }]))
  writeFileSync(join(dir, 'ssh-connections.json'), JSON.stringify([{ id: 'v1', name: 'Prod', host: '127.0.0.1', port: 1, username: 'root', authMethod: 'privateKey', color: '', createdAt: '' }]))
  writeFileSync(join(dir, 'vps.json'), JSON.stringify({
    services: 'portainer|portainer/portainer-ce:2.45.1|127.0.0.1:9000->9000/tcp|running|Up',
    health: ['yes', '20\n0', 'yes', '/dev/sda1 100 46 54 46% /\n/dev/sda1 100 14 86 14% /', 'Mem: 1000 600 100 0 100 400', 'tcp 0.0.0.0:22', 'permitrootlogin no\npasswordauthentication no', 'active', '3', 'p|running|Up\n--\n/p|0', 'Images|1MB', 'Ubuntu 24.04\nup 1 day'].join(SEP)
  }))
  writeFileSync(join(dir, 'backups.json'), JSON.stringify({ plans: [{ connectionId: 'v1', databases: [{ engine: 'postgres', container: 'pg' }], volumes: [], time: '03:30', keepDaily: 7, keepWeekly: 4, localDir: '', savedAt: '' }], copies: [] }))
}
const opts = { settings: { onboarded: true, motion: 'reduced' }, seed, env: { DEVFORGE_TEST_VPS: '{userData}/vps.json' } }
const saved = (r: Launched) => JSON.parse(readFileSync(join(r.userData, 'settings.json'), 'utf-8'))

test('customize the Home page: remove, add, widen, reorder, back to the defaults', async () => {
  run = await launch(opts)
  const { page } = run
  await goTo(page, '/')
  const order = () => page.locator('[data-widget]').evaluateAll(els => els.map(e => e.getAttribute('data-widget')))
  await expect.poll(order).toEqual(['active-project', 'docker', 'vps', 'git', 'ports', 'activity'])

  await page.getByRole('button', { name: 'Personnaliser' }).click()
  await page.getByRole('button', { name: 'Retirer Ports' }).click()
  await page.getByRole('combobox', { name: 'Ajouter un widget' }).selectOption({ label: 'Santé du VPS' })
  await expect.poll(order).toEqual(['active-project', 'docker', 'vps', 'git', 'activity', 'health'])

  // Keyboard: the new widget goes up one place
  await page.getByRole('button', { name: 'Santé du VPS — Déplacer' }).focus()
  await page.keyboard.press('Alt+ArrowUp')
  await expect.poll(order).toEqual(['active-project', 'docker', 'vps', 'git', 'health', 'activity'])
  await page.getByRole('button', { name: 'Santé du VPS — Pleine largeur' }).click()
  await expect.poll(() => saved(run).homeWidgets.find((w: { id: string }) => w.id === 'health')?.size).toBe('full')

  await page.getByRole('button', { name: 'Terminé' }).click()
  // The widget reads the server's health (canned outputs here)
  await expect(page.locator('[data-widget=health]')).toContainText('Mises à jour')
  await expect(page.locator('[data-widget=health]')).toContainText('À surveiller')

  // Kept after a reload
  await page.reload()
  await expect.poll(order).toEqual(['active-project', 'docker', 'vps', 'git', 'health', 'activity'])
  await page.getByRole('button', { name: 'Personnaliser' }).click()
  await page.getByRole('button', { name: 'Par défaut' }).click()
  await expect.poll(order).toEqual(['active-project', 'docker', 'vps', 'git', 'ports', 'activity'])
})

test('palette actions: compact mode and theme run at once, a backup asks first', async () => {
  run = await launch(opts)
  const { page } = run
  await goTo(page, '/')
  const palette = page.getByPlaceholder('Rechercher pages, projets, scripts, serveurs…')

  await page.keyboard.press('Control+k')
  await palette.fill('compact')
  await expect(page.getByRole('button', { name: /Activer le mode compact/ })).toBeVisible()
  await page.keyboard.press('Enter')
  await expect(page.locator('html')).toHaveAttribute('data-density', 'compact')
  await expect.poll(() => saved(run).density).toBe('compact')

  await page.keyboard.press('Control+k')
  await palette.fill('thème clair')
  await page.keyboard.press('Enter')
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')

  // An action that changes the server asks first; refusing it runs nothing
  await page.keyboard.press('Control+k')
  await palette.fill('sauvegarder')
  await expect(page.getByRole('button', { name: /Sauvegarder maintenant — Prod/ })).toBeVisible()
  const asked: string[] = []
  page.once('dialog', d => { asked.push(d.message()); d.dismiss() })
  await page.keyboard.press('Enter')
  await expect.poll(() => asked).toEqual(['Lancer une sauvegarde de Prod maintenant ?'])
  await expect(palette).toBeVisible()

  // Services of the server are offered too
  await palette.fill('portainer')
  await expect(page.getByRole('button', { name: /Ouvrir Portainer — Prod/ })).toBeVisible()
})

test('compact mode from the settings', async () => {
  run = await launch(opts)
  const { page } = run
  await goTo(page, '/')
  const button = page.getByRole('button', { name: 'Personnaliser' })
  const before = await button.evaluate(e => e.getBoundingClientRect().height)

  await goTo(page, '/settings')
  await page.getByPlaceholder('Chercher un réglage…').fill('compact')
  await page.getByRole('radio', { name: 'Compacte' }).click()
  await expect(page.locator('html')).toHaveAttribute('data-density', 'compact')
  await expect.poll(() => saved(run).density).toBe('compact')

  // Spacing really shrinks: the same button is shorter
  await goTo(page, '/')
  const after = await button.evaluate(e => e.getBoundingClientRect().height)
  expect(after).toBeLessThan(before)
})
