import type { Locator, Page } from '@playwright/test'

/**
 * Pulls a line from a part's point (`data-handle="name:side"`) and lets it go
 * on `target` (its middle, or `at` inside it), as a hand would.
 */
export async function pullLink(page: Page, from: string, target: Locator, side = 'right', at?: { x: number; y: number }): Promise<void> {
  const h = (await page.locator(`[data-handle="${from}:${side}"]`).first().boundingBox())!
  await page.mouse.move(h.x + h.width / 2, h.y + h.height / 2)
  await page.mouse.down()
  const b = (await target.boundingBox())!
  await page.mouse.move(b.x + (at?.x ?? b.width / 2), b.y + (at?.y ?? b.height / 2), { steps: 8 })
  await page.mouse.up()
}

/** Same, let go on an empty spot of the canvas, `dx`, `dy` pixels from the point */
export async function pullToEmpty(page: Page, from: string, side: string, dx: number, dy: number): Promise<void> {
  const h = (await page.locator(`[data-handle="${from}:${side}"]`).first().boundingBox())!
  const x = h.x + h.width / 2, y = h.y + h.height / 2
  await page.mouse.move(x, y)
  await page.mouse.down()
  await page.mouse.move(x + dx, y + dy, { steps: 8 })
  await page.mouse.up()
}
