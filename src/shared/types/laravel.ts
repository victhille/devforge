// ─── Laravel workshop (v2.2 lot 6) ─────────────────────────────────────────────

import type { SfApiConfig, SfEntity, SfEntityDraft, SfMigration, SfRoute, SfWriteResult } from './symfony'

export interface LaravelStatus {
  /** php artisan answers; otherwise `error` says why (NO_VENDOR, or PHP's message) */
  booted: boolean
  error: string | null
  version: string | null
  /** DB_CONNECTION in .env: pgsql, mysql, sqlite… */
  connection: string | null
  database: { reachable: boolean; error: string | null }
  /** compose.yaml has a "database" service */
  composeDatabase: boolean
  /** routes/api.php exists (php artisan install:api) */
  api: boolean
  /** fakerphp/faker is installed (the skeleton has it in require-dev) */
  faker: boolean
  /** Runs in Sail (v2.3 lot 5): PHP and Composer in the app's container, through docker compose */
  sail: boolean
  /** Where the app answers: Sail's APP_PORT, or php artisan serve's */
  appUrl: string
}

export interface LaravelInspect {
  status: LaravelStatus
  entities: SfEntity[]
  migrations: SfMigration[]
}

export type LaravelCommand =
  | 'composer:install' | 'db:start' | 'make:migration' | 'migrate' | 'migrate:rollback'
  | 'install:api' | 'seed' | 'serve' | 'optimize:clear' | 'sail:stop'

export interface LaravelAPI {
  inspect: (projectPath: string) => Promise<LaravelInspect>
  routes: (projectPath: string) => Promise<SfRoute[]>
  /** Runs in the console; resolves with the task id */
  run: (projectPath: string, command: LaravelCommand, arg?: string) => Promise<string>
  /** app/Models/<Name>.php and its migration, the other side of each link */
  writeModel: (projectPath: string, draft: SfEntityDraft) => Promise<SfWriteResult>
  apiConfig: (projectPath: string) => Promise<SfApiConfig | null>
  /** Controllers in app/Http/Controllers/Api and DevForge's block in routes/api.php */
  applyApi: (projectPath: string, config: SfApiConfig) => Promise<SfWriteResult>
  /** Factories and DevForgeSeeder for these counts, then db:seed: one console task */
  writeSeed: (projectPath: string, counts: Record<string, number>) => Promise<string>
}
