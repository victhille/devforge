// ─── Vercel: deployments of a project, env keys, domains ──────────────────────

export interface VercelAccount {
  /** A personal access token is saved (encrypted, never sent to the window) */
  connected: boolean
  username: string | null
}

/** .vercel/project.json, written by `vercel link` */
export interface VercelLink {
  projectId: string
  orgId: string
}

export interface VercelDeployment {
  id: string
  url: string
  /** READY, BUILDING, ERROR, QUEUED, CANCELED, INITIALIZING */
  state: string
  /** "production" or null for a preview */
  target: string | null
  createdAt: number
  branch: string | null
  commitMessage: string | null
  creator: string | null
  /** The deployment production currently points to */
  current: boolean
}

export interface VercelEnvDiff {
  /** Keys set on Vercel for production, preview or development */
  remote: { key: string; targets: string[] }[]
  /** In the local .env but on Vercel for no target */
  missingRemote: string[]
  /** On Vercel but not in the local .env */
  missingLocal: string[]
  localFile: string | null
}

export interface VercelDomain {
  name: string
  verified: boolean
  /** DNS does not point to Vercel (certificate cannot be issued) */
  misconfigured: boolean | null
  redirect: string | null
}

export interface VercelProjectInfo {
  link: VercelLink
  name: string
  framework: string | null
  productionUrl: string | null
}

export interface VercelAPI {
  account: () => Promise<VercelAccount>
  /** Checks the token against Vercel before keeping it; null removes it */
  saveToken: (token: string | null) => Promise<VercelAccount>
  /** null when the project folder is not linked (no .vercel/project.json) */
  project: (projectId: string) => Promise<VercelProjectInfo | null>
  deployments: (projectId: string) => Promise<VercelDeployment[]>
  buildLogs: (projectId: string, deploymentId: string) => Promise<string>
  redeploy: (projectId: string, deploymentId: string) => Promise<VercelDeployment>
  /** Points production to this deployment (a preview, or an older production one) */
  promote: (projectId: string, deploymentId: string) => Promise<void>
  env: (projectId: string) => Promise<VercelEnvDiff>
  domains: (projectId: string) => Promise<VercelDomain[]>
}
