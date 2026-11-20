import { expect, test } from '@playwright/test'
import { createServer, type Server } from 'http'
import type { AddressInfo } from 'net'
import { mkdirSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { goTo, launch, type Launched } from './launch'
import { settledAxeIssues } from './axe'
import { acceptConfirms } from './confirm'

/** Online › Vercel: every project of the account, against a local stand-in for Vercel's API */
let run: Launched
let server: Server
test.afterEach(async () => {
  expect(run.errors, 'uncaught page errors').toEqual([])
  await run.close()
  server?.close()
})

test('the Vercel page lists the projects, cancels a build, promotes a preview and links a folder', async () => {
  const calls: string[] = []
  let building = true
  server = createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://x')
    calls.push(`${req.method} ${url.pathname}`)
    res.setHeader('content-type', 'application/json')
    const send = (o: unknown) => res.end(JSON.stringify(o))
    const p = url.pathname
    if (p === '/v2/user') return send({ user: { id: 'usr_1', username: 'vic' } })
    if (p === '/v2/teams') return send({ teams: [{ id: 'team_1', name: 'Client', slug: 'client' }] })
    if (p === '/v9/projects')
      return send({
        projects: [
          {
            id: 'prj_shop',
            name: 'shop',
            framework: 'nextjs',
            targets: { production: { id: 'dpl_live', alias: ['shop.vercel.app'] } },
            latestDeployments: [{ uid: 'dpl_live', readyState: 'READY', createdAt: Date.now() - 3_600_000, meta: { githubCommitRef: 'main' } }]
          },
          { id: 'prj_docs', name: 'docs', framework: null }
        ]
      })
    if (p === '/v9/projects/prj_docs') return send({ id: 'prj_docs', name: 'docs' })
    if (p === '/v6/deployments')
      return send({
        deployments: [
          ...(building
            ? [{ uid: 'dpl_new', url: 'shop-new.vercel.app', name: 'shop', projectId: 'prj_shop', state: 'BUILDING', created: Date.now(), meta: {} }]
            : []),
          {
            uid: 'dpl_prev',
            url: 'shop-prev.vercel.app',
            name: 'shop',
            projectId: 'prj_shop',
            state: 'READY',
            target: null,
            created: Date.now() - 7_200_000,
            meta: { githubCommitRef: 'fix/stock', githubCommitMessage: 'fix(stock): out of stock shown' }
          }
        ]
      })
    if (p === '/v12/deployments/dpl_new/cancel') {
      building = false
      return send({})
    }
    if (p === '/v5/domains') return send({ domains: [{ name: 'shop.example.com', verified: true, boughtAt: 1 }] })
    if (p.startsWith('/v6/domains/')) return send({ misconfigured: false })
    return send({})
  })
  await new Promise<void>(r => server.listen(0, '127.0.0.1', () => r()))
  const port = (server.address() as AddressInfo).port

  let docs = ''
  run = await launch({
    settings: { onboarded: true },
    env: { DEVFORGE_TEST_VERCEL_API: `http://127.0.0.1:${port}`, DEVFORGE_TEST_VERCEL_TOKEN: 'test-token-for-the-local-stand-in' },
    seed: dir => {
      const shop = join(dir, 'shop')
      docs = join(dir, 'docs')
      mkdirSync(join(shop, '.vercel'), { recursive: true })
      mkdirSync(docs, { recursive: true })
      writeFileSync(join(shop, '.vercel', 'project.json'), JSON.stringify({ projectId: 'prj_shop', orgId: 'usr_1' }))
      writeFileSync(join(docs, '.gitignore'), 'node_modules\n')
      writeFileSync(
        join(dir, 'projects.json'),
        JSON.stringify(
          [
            ['p1', 'shop', shop],
            ['p2', 'docs', docs]
          ].map(([id, name, path]) => ({ id, name, path, framework: 'react', packageManager: 'npm', favorite: false, createdAt: '', lastOpenedAt: null }))
        )
      )
    }
  })
  const { page } = run
  await acceptConfirms(page)
  await goTo(page, '/vercel')

  await expect(page.getByRole('heading', { name: 'Vercel', level: 1 })).toBeVisible()
  const projects = page.getByRole('region', { name: 'Projets' })
  await expect(projects.getByRole('heading', { name: 'shop' })).toBeVisible()
  await expect(projects.getByRole('button', { name: 'shop.vercel.app' })).toBeVisible()
  await expect(page.getByRole('combobox', { name: 'Compte ou équipe Vercel' })).toHaveValue('')
  expect(await settledAxeIssues(page)).toEqual([])

  // A running build can be stopped
  await page.getByRole('button', { name: 'Annuler le build' }).click()
  await expect(page.getByText('Build annulé')).toBeVisible()
  expect(calls).toContain('PATCH /v12/deployments/dpl_new/cancel')
  await expect(page.getByRole('button', { name: 'Annuler le build' })).toHaveCount(0)

  // A ready preview goes to production
  await page.getByRole('button', { name: 'Passer en production' }).first().click()
  await expect(page.getByText('Production mise à jour')).toBeVisible()
  expect(calls).toContain('POST /v10/projects/prj_shop/promote/dpl_prev')

  // A Vercel project with no folder gets one, as `vercel link` would
  await page.getByRole('button', { name: 'Lier à un projet local' }).click()
  const dialog = page.getByRole('dialog', { name: 'Lier docs à un projet DevForge' })
  await expect(dialog.getByRole('combobox', { name: 'Projet DevForge' })).toHaveValue('p2')
  await dialog.getByRole('button', { name: 'Lier', exact: true }).click()
  await expect(page.getByText('docs est lié à docs')).toBeVisible()
  expect(JSON.parse(readFileSync(join(docs, '.vercel', 'project.json'), 'utf-8'))).toEqual({ projectId: 'prj_docs', orgId: 'usr_1', projectName: 'docs' })
  expect(readFileSync(join(docs, '.gitignore'), 'utf-8')).toBe('node_modules\n.vercel\n')

  // The other tabs
  await page.getByRole('tab', { name: /Domaines/ }).click()
  await expect(page.getByRole('button', { name: 'shop.example.com' })).toBeVisible()
  await expect(page.getByText('Vérifié, bien configuré')).toBeVisible()
  await page.getByRole('tab', { name: /Déploiements/ }).click()
  await page.getByRole('tab', { name: 'Aperçus' }).click()
  await expect(page.getByText('fix(stock): out of stock shown', { exact: false })).toBeVisible()
  expect(await settledAxeIssues(page)).toEqual([])
})
