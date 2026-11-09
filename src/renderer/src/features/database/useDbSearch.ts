import { useEffect, useRef, useState } from 'react'
import type { DbTable, DbTableRef } from '@shared/types'
import type { DbSearchMode, DbSearchResult } from '@shared/lib/dbSearch'
import { searchedColumns } from '@shared/lib/dbSearch'
import { errorText } from '@renderer/lib/errors'

export interface SearchForm {
  term: string
  mode: DbSearchMode
  caseSensitive: boolean
  column: string
  /** The tables picked (schema.name); null: every table, views left out */
  tables: string[] | null
}

export interface TableHit { key: string; ref: DbTableRef; result: DbSearchResult }

export interface SearchRun {
  /** The form as it was when the search started */
  form: SearchForm
  hits: TableHit[]
  /** Tables to search, and how many are done */
  count: number
  searched: number
  /** The table being searched */
  current: string | null
  startedAt: number
  durationMs: number | null
  stopped: boolean
}

export const ROWS_PER_TABLE = 50

export const tableKey = (t: DbTableRef) => `${t.schema}.${t.name}`

/** The tables a search goes through: the picked ones (or every table), those with the column asked for */
export function searchTargets(tables: DbTable[], form: SearchForm): DbTable[] {
  const picked = form.tables ? new Set(form.tables) : null
  return tables.filter(tb => (picked ? picked.has(tableKey(tb)) : tb.type === 'table')
    && searchedColumns(tb.columns.map(c => c.name), form.column).length > 0)
}

/**
 * The Search tab's state, kept by the explorer: going to a table and back
 * finds the results again. One table at a time, so each shows as it comes
 * and Stop takes effect between two.
 */
export function useDbSearch(connId: string) {
  const [form, setForm] = useState<SearchForm>({ term: '', mode: 'contains', caseSensitive: false, column: '', tables: null })
  const [run, setRun] = useState<SearchRun | null>(null)
  const turn = useRef(0)
  // Leaving the connection stops the search
  useEffect(() => () => { turn.current++ }, [])

  async function start(targets: DbTable[]) {
    const mine = ++turn.current
    const snapshot = { ...form }
    const startedAt = Date.now()
    setRun({ form: snapshot, hits: [], count: targets.length, searched: 0, current: targets[0]?.name ?? null, startedAt, durationMs: targets.length ? null : 0, stopped: false })
    for (const [i, tb] of targets.entries()) {
      if (turn.current !== mine) return
      const ref = { name: tb.name, schema: tb.schema }
      setRun(r => r && { ...r, current: tb.name })
      let result: DbSearchResult
      try {
        result = await window.devforge.db.search(connId, ref, {
          term: snapshot.term, mode: snapshot.mode, caseSensitive: snapshot.caseSensitive, column: snapshot.column, limit: ROWS_PER_TABLE
        })
      } catch (err) {
        result = { columns: [], rows: [], total: 0, durationMs: 0, error: errorText(err) }
      }
      if (turn.current !== mine) return
      setRun(r => r && { ...r, searched: i + 1, hits: [...r.hits, { key: tableKey(ref), ref, result }] })
    }
    if (turn.current === mine) setRun(r => r && { ...r, current: null, durationMs: Date.now() - startedAt })
  }

  function stop() {
    turn.current++
    setRun(r => r && { ...r, current: null, stopped: true, durationMs: Date.now() - r.startedAt })
  }

  return { form, setForm, run, start, stop, running: !!run && run.durationMs === null }
}

export type DbSearch = ReturnType<typeof useDbSearch>
