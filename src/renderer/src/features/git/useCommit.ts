import { useCallback, useEffect, useMemo, useState } from 'react'
import type { FileChangeStatus, GitFileChange } from '@shared/types'
import { useI18n } from '@renderer/i18n/I18nContext'
import { useToast } from '@renderer/app/ToastContext'

/** The letter of a changed file and its colour (A, U, M, D, R) */
export const STATUS_LETTER: Record<FileChangeStatus, { letter: string; className: string }> = {
  added:     { letter: 'A', className: 'text-success' },
  untracked: { letter: 'U', className: 'text-success' },
  modified:  { letter: 'M', className: 'text-warning' },
  deleted:   { letter: 'D', className: 'text-danger' },
  renamed:   { letter: 'R', className: 'text-accent' }
}

/**
 * A commit being prepared in a repository: its changed files (all chosen at
 * first), then commit, or commit and push. Shared by the commit window (Git page)
 * and the « Files and Git » tab of a project. `rev` reads the changes again.
 */
export function useCommit(path: string, onDone: () => void, rev = 0) {
  const { t } = useI18n()
  const g = t.gitDash
  const toast = useToast()
  const [changes, setChanges] = useState<GitFileChange[] | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState<'commit' | 'push' | null>(null)

  useEffect(() => {
    let alive = true
    window.devforge.git.changes(path).then(list => {
      if (!alive) return
      setChanges(list)
      setSelected(new Set(list.map(c => c.path)))
    }).catch(() => { if (alive) setChanges([]) })
    return () => { alive = false }
  }, [path, rev])

  const chosen = useMemo(() => (changes ?? []).filter(c => selected.has(c.path)), [changes, selected])

  const toggle = useCallback((file: string, on: boolean) => setSelected(prev => {
    const next = new Set(prev)
    if (on) next.add(file); else next.delete(file)
    return next
  }), [])

  async function commit(message: string, push: boolean) {
    setBusy(push ? 'push' : 'commit')
    try {
      const r = await window.devforge.git.commit(path, message, chosen.map(c => c.path))
      if (!r.ok) {
        toast.show({ tone: 'error', title: g.commitFailed, description: r.output })
        return
      }
      if (push) {
        const p = await window.devforge.git.push(path)
        toast.show(p.ok
          ? { tone: 'success', title: g.committedPushed }
          : { tone: 'error', title: g.committedPushFailed, description: p.output })
      } else {
        toast.show({ tone: 'success', title: g.committed, description: message.split('\n')[0] })
      }
      onDone()
    } finally {
      setBusy(null)
    }
  }

  return { changes, selected, setSelected, toggle, chosen, busy, commit }
}

export type CommitState = ReturnType<typeof useCommit>
