// ─── Symfony workshop (v2.2 lot 2) ─────────────────────────────────────────────

export type SfFieldType = 'string' | 'text' | 'integer' | 'float' | 'decimal' | 'boolean' | 'date' | 'datetime' | 'json'

export interface SfField {
  name: string
  type: SfFieldType
  nullable: boolean
  unique: boolean
  /** string */
  length?: number
  /** decimal */
  precision?: number
  scale?: number
}

/** Seen from the entity that holds it */
export type SfRelationKind = 'ManyToOne' | 'OneToMany' | 'ManyToMany' | 'OneToOne'

export interface SfRelation {
  name: string
  kind: SfRelationKind
  /** Short class name: "User" */
  target: string
  /** Property on the other side, null when one-way */
  inverse: string | null
  /** ManyToOne / OneToOne: the link may be empty */
  nullable: boolean
  /** Prisma and Laravel: the foreign key column, on the side that holds it (categorieId) */
  fk?: string
}

export interface SfEntity {
  name: string
  table: string
  /** Relative to the project */
  file: string
  fields: SfField[]
  relations: SfRelation[]
  /** Exposed with API Platform (#[ApiResource]) */
  apiResource: boolean
}

export interface SfDatabase {
  configured: boolean
  driver: string
  /** host:port/name or the SQLite file, no password */
  target: string
  reachable: boolean
  error: string | null
}

export interface SfStatus {
  /** composer.json requires symfony/framework-bundle */
  symfony: boolean
  /** The kernel booted, so entities and the database could be read */
  booted: boolean
  error: string | null
  version: string | null
  database: SfDatabase | null
  /** compose.yaml has a "database" service */
  composeDatabase: boolean
  packages: { orm: boolean; maker: boolean; apiPlatform: boolean; serializer: boolean; validator: boolean; security: boolean; fixtures: boolean; foundry: boolean }
  /** Symfony CLI on this PC (local web server) */
  symfonyCli: boolean
  hasUserEntity: boolean
}

export interface SfMigration {
  version: string
  description: string
  executed: boolean
  executedAt: string | null
  /** Relative path, null for a version that has no file any more */
  file: string | null
  /** SQL of up() */
  sql: string[]
  /** DROP, or a column removed: data can be lost */
  dangerous: boolean
}

export interface SfRoute {
  name: string
  path: string
  /** Empty: any method */
  methods: string[]
  controller: string
}

export interface SfInspect {
  status: SfStatus
  entities: SfEntity[]
  migrations: SfMigration[]
}

/** A new entity, or fields and relations added to an existing one */
export interface SfEntityDraft {
  name: string
  existing: boolean
  fields: SfField[]
  relations: SfRelation[]
}

export type SfOperation = 'list' | 'show' | 'create' | 'update' | 'delete'
export type SfApiMode = 'platform' | 'json'

export interface SfApiConfig {
  mode: SfApiMode
  /** Entity name → exposed operations and hidden fields */
  entities: Record<string, { operations: SfOperation[]; hidden: string[] }>
}

/** What a write did, for the user to see */
export interface SfWriteResult {
  created: string[]
  changed: string[]
  removed: string[]
}

export type SfCommand =
  | 'database:create' | 'database:start' | 'migrations:diff' | 'migrations:migrate' | 'migrations:prev'
  | 'cache:clear' | 'server:start' | 'server:stop' | 'install:api-platform' | 'install:serializer' | 'install:fixtures'
  | 'install:maker' | 'install:orm' | 'composer:install' | 'make:user' | 'make:login' | 'make:crud' | 'make:controller' | 'fixtures:load'

export interface SymfonyAPI {
  inspect: (projectPath: string) => Promise<SfInspect>
  routes: (projectPath: string) => Promise<SfRoute[]>
  /** Runs in the console; resolves with the task id */
  run: (projectPath: string, command: SfCommand, arg?: string) => Promise<string>
  writeEntity: (projectPath: string, draft: SfEntityDraft) => Promise<SfWriteResult>
  apiConfig: (projectPath: string) => Promise<SfApiConfig | null>
  applyApi: (projectPath: string, config: SfApiConfig) => Promise<SfWriteResult>
  /** Writes the factories that are missing and AppFixtures; then run fixtures:load */
  writeFixtures: (projectPath: string, counts: Record<string, number>) => Promise<string>
  /** Points DATABASE_URL (.env.local) at a saved Database connection */
  useConnection: (projectPath: string, connectionId: string) => Promise<void>
  serverUrl: (projectPath: string) => Promise<string | null>
  /** Forgy filled the entity form of a project */
  onDraft: (callback: (e: { projectId: string; projectPath: string; draft: SfEntityDraft }) => void) => () => void
}
