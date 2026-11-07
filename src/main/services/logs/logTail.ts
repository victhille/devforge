import { open as openFile, stat } from 'fs/promises'
import { readFileSync, watchFile, unwatchFile } from 'fs'
import { join, resolve } from 'path'
import { randomUUID } from 'crypto'
import { app } from 'electron'
import type { LogTailOpen } from '@shared/types'
import { writeJsonFile } from '../../lib/jsonFile'
import { isInsideProject } from '../../lib/safe'

/**
 * v4.0: the window may follow a file of a saved project, or one the user
 * picked in the file dialog (remembered, so the page reopens it next time);
 * never any other file of the disk.
 */
const pickedPath = () => join(app.getPath('userData'), 'log-files.json')
function picked(): string[] {
  try { return (JSON.parse(readFileSync(pickedPath(), 'utf-8')) as unknown[]).filter((p): p is string => typeof p === 'string') } catch { return [] }
}
export function rememberLogFile(path: string): void {
  const p = resolve(path)
  writeJsonFile(pickedPath(), [p, ...picked().filter(x => x.toLowerCase() !== p.toLowerCase())].slice(0, 50))
}
function assertLogFile(path: unknown): string {
  if (typeof path !== 'string' || !path) throw new Error('Invalid path')
  const p = resolve(path)
  if (!isInsideProject(p) && !picked().some(x => x.toLowerCase() === p.toLowerCase())) throw new Error('Pick this file with "Open a file" first')
  return p
}

const INITIAL_BYTES = 512 * 1024
const INITIAL_LINES = 2000
const POLL_MS = 500 // polling works on OneDrive / network drives where fs.watch is unreliable

interface Tail { path: string; offset: number; partial: string; reading: boolean }

const tails = new Map<string, Tail>()
let emit: (e: { id: string; lines: string[]; reset?: boolean }) => void = () => {}

export function setLogCallback(cb: typeof emit): void { emit = cb }

async function readRange(path: string, start: number, end: number): Promise<string> {
  const fh = await openFile(path, 'r')
  try {
    const buf = Buffer.alloc(end - start)
    await fh.read(buf, 0, buf.length, start)
    return buf.toString('utf-8')
  } finally {
    await fh.close()
  }
}

async function poll(id: string): Promise<void> {
  const t = tails.get(id)
  if (!t || t.reading) return
  t.reading = true
  try {
    const { size } = await stat(t.path)
    if (size < t.offset) {
      // Truncated or rotated: start over from the beginning
      t.offset = 0
      t.partial = ''
      emit({ id, lines: [], reset: true })
    }
    if (size > t.offset) {
      const chunk = t.partial + await readRange(t.path, t.offset, size)
      t.offset = size
      const parts = chunk.split(/\r?\n/)
      t.partial = parts.pop() ?? '' // keep an unfinished last line for next time
      if (parts.length) emit({ id, lines: parts })
    }
  } catch { /* file temporarily missing during rotation */ } finally {
    t.reading = false
  }
}

export async function openTail(input: string): Promise<LogTailOpen> {
  const path = assertLogFile(input)
  const { size, isFile } = await stat(path).then(s => ({ size: s.size, isFile: s.isFile() }))
  if (!isFile) throw new Error('Not a file')
  const start = Math.max(0, size - INITIAL_BYTES)
  const text = size ? await readRange(path, start, size) : ''
  let lines = text.split(/\r?\n/)
  if (start > 0) lines.shift() // first line is probably cut
  // Last element is '' after a final newline, or an unfinished line otherwise
  const last = lines.pop() ?? ''
  const partial = text.endsWith('\n') ? '' : last
  lines = lines.slice(-INITIAL_LINES)

  const id = randomUUID()
  tails.set(id, { path, offset: size, partial, reading: false })
  watchFile(path, { interval: POLL_MS }, () => { poll(id) })
  return { id, path, lines, size }
}

export function closeTail(id: string): void {
  const t = tails.get(id)
  if (!t) return
  tails.delete(id)
  // Other tails may watch the same file: only unwatch when none left
  if (![...tails.values()].some(x => x.path === t.path)) unwatchFile(t.path)
}

export function closeAllTails(): void {
  for (const id of [...tails.keys()]) closeTail(id)
}
