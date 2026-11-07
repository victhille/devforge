import type { GithubRun } from '../types'

/**
 * v3.8 lot 2: what the CI watch makes of a project's latest workflow runs:
 * each workflow's last finished run, and what changed since the last look.
 */

export type CiOutcome = 'success' | 'failure'

/** Cancelled, skipped or neutral runs say nothing: the workflow keeps its last word */
const FAILED = new Set(['failure', 'timed_out', 'startup_failure'])

/** Each workflow's last finished run (runs come newest first) */
export function latestByWorkflow(runs: Pick<GithubRun, 'name' | 'status' | 'conclusion' | 'branch'>[]): Record<string, { outcome: CiOutcome; branch: string }> {
  const out: Record<string, { outcome: CiOutcome; branch: string }> = {}
  for (const r of runs) {
    if (r.status !== 'completed' || out[r.name]) continue
    if (r.conclusion === 'success') out[r.name] = { outcome: 'success', branch: r.branch }
    else if (r.conclusion && FAILED.has(r.conclusion)) out[r.name] = { outcome: 'failure', branch: r.branch }
  }
  return out
}

/**
 * The workflows that just broke (green, now red) and those back to green.
 * A workflow seen for the first time alerts nothing: the watch starting up
 * must not ring for every old failure.
 */
export function ciChanges(before: Record<string, CiOutcome> | undefined, now: Record<string, CiOutcome>): { failed: string[]; fixed: string[] } {
  const failed: string[] = []
  const fixed: string[] = []
  for (const [wf, outcome] of Object.entries(now)) {
    const prev = before?.[wf]
    if (prev === 'success' && outcome === 'failure') failed.push(wf)
    if (prev === 'failure' && outcome === 'success') fixed.push(wf)
  }
  return { failed, fixed }
}
