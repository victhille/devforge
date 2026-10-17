import { useCallback, useEffect, useState } from 'react'
import type { GitActionResult, GitRepoDetails, Project } from '@shared/types'

export interface RepoRow {
  project: Project
  details: GitRepoDetails | null
  busy: 'fetch' | 'pull' | 'push' | null
}

/** Saved projects with their git details, plus fetch/pull/push actions. */
export function useGitRepos() {
  const [rows, setRows] = useState<RepoRow[]>([])
  const [loading, setLoading] = useState(true)

  const patch = (id: string, p: Partial<RepoRow>) =>
    setRows(prev => prev.map(r => (r.project.id === id ? { ...r, ...p } : r)))

  const refreshOne = useCallback(async (project: Project) => {
    try {
      patch(project.id, { details: await window.devforge.git.details(project.path) })
    } catch { /* keep previous details */ }
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const projects = await window.devforge.getProjects()
      setRows(projects.map(project => ({ project, details: null, busy: null })))
      await Promise.all(projects.map(refreshOne))
    } finally {
      setLoading(false)
    }
  }, [refreshOne])

  useEffect(() => { load() }, [load])

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

  return { rows, loading, reload: load, runAction, fetchAll }
}
