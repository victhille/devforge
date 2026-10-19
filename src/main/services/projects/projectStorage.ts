import { existsSync, readFileSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { app } from 'electron'
import type { Project } from '@shared/types'
import { writeJsonFile } from '../../lib/jsonFile'

function getStoragePath(): string {
  const dataDir = app.getPath('userData')
  return join(dataDir, 'projects.json')
}

export function loadProjects(): Project[] {
  const path = getStoragePath()
  if (!existsSync(path)) return []
  try {
    return JSON.parse(readFileSync(path, 'utf-8')) as Project[]
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
  writeJsonFile(path, projects)
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
  const project  = projects.find(p => p.id === id)
  if (project) {
    project.favorite = !project.favorite
    persist(projects)
  }
}
