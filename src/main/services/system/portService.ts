import { execSync } from 'child_process'
import type { ListeningPort } from '@shared/types'

export function getListeningPorts(): ListeningPort[] {
  try {
    return process.platform === 'win32' ? getWindowsPorts() : getUnixPorts()
  } catch {
    return []
  }
}

function getWindowsPorts(): ListeningPort[] {
  const output = execSync('netstat -ano', { encoding: 'utf-8', timeout: 8000 })
  const seen   = new Map<number, ListeningPort>()

  for (const line of output.split('\n')) {
    if (!line.includes('LISTENING')) continue
    const parts     = line.trim().split(/\s+/)
    if (parts.length < 5) continue
    const portMatch = parts[1].match(/:(\d+)$/)
    if (!portMatch) continue
    const port = parseInt(portMatch[1])
    const pid  = parseInt(parts[4]) || null
    if (!seen.has(port)) seen.set(port, { port, pid, processName: '' })
  }

  const result = Array.from(seen.values()).sort((a, b) => a.port - b.port)

  for (const p of result) {
    if (!p.pid) continue
    try {
      const out   = execSync(`tasklist /FI "PID eq ${p.pid}" /FO CSV /NH`, { encoding: 'utf-8', timeout: 2000 }).trim()
      const match = out.match(/"([^"]+\.exe)"/)
      if (match) p.processName = match[1].replace('.exe', '')
    } catch { /* ignore */ }
  }

  return result
}

function getUnixPorts(): ListeningPort[] {
  try {
    const output = execSync('ss -tlnp', { encoding: 'utf-8', timeout: 5000 })
    const result: ListeningPort[] = []
    for (const line of output.split('\n').slice(1)) {
      if (!line.trim()) continue
      const parts     = line.trim().split(/\s+/)
      if (parts.length < 4) continue
      const portMatch = parts[3].match(/:(\d+)$/)
      if (!portMatch) continue
      const port      = parseInt(portMatch[1])
      const pidMatch  = line.match(/pid=(\d+)/)
      const pid       = pidMatch ? parseInt(pidMatch[1]) : null
      result.push({ port, pid, processName: '' })
    }
    return result.sort((a, b) => a.port - b.port)
  } catch {
    return []
  }
}
