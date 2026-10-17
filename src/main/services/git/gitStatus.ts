import type { GitStatus } from '@shared/types'
import { runFile } from '../../lib/exec'

const NO_GIT: GitStatus = { branch: null, dirty: false, ahead: 0, behind: 0 }

/**
 * Branch, dirty flag and ahead/behind in a single git call
 * (`status --porcelain=v2 --branch`), async so it never blocks the UI.
 */
export async function getGitStatus(projectPath: string): Promise<GitStatus> {
  const r = await runFile('git', ['-C', projectPath, 'status', '--porcelain=v2', '--branch'], { timeout: 4000 })
  if (!r.ok) return NO_GIT
  const out = r.stdout

  let branch: string | null = null
  let ahead = 0
  let behind = 0
  let dirty = false

  for (const line of out.split('\n')) {
    if (line.startsWith('# branch.head ')) {
      const head = line.slice('# branch.head '.length).trim()
      branch = head === '(detached)' ? 'HEAD' : head
    } else if (line.startsWith('# branch.ab ')) {
      const m = line.match(/\+(\d+) -(\d+)/)
      if (m) { ahead = parseInt(m[1]); behind = parseInt(m[2]) }
    } else if (line && !line.startsWith('#')) {
      dirty = true
    }
  }

  return { branch, dirty, ahead, behind }
}
