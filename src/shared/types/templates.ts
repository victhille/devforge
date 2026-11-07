import type { Framework, PackageManager } from './index'

/** v3.8 lot 5: a project saved as a template, kept in DevForge's data */
export interface UserTemplate {
  id: string
  name: string
  description: string
  framework: Framework
  packageManager: PackageManager
  /** The project it comes from: "update" copies it again */
  sourcePath: string
  /** The name replaced in the copies */
  sourceName: string
  exclude: string[]
  files: number
  bytes: number
  createdAt: string
  updatedAt: string
}

export interface TemplatePreview {
  files: number
  bytes: number
  /** What is left out at the top of the project (node_modules, .env…) */
  skipped: string[]
  /** Over the limit (files or size): cannot be saved */
  tooBig: boolean
}

export interface TemplatesAPI {
  list: () => Promise<UserTemplate[]>
  preview: (projectPath: string, exclude: string[]) => Promise<TemplatePreview>
  /** A project saved as a template */
  save: (input: { projectPath: string; name: string; description: string; framework: Framework; packageManager: PackageManager; exclude: string[] }) => Promise<UserTemplate>
  /** Copied again from its project */
  refresh: (id: string) => Promise<UserTemplate>
  rename: (id: string, name: string, description: string) => Promise<void>
  remove: (id: string) => Promise<void>
}
