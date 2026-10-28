import { expect, test } from '@playwright/test'
import { mkdirSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { goTo, launch, type Launched } from './launch'
import { settledAxeIssues as settledAxe } from './axe'

/** v3.6 lot 1: Python packages updated and audited (the commands simulated, as for npm) */
let run: Launched
test.afterEach(async () => {
  expect(run.errors, 'uncaught page errors').toEqual([])
  await run.close()
})

const file = (path: string, content: string) => { mkdirSync(join(path, '..'), { recursive: true }); writeFileSync(path, content) }
const REQUIREMENTS = 'Django>=4.2\nrequests==2.31.0\n'

test('a Python project updates its packages, an update that fails puts the file back, the audit shows', async () => {
  let api = ''
  run = await launch({
    env: { DEVFORGE_TEST_PACKAGES: '{userData}/packages.json' },
    seed: dir => {
      api = join(dir, 'api')
      file(join(api, 'requirements.txt'), REQUIREMENTS)
      // A virtual environment: its Python and what it holds
      file(join(api, '.venv', 'pyvenv.cfg'), 'home = C:\\Python312\n')
      file(join(api, '.venv', 'Scripts', 'python.exe'), '')
      mkdirSync(join(api, '.venv', 'Lib', 'site-packages', 'Django-4.2.11.dist-info'), { recursive: true })
      mkdirSync(join(api, '.venv', 'Lib', 'site-packages', 'requests-2.31.0.dist-info'), { recursive: true })
      writeFileSync(join(dir, 'projects.json'), JSON.stringify([{ id: 'py', name: 'api', path: api, framework: 'unknown', packageManager: 'npm', favorite: false, createdAt: '', lastOpenedAt: null }]))
      // The "update" changes the file, and fails when a file named "fail" is there
      const update = `node -e "require('fs').writeFileSync('requirements.txt','changed'); process.exit(require('fs').existsSync('fail') ? 1 : 0)"`
      writeFileSync(join(dir, 'packages.json'), JSON.stringify({
        latest: { Django: '5.1.2', requests: '2.32.3' },
        audit: { total: 1, bySeverity: { unknown: 1, info: 0, low: 0, moderate: 0, high: 0, critical: 0 }, packages: { Django: 'unknown' } },
        update
      }))
    }
  })
  const { page } = run
  await goTo(page, '/project/py')
  await page.getByRole('tab', { name: 'Paquets' }).click()

  // Updatable now: no "compare only" line, the buttons are there
  await expect(page.getByText(/Versions comparées seulement/)).toHaveCount(0)
  const requests = page.getByRole('row', { name: /requests/ })
  // ==2.31.0 pins it: 2.32.3 is out of its range
  await expect(requests.getByRole('button', { name: 'Passer à 2.32.3' })).toBeVisible()
  // >=4.2 lets 5.1.2 in: within its range
  await expect(page.getByRole('row', { name: /Django/ }).getByRole('button', { name: 'Mettre à jour', exact: true })).toBeVisible()

  await page.getByRole('button', { name: /Vérifier les vulnérabilités/ }).click()
  await expect(page.getByRole('row', { name: /Django/ })).toContainText('non précisée')
  expect(await settledAxe(page)).toEqual([])

  // A success keeps what the command wrote
  await requests.getByRole('button', { name: 'Passer à 2.32.3' }).click()
  await expect(page.getByText(/1 paquet mis à jour|mis à jour/).first()).toBeVisible({ timeout: 20_000 })
  expect(readFileSync(join(api, 'requirements.txt'), 'utf-8')).toBe('changed')

  // A failure puts the file back as it was before this update
  writeFileSync(join(api, 'requirements.txt'), REQUIREMENTS)
  writeFileSync(join(api, 'fail'), '')
  // The tab reads the files again
  await goTo(page, '/project/py')
  await page.getByRole('tab', { name: 'Paquets' }).click()
  // A major version: confirmed first
  page.once('dialog', d => { expect(d.message()).toContain('Django → 5.1.2'); void d.accept() })
  await page.getByRole('row', { name: /Django/ }).getByRole('button', { name: 'Mettre à jour', exact: true }).click()
  await expect(page.getByText('La mise à jour a échoué : requirements.txt remis comme avant.')).toBeVisible({ timeout: 20_000 })
  expect(readFileSync(join(api, 'requirements.txt'), 'utf-8')).toBe(REQUIREMENTS)
})

test('without a virtual environment, nothing updates and the way to create it is shown', async () => {
  run = await launch({
    seed: dir => {
      const api = join(dir, 'api')
      file(join(api, 'requirements.txt'), 'flask\n')
      writeFileSync(join(dir, 'projects.json'), JSON.stringify([{ id: 'py', name: 'api', path: api, framework: 'unknown', packageManager: 'npm', favorite: false, createdAt: '', lastOpenedAt: null }]))
    }
  })
  const { page } = run
  await goTo(page, '/project/py')
  await page.getByRole('tab', { name: 'Paquets' }).click()
  const status = page.getByRole('status').filter({ hasText: 'environnement virtuel' })
  await expect(status).toContainText('python -m venv .venv')
  await expect(page.getByRole('button', { name: /Mettre à jour les compatibles/ })).toBeDisabled()
})
