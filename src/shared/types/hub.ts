// ─── Project hub: a project and everything that belongs to it ─────────────────

import type { Project } from './index'
import type { VercelLink } from './vercel'

/** How a resource is tied to the project: found by DevForge, or added by hand */
export type LinkOrigin = 'auto' | 'manual'

export type LinkKind = 'databases' | 'logs' | 'domains'

export interface ProjectHub {
  project: Project
  /** Folder of the compose file (the project or its parent), null when none */
  composeDir: string | null
  composeName: string | null
  /** .env files with their number of keys (never the values) */
  envFiles: { name: string; keys: number }[]
  databases: { id: string; name: string; type: string; origin: LinkOrigin }[]
  logs: { path: string; size: number; modifiedAt: string; origin: LinkOrigin }[]
  domains: { id: string; domain: string; port: number; enabled: boolean; origin: LinkOrigin }[]
  /** Ports the project serves on: .env, scripts, compose */
  ports: { port: number; source: string }[]
  deployTargets: { id: string; name: string }[]
  /** .vercel/project.json (`vercel link`), null when the folder is not linked */
  vercel: VercelLink | null
  /** Resources found but hidden by the user, so they can be shown again */
  hidden: Record<LinkKind, string[]>
}

export interface HubAPI {
  get: (projectId: string) => Promise<ProjectHub>
  /** Ties (linked = true) or unties a resource; an automatic one is hidden instead */
  link: (projectId: string, kind: LinkKind, ref: string, linked: boolean) => Promise<ProjectHub>
  /** The project the app, Forgy and the widget work on (null: none) */
  getActive: () => Promise<string | null>
  setActive: (projectId: string | null) => Promise<void>
  onActive: (cb: (projectId: string | null) => void) => () => void
}
