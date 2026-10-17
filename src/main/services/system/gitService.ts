import { execSync } from 'child_process'
import type { GitStatus } from '@shared/types'

export function getGitStatus(projectPath: string): GitStatus {
  try {
    const branch = execSync(
      `git -C "${projectPath}" rev-parse --abbrev-ref HEAD`,
      { encoding: 'utf-8', timeout: 3000 }
    ).trim()

    const status = execSync(
      `git -C "${projectPath}" status --porcelain`,
      { encoding: 'utf-8', timeout: 3000 }
    )
    const dirty = status.trim().length > 0

    let ahead = 0
    let behind = 0
    try {
      const counts = execSync(
        `git -C "${projectPath}" rev-list --left-right --count HEAD...@{upstream}`,
        { encoding: 'utf-8', timeout: 3000 }
      ).trim()
      const parts = counts.split(/\s+/)
      ahead  = parseInt(parts[0]) || 0
      behind = parseInt(parts[1]) || 0
    } catch { /* no upstream */ }

    return { branch: branch || null, dirty, ahead, behind }
  } catch {
    return { branch: null, dirty: false, ahead: 0, behind: 0 }
  }
}
