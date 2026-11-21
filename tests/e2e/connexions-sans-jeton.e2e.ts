import { expect, test } from '@playwright/test'
import { createServer, type Server } from 'http'
import { goTo, launch, type Launched } from './launch'
import { settledAxeIssues } from './axe'

/** Settings › Connections › GitHub without a token: the code to type, the wait, then the account plugged in */
let run: Launched
let server: Server
test.afterEach(async () => {
  expect(run.errors, 'uncaught page errors').toEqual([])
  await run.close()
  server?.close()
})

test('GitHub: « Se connecter » shows the code to type on GitHub, then the account is plugged in', async () => {
  let polls = 0
  // GitHub's login pages and its API, on this PC
  server = createServer((req, res) => {
    res.setHeader('content-type', 'application/json')
    if (req.url === '/login/device/code')
      return res.end(JSON.stringify({ device_code: 'dev', user_code: 'WDJB-MJHT', verification_uri: 'https://github.com/login/device', interval: 1 }))
    if (req.url === '/login/oauth/access_token')
      return res.end(JSON.stringify(++polls < 2 ? { error: 'authorization_pending' } : { access_token: 'gho_e2e', token_type: 'bearer' }))
    if (req.url === '/user') return res.end(JSON.stringify({ login: 'octocat' }))
    res.statusCode = 404
    res.end('{}')
  })
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
  const base = `http://127.0.0.1:${(server.address() as { port: number }).port}`

  run = await launch({
    settings: { onboarded: true },
    // GitHub CLI signed out, whatever this PC's own sign-in: the button only shows without it
    env: {
      DEVFORGE_TEST_GITHUB_CLIENT_ID: 'Iv1.e2e',
      DEVFORGE_TEST_GITHUB_LOGIN: base,
      DEVFORGE_TEST_GITHUB_API: base,
      GH_CONFIG_DIR: '{userData}/gh',
      GH_TOKEN: ''
    }
  })
  const { page } = run
  await goTo(page, '/settings?section=connections')

  await page.getByRole('button', { name: 'Se connecter · GitHub' }).click()
  await expect(page.getByText('Tape ce code sur la page de GitHub')).toBeVisible()
  await expect(page.getByText('WDJB-MJHT')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Copier le code' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Ouvrir GitHub' })).toBeVisible()
  expect(await settledAxeIssues(page)).toEqual([])

  // GitHub waits at least 5 s between two checks
  await expect(page.getByText('Connecté à GitHub · octocat')).toBeVisible({ timeout: 30_000 })
  await expect(page.getByText('jeton enregistré')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Se connecter · GitHub' })).toHaveCount(0)
})
