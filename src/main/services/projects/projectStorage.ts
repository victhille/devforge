import { existsSync, readFileSync, mkdirSync, statSync } from 'fs'
import { join, dirname, parse } from 'path'
import { app } from 'electron'
import type { Project } from '@shared/types'
import { managerOf } from '@shared/lib/packageManagers'
import { writeJsonFile } from '../../lib/jsonFile'
import { dataChanged } from '../../lib/changes'

function getStoragePath(): string {
  const dataDir = app.getPath('userData')
  return join(dataDir, 'projects.json')
}

export function loadProjects(): Project[] {
  const path = getStoragePath()
  if (!existsSync(path)) return []
  try {
    const list = JSON.parse(readFileSync(path, 'utf-8')) as Project[]
    // An imported file or the window may have written any package manager: it goes into commands
    return Array.isArray(list) ? list.filter(p => p && typeof p === 'object').map(p => ({ ...p, packageManager: managerOf(p.packageManager) })) : []
  } catch {
    return []
  }
}

/** Paths of saved projects: used to restrict file access to known projects. */
export function getProjectPaths(): Set<string> {
  return new Set(loadProjects().map(p => p.path))
}

function persist(projects: Project[]): void {
  const path = getStoragePath()
  mkdirSync(dirname(path), { recursive: true })
  writeJsonFile(
    path,
    projects.map(({ missing: _missing, subprojects: _subprojects, extras: _extras, ...p }) => p)
  )
  // Every list of projects in the windows follows
  dataChanged('projects')
}

export function saveProject(project: Project): void {
  const projects = loadProjects()
  const idx = projects.findIndex(p => p.id === project.id)
  if (idx >= 0) {
    projects[idx] = project
  } else {
    projects.unshift(project)
  }
  persist(projects)
}

// ─── Projects whose folder is gone ───────────────────────────────────────────

const prunedPath = () => join(app.getPath('userData'), 'projects-pruned.json')

/**
 * Whether a missing folder is really gone, not just out of reach: the disk it was on is
 * there (a USB key or a drive letter that is not plugged in keeps its projects), and it
 * is not on a network share (offline for a while, or slow to answer).
 */
export function isGone(path: string): boolean {
  if (!path || /^(\\\\|\/\/)/.test(path)) return false
  const root = parse(path).root
  if (!root || !existsSync(root)) return false
  try {
    statSync(path)
    return false
  } catch (err) {
    // Only "it is not there": a folder refused for a while (rights, an antivirus) stays
    const code = (err as NodeJS.ErrnoException).code
    return code === 'ENOENT' || code === 'ENOTDIR'
  }
}

/**
 * Takes out of DevForge the projects whose folder no longer exists (moved, deleted, renamed):
 * nothing on disk is touched. They join those taken out before and not put back yet, so that
 * a second clean-up before Undo loses none of them.
 */
export function pruneMissing(): Project[] {
  const projects = loadProjects()
  const gone = projects.filter(p => isGone(p.path))
  if (!gone.length) return []
  const ids = new Set(gone.map(p => p.id))
  writeJsonFile(prunedPath(), [...readPruned().filter(p => !ids.has(p.id)), ...gone])
  persist(projects.filter(p => !ids.has(p.id)))
  return gone
}

function readPruned(): Project[] {
  try {
    const list = JSON.parse(readFileSync(prunedPath(), 'utf-8')) as Project[]
    return Array.isArray(list) ? list.filter(p => p && typeof p.id === 'string' && typeof p.path === 'string') : []
  } catch {
    return []
  }
}

/** Puts back the last projects taken out, those not added again in the meantime */
export function restorePruned(): Project[] {
  const back = readPruned()
  const projects = loadProjects()
  const known = new Set(projects.flatMap(p => [p.id, p.path]))
  const added = back.filter(p => !known.has(p.id) && !known.has(p.path)).map(p => ({ ...p, packageManager: managerOf(p.packageManager) }))
  if (added.length) persist([...projects, ...added])
  writeJsonFile(prunedPath(), [])
  return added
}

export function removeProject(id: string): void {
  const projects = loadProjects().filter(p => p.id !== id)
  persist(projects)
}

export function updateLastOpened(id: string): void {
  const projects = loadProjects()
  const project = projects.find(p => p.id === id)
  if (project) {
    project.lastOpenedAt = new Date().toISOString()
    persist(projects)
  }
}

export function toggleFavorite(id: string): void {
  const projects = loadProjects()
  const project = projects.find(p => p.id === id)
  if (project) {
    project.favorite = !project.favorite
    persist(projects)
  }
}
