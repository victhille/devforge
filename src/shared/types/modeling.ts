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

/** A model file in the project's conception/ folder */
export interface ModelFile {
  v: 1
  kind: ModelKind
  name: string
  updatedAt: string
  mcd?: McdModel
}

/** A model in the list: its file name, and enough to draw its thumbnail */
export interface ModelSummary {
  /** File name inside conception/ ("boutique.mcd.json") */
  file: string
  kind: ModelKind
  name: string
  updatedAt: string
  mcd?: McdModel
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
}
