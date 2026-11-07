import { readFileSync } from 'fs'
import type { Page } from '@playwright/test'

const AXE = readFileSync(require.resolve('axe-core/axe.min.js'), 'utf-8')

export interface AxeIssue { id: string; impact: string | null; nodes: string[] }

/** WCAG 2 A/AA problems of the page (evaluated through the debugger, so the app's CSP stays as it is) */
export async function axeIssues(page: Page): Promise<AxeIssue[]> {
  if (!(await page.evaluate(() => 'axe' in window))) await page.evaluate(AXE)
  return page.evaluate(async () => {
    const r = await (window as unknown as { axe: { run: (ctx: Document, o: object) => Promise<{ violations: { id: string; impact: string | null; nodes: { target: string[]; failureSummary?: string }[] }[] }> } })
      .axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa'] } })
    return r.violations.map(v => ({ id: v.id, impact: v.impact, nodes: v.nodes.map(n => `${n.target.join(' ')} :: ${(n.failureSummary ?? '').split('\n').slice(1, 2).join(' ').trim()}`) }))
  })
}

/** axeIssues once every fade-in is over: half-faded text would fail contrast */
export async function settledAxeIssues(page: Page): Promise<AxeIssue[]> {
  await page.evaluate(async () => {
    for (let i = 0; i < 20; i++) {
      // Looping ones (Forgy, spinners) never end: only the fade-ins count
      const running = document.getAnimations().filter(a => a.playState === 'running' && a.effect?.getTiming().iterations !== Infinity)
      if (!running.length) break
      await Promise.race([Promise.all(running.map(a => a.finished.catch(() => {}))), new Promise(r => setTimeout(r, 1000))])
      await new Promise(r => requestAnimationFrame(() => r(null)))
    }
  })
  return axeIssues(page)
}
