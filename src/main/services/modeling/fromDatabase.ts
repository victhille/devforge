import { existsSync, rmSync } from 'fs'
import { join } from 'path'
import type { ModelProgress } from '@shared/types'
import { MODEL_FILE_RE } from '@shared/lib/mcd'
import { dbTablesOf, importDb, mcdFromMpd } from '@shared/lib/mpdDb'
import { listDbConnections } from '../database/dbStorage'
import { dbDiagram } from '../database/dbClient'
import { createModel, modelsChanged, projectDir, readModel, saveModel } from './models'

/**
 * v4.1: a project's database read into its conception/ folder — the MPD, linked
 * to the connection, and the MCD worked out from it — one step at a time, so
 * the window (or Forgy's card) can show how far it is.
 */

export const IMPORT_STEPS = ['connect', 'read', 'mcd', 'mpd', 'write'] as const

export interface ImportResult { mcd: string; mpd: string; tables: number }

export async function modelFromDatabase(projectPath: string, connectionId: string, name: string, onProgress: (p: ModelProgress) => void = () => {}): Promise<ImportResult> {
  projectDir(projectPath)
  const conn = listDbConnections().find(c => c.id === connectionId)
  if (!conn) throw new Error('Unknown connection')
  const clean = name.trim().slice(0, 120) || conn.name
  const step = (s: (typeof IMPORT_STEPS)[number], detail?: string) =>
    onProgress({ step: s, index: IMPORT_STEPS.indexOf(s), total: IMPORT_STEPS.length, ...(detail ? { detail } : {}) })

  step('connect', conn.name)
  const diagram = await dbDiagram(conn.id)
  const tables = dbTablesOf(diagram).length
  step('read', String(tables))
  if (!tables) throw new Error('This database has no table yet: create the MCD by hand, or ask Forgy to draw it')

  step('mcd')
  const mcdFile = createModel(projectPath, 'mcd', clean)
  const mpdFile = mcdFile.replace(/\.mcd\.json$/, '.mpd.json')
  // An MPD of that name left alone by an MCD removed earlier: never written over
  if (existsSync(join(projectDir(projectPath), 'conception', mpdFile))) { removeModels(projectPath, [mcdFile]); throw new Error(`conception/${mpdFile} already exists: choose another name`) }
  try {
    const { mcd, naming, mpd } = importDb(diagram, conn.type, mcdFile)
    saveModel(projectPath, mcdFile, { v: 1, kind: 'mcd', name: clean, updatedAt: '', mcd, naming })
    step('mpd', String(mpd.tables.length))
    step('write')
    saveModel(projectPath, mpdFile, { v: 1, kind: 'mpd', name: clean, updatedAt: '', mpd: { ...mpd, connection: conn.id } })
    onProgress({ step: 'done', index: IMPORT_STEPS.length, total: IMPORT_STEPS.length })
    return { mcd: mcdFile, mpd: mpdFile, tables }
  } catch (err) {
    // Nothing half-made is left behind
    removeModels(projectPath, [mcdFile, mpdFile])
    throw err
  }
}

/**
 * v4.2 lot 3: an MPD drawn by hand gets its MCD, written next to it (same
 * name, .mcd.json); the MPD is made again from it so that the two stay tied,
 * with its places, indexes and connection kept. An MCD of that name is never
 * written over.
 */
export function mcdFromMpdFile(projectPath: string, mpdFile: string): { mcd: string; entities: number; associations: number } {
  if (!/\.mpd\.json$/.test(mpdFile)) throw new Error('Not an MPD file')
  const m = readModel(projectPath, mpdFile)
  if (!m.mpd?.tables.length) throw new Error('This MPD has no table yet')
  const mcdFile = mpdFile.replace(/\.mpd\.json$/, '.mcd.json')
  if (existsSync(join(projectDir(projectPath), 'conception', mcdFile))) throw new Error(`conception/${mcdFile} already exists`)
  const { mcd, naming, mpd } = mcdFromMpd(m.mpd, mcdFile)
  saveModel(projectPath, mcdFile, { v: 1, kind: 'mcd', name: m.name, updatedAt: '', mcd, naming })
  saveModel(projectPath, mpdFile, { ...m, mpd })
  return { mcd: mcdFile, entities: mcd.entities.length, associations: mcd.associations.length }
}

/** Files of conception/ removed (Forgy's undo, a failed import) */
export function removeModels(projectPath: string, files: string[]): string[] {
  const dir = join(projectDir(projectPath), 'conception')
  return files.filter(f => MODEL_FILE_RE.test(f) && existsSync(join(dir, f))).map(f => { rmSync(join(dir, f), { force: true }); modelsChanged(join(dir, f)); return f })
}
