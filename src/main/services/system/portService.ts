import type { ListeningPort } from '@shared/types'
import { run, runFile } from '../../lib/exec'

export async function getListeningPorts(): Promise<ListeningPort[]> {
  try {
    return process.platform === 'win32' ? await getWindowsPorts() : await getUnixPorts()
  } catch {
    return []
  }
}

/** PID → process name, from a single `tasklist` call. */
async function getWindowsProcessNames(): Promise<Map<number, string>> {
  const names = new Map<number, string>()
  try {
    const out = await run('tasklist /FO CSV /NH', { timeout: 8000 })
    for (const line of out.split('\n')) {
      const m = line.match(/^"([^"]+)","(\d+)"/)
      if (m) names.set(parseInt(m[2]), m[1].replace(/\.exe$/i, ''))
    }
  } catch { /* names stay empty */ }
  return names
}

async function getWindowsPorts(): Promise<ListeningPort[]> {
  // Both commands run in parallel
  const [output, names] = await Promise.all([
    run('netstat -ano', { timeout: 8000 }),
    getWindowsProcessNames()
  ])

  const seen = new Map<number, ListeningPort>()
  for (const line of output.split('\n')) {
    if (!line.includes('LISTENING')) continue
    const parts = line.trim().split(/\s+/)
    if (parts.length < 5) continue
    const portMatch = parts[1].match(/:(\d+)$/)
    if (!portMatch) continue
    const port = parseInt(portMatch[1])
    const pid  = parseInt(parts[4]) || null
    if (!seen.has(port)) seen.set(port, { port, pid, processName: pid ? names.get(pid) ?? '' : '' })
  }

  return Array.from(seen.values()).sort((a, b) => a.port - b.port)
}

async function getUnixPorts(): Promise<ListeningPort[]> {
  const output = await run('ss -tlnp', { timeout: 5000 })
  const result: ListeningPort[] = []
  for (const line of output.split('\n').slice(1)) {
    if (!line.trim()) continue
    const parts = line.trim().split(/\s+/)
    if (parts.length < 4) continue
    const portMatch = parts[3].match(/:(\d+)$/)
    if (!portMatch) continue
    const pidMatch = line.match(/pid=(\d+)/)
    const nameMatch = line.match(/users:\(\("([^"]+)"/)
    result.push({
      port: parseInt(portMatch[1]),
      pid: pidMatch ? parseInt(pidMatch[1]) : null,
      processName: nameMatch?.[1] ?? ''
    })
  }
  return result.sort((a, b) => a.port - b.port)
}

const SYSTEM_PROCESS = /^(system|svchost|lsass|services|wininit|smss|csrss)(\.exe)?$/i

/**
 * Frees a port by ending the process listening on it (and its children).
 * Only a process that really listens right now, never a Windows service nor
 * DevForge itself. `pid` pins the process the user saw; omitted, the one
 * listening now. Returns the process that was stopped.
 */
export async function freePort(port: number, pid?: number): Promise<ListeningPort> {
  const owner = (await getListeningPorts()).find(p => p.port === port && (pid === undefined || p.pid === pid))
  if (!owner || owner.pid === null) throw new Error(`Nothing is listening on port ${port}`)
  if (owner.pid <= 4 || SYSTEM_PROCESS.test(owner.processName)) throw new Error(`Port ${port} is held by a Windows service (${owner.processName})`)
  if (owner.pid === process.pid) throw new Error('This port is DevForge itself')
  const r = await runFile('taskkill', ['/PID', String(owner.pid), '/T', '/F'], { timeout: 10_000 })
  if (!r.ok) throw new Error(r.stderr || 'taskkill failed')
  return owner
}
