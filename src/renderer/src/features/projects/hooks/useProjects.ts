import { useCallback, useEffect, useState } from 'react'
import type { DetectedProject, Framework, GitStatus, Project } from '@shared/types'
import { FRAMEWORK_LABEL } from '@renderer/components/ui/FrameworkIcon'
import { useProjectList } from '@renderer/hooks/useLiveData'
import { setLive } from '@renderer/lib/live'

const NO_GIT: GitStatus = { branch: null, dirty: false, ahead: 0, behind: 0 }
const NO_PROJECTS: Project[] = []
/** A change made here, shown at once in every page (the main process confirms it, and the list is read again) */
const setProjects = (change: (list: Project[]) => Project[]) => setLive<Project[]>('projects', list => change(list ?? []))

interface Options {
  /** Also load git status and package.json scripts for each project */
  withDetails?: boolean
}

/** Saved projects + common actions, shared by Home and Projects pages. */
export function useProjects({ withDetails = false }: Options = {}) {
  // v4.2: the kept list, shown at once when coming back, read again when it changes (here, Forgy, another window)
  const live = useProjectList()
  const projects = live.data ?? NO_PROJECTS
  const loaded = live.loaded
  const [gitStatuses, setGitStatuses] = useState<Record<string, GitStatus>>({})
  const [scripts,     setScripts]     = useState<Record<string, Record<string, string>>>({})

  // Git and scripts again only when the projects themselves change, not when one is opened or starred
  const which = projects.map(p => `${p.id}=${p.path}`).join('|')
  useEffect(() => {
    if (!withDetails || !which) return
    const list = which.split('|').map(x => { const at = x.indexOf('='); return { id: x.slice(0, at), path: x.slice(at + 1) } })
    let alive = true
    Promise.all(list.map(p =>
      window.devforge.getGitStatus(p.path)
        .then(s => [p.id, s] as const)
        .catch(() => [p.id, NO_GIT] as const)
    )).then(entries => { if (alive) setGitStatuses(Object.fromEntries(entries)) })

    Promise.all(list.map(p =>
      window.devforge.getProjectScripts(p.path)
        .then(s => [p.id, s] as const)
        .catch(() => [p.id, {}] as const)
    )).then(entries => { if (alive) setScripts(Object.fromEntries(entries)) })
    return () => { alive = false }
  }, [which, withDetails])

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
      favorite: false,
      // A group's projects show at once (worked out again on each load)
      ...(dp.subprojects ? { subprojects: dp.subprojects, extras: dp.extras } : {})
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

const within = (root: string, path: string) => {
  const r = root.replace(/[/\\]+$/, '').toLowerCase()
  return /^[/\\]/.test(path.slice(r.length)) && path.toLowerCase().startsWith(r)
}

/** v3.5: the projects to list, without those living in a saved group (they show inside it) */
export function hideGroupMembers<P extends { path: string; framework: Framework }>(list: P[]): P[] {
  const groups = list.filter(p => p.framework === 'group')
  return list.filter(p => p.framework === 'group' || !groups.some(g => within(g.path, p.path)))
}

/** One filter per framework the projects (saved or detected) actually use, by name */
export function frameworkFilters(frameworks: Framework[]): Framework[] {
  const seen = [...new Set(frameworks)].filter(fw => fw !== 'unknown')
  return seen.sort((a, b) => (FRAMEWORK_LABEL[a] ?? a).localeCompare(FRAMEWORK_LABEL[b] ?? b))
}
