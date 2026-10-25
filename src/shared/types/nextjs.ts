// ─── Next.js workshop (v2.2 lot 6) ─────────────────────────────────────────────

import type { SfApiConfig, SfEntity, SfEntityDraft, SfMigration, SfWriteResult } from './symfony'

export interface NextStatus {
  /** prisma is a dependency and prisma/schema.prisma exists */
  prisma: boolean
  provider: string | null
  /** Major version of Prisma (7: driver adapters, generated client folder) */
  prismaVersion: number | null
  /** @prisma/client (and the driver adapter with Prisma 7) are installed */
  client: boolean
  /** lib/prisma.ts, the client shared by routes and seed */
  libPrisma: boolean
  database: { reachable: boolean; error: string | null }
  /** compose.yaml has a "database" service */
  composeDatabase: boolean
  /** tsx and @faker-js/faker, for the seed */
  seedTools: boolean
  authjs: boolean
  packageManager: 'npm' | 'pnpm' | 'yarn'
  typescript: boolean
}

export interface NextInspect {
  status: NextStatus
  entities: SfEntity[]
  migrations: SfMigration[]
}

export interface NextRoute {
  /** URL path: /api/produits/[id] */
  path: string
  /** Exported HTTP handlers of a route.ts; empty for a page */
  methods: string[]
  kind: 'page' | 'api'
  file: string
}

export type NextCommand =
  | 'db:start' | 'prisma:migrate' | 'prisma:deploy' | 'prisma:generate' | 'prisma:studio'
  | 'install:prisma' | 'install:client' | 'install:seed' | 'seed' | 'dev'

export interface NextjsAPI {
  inspect: (projectPath: string) => Promise<NextInspect>
  routes: (projectPath: string) => Promise<NextRoute[]>
  /** Runs in the console; resolves with the task id */
  run: (projectPath: string, command: NextCommand, arg?: string) => Promise<string>
  writeModel: (projectPath: string, draft: SfEntityDraft) => Promise<SfWriteResult>
  /** lib/prisma.ts: one client for the whole app (and its driver adapter with Prisma 7) */
  writePrismaClient: (projectPath: string) => Promise<SfWriteResult>
  apiConfig: (projectPath: string) => Promise<SfApiConfig | null>
  applyApi: (projectPath: string, config: SfApiConfig) => Promise<SfWriteResult>
  /** Writes prisma/seed.ts for these counts, then runs it: one console task */
  writeSeed: (projectPath: string, counts: Record<string, number>) => Promise<string>
}
