import { useCallback, useEffect, useState } from 'react'
import type { DetectedProject, Framework, GitStatus, Project } from '@shared/types'
import { FRAMEWORK_LABEL } from '@renderer/components/ui/FrameworkIcon'

const NO_GIT: GitStatus = { branch: null, dirty: false, ahead: 0, behind: 0 }

interface Options {
  /** Also load git status and package.json scripts for each project */
  withDetails?: boolean
}

/** Saved projects + common actions, shared by Home and Projects pages. */
export function useProjects({ withDetails = false }: Options = {}) {
  const [projects,    setProjects]    = useState<Project[]>([])
  const [loaded,      setLoaded]      = useState(false)
  const [gitStatuses, setGitStatuses] = useState<Record<string, GitStatus>>({})
  const [scripts,     setScripts]     = useState<Record<string, Record<string, string>>>({})

  useEffect(() => {
    window.devforge.getProjects().then(list => {
      setProjects(list)
      setLoaded(true)
      if (!withDetails) return

      Promise.all(list.map(p =>
        window.devforge.getGitStatus(p.path)
          .then(s => [p.id, s] as const)
          .catch(() => [p.id, NO_GIT] as const)
      )).then(entries => setGitStatuses(Object.fromEntries(entries)))

      Promise.all(list.map(p =>
        window.devforge.getProjectScripts(p.path)
          .then(s => [p.id, s] as const)
          .catch(() => [p.id, {}] as const)
      )).then(entries => setScripts(Object.fromEntries(entries)))
    })
  }, [withDetails])

  const open = useCallback(async (p: Project | DetectedProject) => {
    if ('id' in p) {
      await window.devforge.updateProjectLastOpened(p.id)
      const now = new Date().toISOString()
      setProjects(prev => prev.map(x => (x.id === p.id ? { ...x, lastOpenedAt: now } : x)))
    }
    await window.devforge.openDirectory(p.path)
  }, [])

  const openTerminal = useCallback((path: string) => window.devforge.openTerminal(path), [])

  const toggleFavorite = useCallback(async (id: string) => {
    await window.devforge.toggleFavorite(id)
    setProjects(prev => prev.map(p => (p.id === id ? { ...p, favorite: !p.favorite } : p)))
  }, [])

  const remove = useCallback(async (id: string) => {
    await window.devforge.removeProject(id)
    setProjects(prev => prev.filter(p => p.id !== id))
  }, [])

  const importDetected = useCallback(async (dp: DetectedProject) => {
    const project: Project = {
      id: crypto.randomUUID(),
      name: dp.name,
      path: dp.path,
      framework: dp.framework,
      packageManager: dp.packageManager,
      createdAt: new Date().toISOString(),
      lastOpenedAt: null,
      favorite: false
    }
    await window.devforge.saveProject(project)
    setProjects(prev => [project, ...prev])
  }, [])

  return {
    projects, loaded, gitStatuses, scripts,
    open, openTerminal, toggleFavorite, remove, importDetected
  }
}

/** Favorites first, then most recently opened. */
export function sortProjects(list: Project[]): Project[] {
  return [...list].sort((a, b) => {
    if (a.favorite !== b.favorite) return a.favorite ? -1 : 1
    return (b.lastOpenedAt ?? '').localeCompare(a.lastOpenedAt ?? '')
  })
}

/** One filter per framework the projects (saved or detected) actually use, by name */
export function frameworkFilters(frameworks: Framework[]): Framework[] {
  const seen = [...new Set(frameworks)].filter(fw => fw !== 'unknown')
  return seen.sort((a, b) => (FRAMEWORK_LABEL[a] ?? a).localeCompare(FRAMEWORK_LABEL[b] ?? b))
}
