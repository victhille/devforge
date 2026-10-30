/** v3.9: the kinds of model the Modeling page makes (the MCD first, the others in the next lots) */
export type ModelKind = 'mcd' | 'mpd' | 'usecase' | 'class' | 'sequence' | 'flow' | 'architecture'

/** An attribute's type, the Merise way (a domain), turned into SQL types by the MPD */
export type McdType = 'int' | 'decimal' | 'varchar' | 'text' | 'bool' | 'date' | 'datetime' | 'time' | 'uuid' | 'json'

export interface McdAttribute {
  id: string
  name: string
  /** '' : not chosen yet (text, for the check) */
  type: McdType | ''
  /** varchar's length */
  length?: number
  /** Part of the entity's identifier (underlined) */
  identifier?: boolean
}

export interface McdEntity {
  id: string
  name: string
  x: number
  y: number
  attributes: McdAttribute[]
}

export interface McdAssociation {
  id: string
  name: string
  x: number
  y: number
  /** Attributes carried by the association (a quantity, a date…) */
  attributes: McdAttribute[]
}

export type Cardinality = '0,1' | '1,1' | '0,n' | '1,n'

/** A leg between an entity and an association, with the entity's cardinality */
export interface McdLink {
  id: string
  entity: string
  association: string
  card: Cardinality
}

export interface ModelNote {
  id: string
  x: number
  y: number
  text: string
}

export interface McdModel {
  entities: McdEntity[]
  associations: McdAssociation[]
  links: McdLink[]
  notes: ModelNote[]
}

/** v3.9 lot 3: how the MLD's names become the MPD's (tables, keys, association tables) */
export interface MldNaming {
  /** commande_produit · COMMANDE_PRODUIT · CommandeProduit */
  tables: 'snake' | 'upper' | 'pascal'
  /** id · id_client (the MCD's identifier, as it is) */
  pk: 'id' | 'keep'
  /** client_id · id_client */
  fk: 'table_id' | 'id_table'
  /** commande_produit (its tables) · contenir (the association) */
  join: 'tables' | 'association'
}

export type SqlEngine = 'postgres' | 'mysql' | 'sqlite'

/** A column's type in the MPD, written for each engine by the SQL */
export type MpdType = 'int' | 'bigint' | 'smallint' | 'decimal' | 'float' | 'varchar' | 'char' | 'text' | 'bool' | 'date' | 'datetime' | 'time' | 'uuid' | 'json'

export interface MpdColumn {
  id: string
  name: string
  type: MpdType
  /** varchar, char: the length; decimal: the precision */
  length?: number
  /** decimal: the digits after the point */
  scale?: number
  pk?: boolean
  /** Numbered by the database (a lone integer primary key) */
  auto?: boolean
  nullable?: boolean
  unique?: boolean
  /** A foreign key: the table and column it points at (their ids) */
  ref?: { table: string; column: string }
  /** Where it comes from in the MCD, to keep hand changes when the MPD is made again */
  from?: string
  /** Changed by hand: a new generation keeps it */
  edited?: boolean
}

export interface MpdIndex {
  id: string
  name: string
  /** Column ids */
  columns: string[]
  unique?: boolean
}

export interface MpdTable {
  id: string
  name: string
  x: number
  y: number
  columns: MpdColumn[]
  indexes: MpdIndex[]
  /** The MCD entity or association it comes from */
  from?: string
  /** Renamed by hand */
  edited?: boolean
}

export interface MpdModel {
  engine: SqlEngine
  naming: MldNaming
  tables: MpdTable[]
  /** The MCD file it was made from, and that MCD's fingerprint then (to tell when it changed) */
  source?: string
  sourceHash?: string
}

/** A model file in the project's conception/ folder */
export interface ModelFile {
  v: 1
  kind: ModelKind
  name: string
  updatedAt: string
  mcd?: McdModel
  /** An MCD's naming for its MPD (lot 3) */
  naming?: MldNaming
  mpd?: MpdModel
}

/** A model in the list: its file name, and enough to draw its thumbnail */
export interface ModelSummary {
  /** File name inside conception/ ("boutique.mcd.json") */
  file: string
  kind: ModelKind
  name: string
  updatedAt: string
  mcd?: McdModel
  naming?: MldNaming
  mpd?: MpdModel
  /** An MPD's SQL script (conception/<name>.sql): when it was written */
  sqlAt?: string
}

export interface ModelingAPI {
  /** The models of a project (none without a conception/ folder) */
  list: (projectPath: string) => Promise<ModelSummary[]>
  read: (projectPath: string, file: string) => Promise<ModelFile>
  /** A new, empty model; resolves with its file name */
  create: (projectPath: string, kind: ModelKind, name: string) => Promise<string>
  save: (projectPath: string, file: string, model: ModelFile) => Promise<void>
  /** Renamed: the file follows; resolves with its new name */
  rename: (projectPath: string, file: string, name: string) => Promise<string>
  remove: (projectPath: string, file: string) => Promise<void>
  /** v3.9 lot 3: the engine of the project's database (its .env, its compose file), PostgreSQL when none says */
  engine: (projectPath: string) => Promise<SqlEngine>
  /** The SQL script next to an MPD (boutique.mpd.json → conception/boutique.sql); resolves with its path */
  writeSql: (projectPath: string, file: string, sql: string) => Promise<string>
}
