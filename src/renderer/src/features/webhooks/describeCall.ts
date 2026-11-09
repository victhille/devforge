import type { CapturedRequest } from '@shared/types'

/**
 * What a call is, as the mock-up names it: Stripe's event type, GitHub's event
 * and repository, a « type » or « event » in the JSON, else the path; and who sent it.
 */
export function describeCall(r: Pick<CapturedRequest, 'url' | 'headers' | 'body'>): { name: string; source: string | null } {
  let json: Record<string, unknown> | null = null
  try { const v = JSON.parse(r.body) as unknown; if (v && typeof v === 'object' && !Array.isArray(v)) json = v as Record<string, unknown> } catch { /* not JSON */ }
  const text = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, 80) : null)
  const agent = r.headers['user-agent'] ?? ''
  const source = r.headers['stripe-signature'] || /^Stripe/i.test(agent) ? 'Stripe'
    : r.headers['x-github-event'] || /^GitHub-Hookshot/i.test(agent) ? 'GitHub'
    : r.headers['x-gitlab-event'] ? 'GitLab'
    : text(agent.split(/[\s/]/)[0])
  const github = text(r.headers['x-github-event'])
  if (github) {
    const repo = text((json?.repository as Record<string, unknown> | undefined)?.name)
    return { name: repo ? `${github} · ${repo}` : github, source }
  }
  return { name: text(json?.type) ?? text(json?.event) ?? text(r.headers['x-gitlab-event']) ?? (r.url || '/'), source }
}
