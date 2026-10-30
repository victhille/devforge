import { expect, test } from '@playwright/test'
import { mkdirSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { goTo, launch, type Launched } from './launch'
import { settledAxeIssues } from './axe'
import { samples } from '../diagrams'

/** v3.9 lot 5: the diagrams — a use case drawn and turned into tasks, a class, a sequence, the others from the list */
let run: Launched
test.afterEach(async () => {
  expect(run.errors, 'uncaught page errors').toEqual([])
  await run.close()
})

test('a use case drawn, its scenario, its tasks in Notes; a class and a sequence; the list draws them all', async () => {
  let project = ''
  run = await launch({
    seed: dir => {
      project = join(dir, 'shop')
      mkdirSync(join(project, 'conception'), { recursive: true })
      writeFileSync(join(project, 'conception', 'archi.architecture.json'), JSON.stringify({ v: 1, kind: 'architecture', name: 'Archi', updatedAt: '2026-10-01T10:00:00.000Z', diagram: samples.architecture() }))
      writeFileSync(join(project, 'conception', 'parcours.flow.json'), JSON.stringify({ v: 1, kind: 'flow', name: 'Parcours', updatedAt: '2026-10-01T10:00:00.000Z', diagram: samples.flow() }))
      writeFileSync(join(dir, 'projects.json'), JSON.stringify([{ id: 's', name: 'shop', path: project, framework: 'other', packageManager: 'npm', favorite: false, createdAt: '', lastOpenedAt: null }]))
    }
  })
  const { page, app } = run
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(1440, 900))
  await goTo(page, '/modeling')
  const create = page.getByRole('region', { name: 'Créer un modèle' })

  // A use case diagram, from its tile
  await create.getByRole('button', { name: /Cas d'utilisation/ }).click()
  const dialog = page.getByRole('dialog', { name: "Nouveau : Cas d'utilisation" })
  await dialog.getByLabel('Nom').fill('Parcours client')
  await dialog.getByRole('button', { name: 'Créer' }).click()
  await expect(page.getByRole('heading', { name: 'Parcours client' })).toBeVisible()
  const palette = page.getByRole('complementary', { name: 'Palette' })
  const panel = page.getByRole('complementary', { name: 'Élément choisi' })
  await palette.getByRole('button', { name: 'Système', exact: true }).click()
  await panel.getByLabel('Nom', { exact: true }).fill('Boutique')
  await palette.getByRole('button', { name: 'Acteur', exact: true }).click()
  await panel.getByLabel('Nom', { exact: true }).fill('Client')
  await palette.getByRole('button', { name: 'Cas', exact: true }).click()
  await panel.getByLabel('Nom', { exact: true }).fill('Passer une commande')
  await palette.getByRole('button', { name: 'Cas', exact: true }).click()
  await panel.getByLabel('Nom', { exact: true }).fill('Payer')

  // An association, then an include: the case says who and what
  await palette.getByRole('button', { name: 'Association', exact: true }).click()
  await expect(palette.getByRole('status')).toContainText('Clique le départ du lien Association')
  await page.locator('[data-node="Client"]').click()
  await page.locator('[data-node="Passer une commande"]').click()
  await palette.getByRole('button', { name: '«include»' }).click()
  await page.locator('[data-node="Passer une commande"]').click()
  await page.locator('[data-node="Payer"]').click()
  await expect(panel).toContainText('include')
  await page.locator('[data-node="Passer une commande"]').click()
  await expect(panel).toContainText('Acteur : Client · inclut Payer')
  await panel.getByRole('button', { name: 'Étape' }).click()
  await panel.getByLabel('Étape 1', { exact: true }).fill('Le client valide son panier')
  const file = join(project, 'conception', 'parcours-client.usecase.json')
  await expect.poll(() => {
    const d = JSON.parse(readFileSync(file, 'utf-8')).diagram
    return [d.nodes.map((n: { name: string }) => n.name).join(','), d.edges.map((e: { type: string }) => e.type).join(','), d.nodes.find((n: { name: string }) => n.name === 'Passer une commande')?.steps]
  }, { timeout: 10_000 }).toEqual(['Boutique,Client,Passer une commande,Payer', 'association,include', ['Le client valide son panier']])
  expect(await settledAxeIssues(page)).toEqual([])

  // One task per case in the project's Notes, not twice
  await page.getByRole('button', { name: 'Créer les tâches dans Notes' }).click()
  await expect(page.getByText('2 tâche(s) ajoutée(s) dans Notes')).toBeVisible()
  await page.getByRole('button', { name: 'Créer les tâches dans Notes' }).click()
  await expect(page.getByText('Les tâches de ces cas sont déjà dans Notes')).toBeVisible()
  const tasks = await page.evaluate(() => window.devforge.notes.get('s').then(n => n.tasks.map(t => t.text)))
  expect(tasks).toEqual(['Cas « Passer une commande » (Client)', 'Cas « Payer »'])

  // A class with its members
  await page.getByRole('button', { name: 'Modélisation' }).click()
  await create.getByRole('button', { name: /Diagramme de classes/ }).click()
  await page.getByRole('dialog').getByLabel('Nom').fill('Domaine')
  await page.getByRole('dialog').getByRole('button', { name: 'Créer' }).click()
  await palette.getByRole('button', { name: 'Classe', exact: true }).click()
  await panel.getByLabel('Nom', { exact: true }).fill('Commande')
  await panel.getByLabel('Attributs (un par ligne)').fill('- id : int\n- total : float')
  await panel.getByLabel('Méthodes (une par ligne)').fill('+ payer() : void')
  const canvas = page.getByTestId('diagram-canvas')
  await expect(canvas).toContainText('- total : float')
  await expect(canvas).toContainText('+ payer() : void')

  // A sequence: two participants, a message below the last one
  await page.getByRole('button', { name: 'Modélisation' }).click()
  await create.getByRole('button', { name: /Séquence/ }).click()
  await page.getByRole('dialog').getByLabel('Nom').fill('Commande')
  await page.getByRole('dialog').getByRole('button', { name: 'Créer' }).click()
  await palette.getByRole('button', { name: 'Participant', exact: true }).click()
  await panel.getByLabel('Nom', { exact: true }).fill('Front')
  await palette.getByRole('button', { name: 'Participant', exact: true }).click()
  await panel.getByLabel('Nom', { exact: true }).fill('API')
  await palette.getByRole('button', { name: 'Message', exact: true }).click()
  await page.locator('[data-node="Front"]').click()
  await page.locator('[data-node="API"]').click()
  await panel.getByLabel('Libellé').fill('POST /commandes')
  await expect(canvas).toContainText('POST /commandes')
  await expect.poll(() => {
    const d = JSON.parse(readFileSync(join(project, 'conception', 'commande.sequence.json'), 'utf-8')).diagram
    return d.nodes.length < 2 || !d.edges.length ? [] : [d.nodes[0].y === d.nodes[1].y, d.edges[0].y > d.nodes[0].y + 40, d.edges[0].label]
  }, { timeout: 10_000 }).toEqual([true, true, 'POST /commandes'])
  expect(await settledAxeIssues(page)).toEqual([])

  // The list: every diagram drawn, with its kind and its count
  await page.getByRole('button', { name: 'Modélisation' }).click()
  const cards = page.getByRole('region', { name: 'Modèles du projet' }).getByRole('listitem')
  await expect(cards).toHaveCount(5)
  await expect(cards.filter({ hasText: 'Archi' })).toContainText('Architecture · 7 élément(s)')
  await expect(cards.filter({ hasText: 'Parcours client' }).locator('img')).toBeVisible()
  await cards.filter({ hasText: 'Archi' }).getByRole('button', { name: 'Ouvrir Archi' }).click()
  await expect(page.locator('[data-node="PostgreSQL"]')).toBeVisible()
})
