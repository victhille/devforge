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
