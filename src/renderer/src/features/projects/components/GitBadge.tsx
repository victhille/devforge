import { GitBranch } from 'lucide-react'
import type { GitStatus } from '@shared/types'

export default function GitBadge({ status }: { status: GitStatus | null | undefined }) {
  if (!status?.branch) return null
  return (
    <span
      className="inline-flex items-center gap-1 rounded bg-elevated px-1.5 py-px font-mono text-2xs text-fg-secondary"
      title={status.dirty ? 'Uncommitted changes' : undefined}
    >
      <GitBranch size={9} />
      {status.branch}
      {status.dirty && <span className="size-1.5 rounded-full bg-warning" />}
    </span>
  )
}
