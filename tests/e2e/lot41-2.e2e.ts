import { expect, test } from '@playwright/test'
import { mkdirSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { goTo, launch, type Launched } from './launch'
import { pullLink } from './pull'

/** v4.1 lot 2: the MCD editor suggests a tidy MCD (zoomed like the canvas); the user keeps the current one, or takes the new one (Ctrl+Z goes back); a new association never lands on a part */
let run: Launched
test.afterEach(async () => {
  expect(run.errors, 'uncaught page errors').toEqual([])
  await run.close()
})

const attr = (id: string, name: string, identifier = false) => ({ id, name, type: 'int', ...(identifier ? { identifier: true } : {}) })
/** As imports made them before v4.1: two associations of the same name, all on top of USER, a key left unlinked */
const MESSY = {
  v: 1, kind: 'mcd', name: 'RH', updatedAt: '2026-11-01T00:00:00.000Z',
  mcd: {
    entities: [
      { id: 'u', name: 'USER', x: 300, y: 300, attributes: [attr('u1', 'id_user', true), attr('u2', 'firstname')] },
      { id: 'r', name: 'ACCESS_REQUEST', x: 600, y: 100, attributes: [attr('r1', 'id_access_request', true)] },
      { id: 'c', name: 'USER_CONTACT', x: 600, y: 600, attributes: [attr('c1', 'user_id', true), attr('c2', 'email')] },
      { id: 'd', name: 'DOCTRINE_MIGRATION_VERSIONS', x: 0, y: 900, attributes: [attr('d1', 'version', true)] }
    ],
    associations: [
      { id: 's1', name: 'ACCESS_REQUEST_USER', x: 300, y: 300, attributes: [] },
      { id: 's2', name: 'ACCESS_REQUEST_USER', x: 310, y: 310, attributes: [] }
    ],
    links: [
      { id: 'l1', entity: 'r', association: 's1', card: '1,1' }, { id: 'l2', entity: 'u', association: 's1', card: '0,n' },
      { id: 'l3', entity: 'r', association: 's2', card: '0,1' }, { id: 'l4', entity: 'u', association: 's2', card: '0,n' }
    ],
    notes: []
  }
}

test('an association pulled between two entities close together lands where it hides neither', async () => {
  run = await launch({
    seed: dir => {
      const project = join(dir, 'duo')
      mkdirSync(join(project, 'conception'), { recursive: true })
      writeFileSync(join(project, 'conception', 'duo.mcd.json'), JSON.stringify({ v: 1, kind: 'mcd', name: 'Duo', updatedAt: '2026-11-01T00:00:00.000Z', mcd: {
        entities: [
          { id: 'a', name: 'AUTEUR', x: 100, y: 100, attributes: [attr('a1', 'id_auteur', true), attr('a2', 'nom')] },
          { id: 'b', name: 'LIVRE', x: 290, y: 100, attributes: [attr('b1', 'id_livre', true), attr('b2', 'titre')] }
        ], associations: [], links: [], notes: [] } }))
      writeFileSync(join(dir, 'projects.json'), JSON.stringify([{ id: 'p1', name: 'Duo', path: project, framework: 'nodejs', packageManager: 'npm', favorite: false, createdAt: '', lastOpenedAt: null }]))
    }
  })
  const { page } = run
  const project = join(await run.app.evaluate(({ app }) => app.getPath('userData')), 'duo')
  await goTo(page, `/model?project=${encodeURIComponent(project)}&file=duo.mcd.json`)
  // Two entities linked to nothing, at first
  await expect(page.getByRole('button', { name: 'Vérifier · 2' })).toBeVisible()
  await pullLink(page, 'AUTEUR', page.locator('[data-entity="LIVRE"]'))
  await expect(page.locator('[data-association="ASSOCIATION"]')).toHaveCount(1)
  // Nothing left to say: not even two parts on one another
  await expect(page.getByRole('button', { name: 'Vérifier', exact: true })).toBeVisible()
})

test('the tidy suggestion: seen first, kept or taken, and undone', async () => {
  let file = ''
  run = await launch({
    seed: dir => {
      const project = join(dir, 'rh')
      mkdirSync(join(project, 'conception'), { recursive: true })
      file = join(project, 'conception', 'rh.mcd.json')
      writeFileSync(file, JSON.stringify(MESSY))
      writeFileSync(join(dir, 'projects.json'), JSON.stringify([
        { id: 'p1', name: 'RH', path: project, framework: 'symfony', packageManager: 'composer', favorite: false, createdAt: '2026-01-01T00:00:00.000Z', lastOpenedAt: null }
      ]))
    }
  })
  const { page } = run
  const project = file.replace(/[\\/]conception[\\/]rh\.mcd\.json$/, '')
  await goTo(page, `/model?project=${encodeURIComponent(project)}&file=rh.mcd.json`)

  // The Check panel says it: the same name twice, parts on one another
  const check = page.getByRole('list', { name: 'Vérifier' })
  await expect(check).toContainText('Deux éléments s’appellent ACCESS_REQUEST_USER')
  await expect(check).toContainText('se chevauchent')

  // Seen before anything changes; kept: nothing changes
  await page.getByRole('button', { name: 'Proposer un MCD propre' }).click()
  const dialog = page.getByRole('dialog', { name: 'Proposition de MCD propre' })
  const changes = dialog.getByRole('list', { name: /changement\(s\)/ })
  await expect(changes).toContainText('DOCTRINE_MIGRATION_VERSIONS retirée : une table du framework, pas du domaine')
  await expect(changes).toContainText('USER_CONTACT reliée à USER : sa clé user_id pointe vers USER')
  await expect(changes).toContainText('ACCESS_REQUEST_USER renommée ACCESS_REQUEST_USER_2')
  await expect(changes).toContainText(/Éléments replacés : \d+ se chevauchaient/)
  await expect(dialog.getByTestId('tidy-preview')).toHaveAttribute('data-shown', 'new')
  // Zoomed and moved like the editor's canvas
  const zoom = dialog.locator('[data-zoom]')
  const fitted = Number(await zoom.getAttribute('data-zoom'))
  await dialog.getByRole('button', { name: 'Zoomer', exact: true }).click()
  await expect.poll(async () => Number(await zoom.getAttribute('data-zoom'))).toBeGreaterThan(fitted)
  const box = (await zoom.boundingBox())!
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.wheel(0, 400)
  await expect.poll(async () => Number(await zoom.getAttribute('data-zoom'))).toBeLessThan(fitted)
  await dialog.getByRole('button', { name: 'Ajuster' }).click()
  await expect.poll(async () => Number(await zoom.getAttribute('data-zoom'))).toBeCloseTo(fitted, 1)
  await dialog.getByRole('tab', { name: 'Actuel' }).click()
  await expect(dialog.getByTestId('tidy-preview')).toHaveAttribute('data-shown', 'now')
  await dialog.getByRole('button', { name: 'Garder la version actuelle' }).click()
  await expect(dialog).toHaveCount(0)
  await expect(check).toContainText('Deux éléments s’appellent ACCESS_REQUEST_USER')

  // Taken: the check is clean of those, the file has it
  await page.getByRole('button', { name: 'Proposer un MCD propre' }).click()
  await dialog.getByRole('button', { name: 'Prendre la nouvelle version' }).click()
  await expect(page.getByText('Nouvelle version prise · Ctrl+Z pour revenir')).toBeVisible()
  await expect(page.getByText('Rien à signaler')).toBeVisible()
  await expect(page.getByText(/Deux éléments s’appellent|se chevauchent/)).toHaveCount(0)
  await expect.poll(() => JSON.parse(readFileSync(file, 'utf-8')).mcd.entities.map((e: { name: string }) => e.name).sort())
    .toEqual(['ACCESS_REQUEST', 'USER', 'USER_CONTACT'])

  // One step back: the MCD as it was
  await page.locator('main').click({ position: { x: 5, y: 5 } }).catch(() => {})
  await page.keyboard.press('Control+z')
  await expect(check).toContainText('Deux éléments s’appellent ACCESS_REQUEST_USER')
  await expect.poll(() => JSON.parse(readFileSync(file, 'utf-8')).mcd.entities.length).toBe(4)
})
