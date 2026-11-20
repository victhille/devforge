import { useEffect } from 'react'
import { useToast } from '@renderer/app/ToastContext'
import { useI18n } from '@renderer/i18n/I18nContext'

type Show = ReturnType<typeof useToast>['show']
type Words = { pruned: string; prunedOne: string; undo: string; restored: string }

/**
 * Takes out of DevForge the projects whose folder is gone (moved, deleted), says which
 * ones, and offers to put them back. Nothing on disk is touched.
 */
export async function pruneAndTell(show: Show, w: Words): Promise<number> {
  const gone = await window.devforge.pruneMissingProjects().catch(() => [])
  if (!gone.length) return 0
  const names = gone.map(p => p.name)
  show({
    tone: 'info',
    title: gone.length === 1 ? w.prunedOne.replace('{name}', names[0]) : w.pruned.replace('{count}', String(gone.length)),
    description: gone.length > 1 ? names.slice(0, 6).join(', ') + (names.length > 6 ? '…' : '') : undefined,
    action: {
      label: w.undo,
      onClick: () =>
        window.devforge
          .restorePrunedProjects()
          .then(back => back.length && show({ tone: 'success', title: w.restored.replace('{count}', String(back.length)) }))
          .catch(() => {})
    }
  })
  return gone.length
}

/** Once per start, a few seconds in: the list is cleaned without anyone asking */
export function MissingProjectsWatch() {
  const { show } = useToast()
  const { t } = useI18n()
  useEffect(() => {
    const id = window.setTimeout(() => void pruneAndTell(show, t.hub), 3000)
    return () => clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once per start, whatever the language does later
  }, [])
  return null
}
