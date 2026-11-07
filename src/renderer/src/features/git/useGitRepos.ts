import { useCallback, useEffect, useRef, useState } from 'react'
import type { GitActionResult, GitRepoDetails, Project } from '@shared/types'
import { useProjectList } from '@renderer/hooks/useLiveData'
import { errorText } from '@renderer/lib/errors'

export interface RepoRow {
  project: Project
  details: GitRepoDetails | null
  busy: 'fetch' | 'pull' | 'push' | null
}

/** Saved projects with their git details, plus fetch/pull/push actions. */
export function useGitRepos() {
  // v4.2: the shared project list: a project added or removed shows up here at once
  const { data: projects, error } = useProjectList()
  const [rows, setRows] = useState<RepoRow[]>([])
  /** Readings of the repositories under way (two may overlap: a refresh during a reading) */
  const [reading, setReading] = useState(0)
  /** The list last read: the same projects given again (a list refreshed in the background) do not run git twice */
  const lastList = useRef('')

  const patch = (id: string, p: Partial<RepoRow>) =>
    setRows(prev => prev.map(r => (r.project.id === id ? { ...r, ...p } : r)))

  const refreshOne = useCallback(async (project: Project, fresh = false) => {
    try {
      patch(project.id, { details: await window.devforge.git.details(project.path, fresh) })
    } catch { /* keep previous details */ }
  }, [])

  const load = useCallback(async (list: Project[], fresh = false) => {
    setReading(n => n + 1)
    try {
      // Each row keeps its details and its running action while the list is read again
      setRows(prev => list.map(project => {
        const was = prev.find(r => r.project.id === project.id)
        return { project, details: was?.details ?? null, busy: was?.busy ?? null }
      }))
      await Promise.all(list.map(p => refreshOne(p, fresh)))
    } finally {
      setReading(n => n - 1)
    }
  }, [refreshOne])

  useEffect(() => {
    if (!projects) return
    const key = JSON.stringify(projects)
    if (key === lastList.current) return
    lastList.current = key
    void load(projects)
  }, [projects, load])

  const runAction = useCallback(async (project: Project, kind: 'fetch' | 'pull' | 'push'): Promise<GitActionResult> => {
    patch(project.id, { busy: kind })
    try {
      const result = await window.devforge.git[kind](project.path)
      await refreshOne(project)
      return result
    } finally {
      patch(project.id, { busy: null })
    }
  }, [refreshOne])

  /** Fetch every repo, 4 at a time to stay gentle with the network. */
  const fetchAll = useCallback(async (repos: Project[]) => {
    const queue = [...repos]
    const worker = async () => {
      for (let p = queue.shift(); p; p = queue.shift()) await runAction(p, 'fetch')
    }
    await Promise.all(Array.from({ length: 4 }, worker))
  }, [runAction])

  // Refresh button: read every repository again
  const reload = useCallback(async () => { if (projects) await load(projects, true) }, [projects, load])

  // Loading while the list is not read (unless it could not be), then while git is
  const loading = reading > 0 || (!projects && !error)

  return { rows, loading, error: error ? errorText(error) : '', reload, runAction, fetchAll, refreshOne }
}
