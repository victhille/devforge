// ─── Required tool versions per project ──────────────────────────────────────

export type RuntimeTool = 'node' | 'php' | 'python'

export interface VersionRequirement {
  tool: RuntimeTool
  /** Range as written in the project, e.g. ">=18", "^8.1", "3.11" */
  range: string
  /** Where it comes from, e.g. ".nvmrc", "package.json engines" */
  source: string
}

export interface ProjectRequirements {
  projectPath: string
  requirements: VersionRequirement[]
}

export interface VersionsAPI {
  requirements: (projectPaths: string[]) => Promise<ProjectRequirements[]>
}
