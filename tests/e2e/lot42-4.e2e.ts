import { expect, test } from '@playwright/test'
import { mkdirSync, writeFileSync } from 'fs'
import { join } from 'path'
import { settledAxeIssues as settledAxe } from './axe'
import { goTo, launch, type Launched } from './launch'

/** v4.2: the kept lists follow what the main process writes (Forgy, another window), and come back at once */
let run: Launched
test.afterEach(async () => {
  expect(run.errors, 'uncaught page errors').toEqual([])
  await run.close()
})

test('a connection and a project saved elsewhere show up in the open pages, without leaving them', async () => {
  let dir = ''
  run = await launch({
    seed: d => {
      dir = d
      const project = join(d, 'atelier')
      mkdirSync(project, { recursive: true })
      writeFileSync(join(project, 'package.json'), '{"name":"atelier"}')
      writeFileSync(join(d, 'projects.json'), JSON.stringify([{ id: 'p1', name: 'Atelier', path: project, framework: 'nodejs', packageManager: 'npm', favorite: false, createdAt: '', lastOpenedAt: null }]))
    }
  })
  const { page } = run

  // The Database page, open while a connection is saved by the main process (as Forgy or another window would)
  await goTo(page, '/database')
  await expect(page.getByRole('button', { name: /Base du soir/ })).toHaveCount(0)
  const file = join(dir, 'soir.sqlite')
  writeFileSync(file, Buffer.alloc(0))
  await page.evaluate(f => window.devforge.db.save({ id: 'c1', name: 'Base du soir', type: 'sqlite', file: f, color: '' }), file)
  await expect(page.getByRole('button', { name: /Base du soir/ })).toBeVisible()
  expect(await settledAxe(page)).toEqual([])

  // The Projects page: a project saved meanwhile is listed at once
  await goTo(page, '/projects')
  await expect(page.getByText('Atelier', { exact: true }).first()).toBeVisible()
  const other = join(dir, 'boutique')
  mkdirSync(other, { recursive: true })
  await page.evaluate(p => window.devforge.saveProject({ id: 'p2', name: 'Boutique', path: p, framework: 'nodejs', packageManager: 'npm', favorite: false, createdAt: '', lastOpenedAt: null }), other)
  await expect(page.getByText('Boutique', { exact: true }).first()).toBeVisible()

  // Back on the Database page: the list is there at once (kept), the connection still in it
  await goTo(page, '/database')
  await expect(page.getByRole('button', { name: /Base du soir/ })).toBeVisible()
  await page.evaluate(() => window.devforge.db.remove('c1'))
  await expect(page.getByRole('button', { name: /Base du soir/ })).toHaveCount(0)
})
