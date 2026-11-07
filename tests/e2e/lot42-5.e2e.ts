import { expect, test } from '@playwright/test'
import { createServer, type Server } from 'http'
import type { AddressInfo } from 'net'
import { settledAxeIssues as settledAxe } from './axe'
import { goTo, launch, type Launched } from './launch'

/** v4.2: Forgy on another provider than Anthropic — chosen in the settings, its models listed, and it answers */
let run: Launched
let http: Server
test.afterEach(async () => {
  expect(run.errors, 'uncaught page errors').toEqual([])
  await run.close()
  http?.close()
})

test('an OpenAI-compatible server chosen in Settings › Forgy answers in the panel', async () => {
  // A local server speaking OpenAI's chat API: its models, then one streamed answer
  const asked: { model?: string }[] = []
  http = createServer((req, res) => {
    let raw = ''
    req.on('data', c => { raw += c })
    req.on('end', () => {
      if (req.url === '/v1/models') { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ data: [{ id: 'qwen-local' }, { id: 'llama-local' }] })); return }
      asked.push(JSON.parse(raw))
      res.writeHead(200, { 'Content-Type': 'text/event-stream' })
      for (const piece of ['Bonjour, ', 'ici un modèle local.']) res.write(`data: ${JSON.stringify({ choices: [{ index: 0, delta: { content: piece }, finish_reason: null }] })}\n\n`)
      res.write(`data: ${JSON.stringify({ choices: [{ index: 0, delta: {}, finish_reason: 'stop' }] })}\n\n`)
      res.end('data: [DONE]\n\n')
    })
  })
  await new Promise<void>(r => http.listen(0, '127.0.0.1', r))
  const url = `http://127.0.0.1:${(http.address() as AddressInfo).port}/v1`

  run = await launch()
  const { page } = run
  await goTo(page, '/settings?section=forgy')

  // The provider, its address, its models
  await page.getByRole('combobox', { name: 'Fournisseur' }).selectOption({ label: 'Compatible OpenAI' })
  await page.getByRole('textbox', { name: 'Adresse du serveur' }).fill(url)
  await page.getByRole('button', { name: "Enregistrer l'adresse" }).click()
  await page.getByRole('button', { name: 'Charger la liste' }).click()
  await expect(page.getByText('2 modèle(s) disponibles')).toBeVisible()
  // The provider's rows (address, key, model): nothing axe objects to
  expect(await settledAxe(page)).toEqual([])
  const model = page.getByRole('combobox', { name: 'Modèle' })
  await model.fill('qwen-local')
  await model.press('Enter')
  // Anthropic's model choice and effort are not offered for it
  await expect(page.getByRole('radiogroup', { name: 'Profondeur de réflexion' })).toHaveCount(0)

  // Asked in the panel: the local model answers, named in the header
  await page.keyboard.press('Control+J')
  await expect(page.getByText(/qwen-local/).first()).toBeVisible()
  const input = page.getByPlaceholder('Demande à Forgy…')
  await input.fill('Qui es-tu ?')
  await input.press('Enter')
  await expect(page.getByText('Bonjour, ici un modèle local.')).toBeVisible()
  expect(asked[0].model).toBe('qwen-local')
})
