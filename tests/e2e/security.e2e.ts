import { expect, test } from '@playwright/test'
import { writeFileSync } from 'fs'
import { join } from 'path'
import { pathToFileURL } from 'url'
import { launch, type Launched } from './launch'

/** v4.0 lot 1: what an injected piece of HTML could do in the app's page — nothing */
let run: Launched
test.afterEach(async () => {
  await run.close()
})

test('an injected script does not run, the page talks to no one, cannot leave the app, and gets only its permissions', async () => {
  let dir = ''
  run = await launch({ seed: d => { dir = d } })
  const { page } = run
  await expect(page.locator('#root')).not.toBeEmpty()

  // Content-Security-Policy: no inline script, no network from the page
  const ran = await page.evaluate(async () => {
    const s = document.createElement('script')
    s.textContent = 'window.__pwned = true'
    document.head.appendChild(s)
    const img = document.createElement('div')
    img.innerHTML = '<img src="x" onerror="window.__pwned2 = true">'
    document.body.appendChild(img)
    await new Promise(r => setTimeout(r, 300))
    let fetched = true
    try { await fetch('https://example.com/') } catch { fetched = false }
    return { inline: !!(window as unknown as { __pwned?: boolean }).__pwned, handler: !!(window as unknown as { __pwned2?: boolean }).__pwned2, fetched }
  })
  expect(ran).toEqual({ inline: false, handler: false, fetched: false })

  // Navigation: neither the web nor another local page
  const start = page.url()
  const other = join(dir, 'evil.html')
  writeFileSync(other, '<h1>evil</h1>')
  for (const target of ['https://example.com/', pathToFileURL(other).href]) {
    await page.evaluate(url => { location.href = url }, target)
    await page.waitForTimeout(500)
    expect(page.url()).toBe(start)
  }

  // Permissions: the microphone yes, the camera and the position no
  const states = await page.evaluate(async () => {
    const q = async (name: string) => { try { return (await navigator.permissions.query({ name } as PermissionDescriptor)).state } catch { return 'error' } }
    let camera = 'granted'
    try { (await navigator.mediaDevices.getUserMedia({ video: true })).getTracks().forEach(t => t.stop()) } catch (e) { camera = (e as Error).name }
    return { microphone: await q('microphone'), geolocation: await q('geolocation'), camera }
  })
  expect(states.microphone).toBe('granted')
  expect(states.geolocation).toBe('denied')
  expect(states.camera).not.toBe('granted')
})
