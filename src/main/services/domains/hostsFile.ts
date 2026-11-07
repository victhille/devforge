import { existsSync, readFileSync, writeFileSync, mkdirSync, copyFileSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { execFile } from 'child_process'
import { app } from 'electron'

export const HOSTS_PATH = process.platform === 'win32'
  ? join(process.env.SystemRoot ?? 'C:\\Windows', 'System32', 'drivers', 'etc', 'hosts')
  : '/etc/hosts'

const BEGIN = '# >>> DevForge local domains (managed, do not edit) >>>'
const END = '# <<< DevForge local domains <<<'

export function readHosts(): string {
  try { return readFileSync(HOSTS_PATH, 'utf-8') } catch { return '' }
}

/** Domains currently written in the DevForge block */
export function managedDomains(content = readHosts()): string[] {
  const start = content.indexOf(BEGIN)
  const end = content.indexOf(END)
  if (start < 0 || end < start) return []
  return content.slice(start + BEGIN.length, end)
    .split(/\r?\n/).map(l => l.trim().split(/\s+/)[1]).filter(Boolean)
}

/** Hosts content with the DevForge block replaced (or removed when no domain) */
export function withManagedBlock(content: string, domains: string[]): string {
  const eol = content.includes('\r\n') ? '\r\n' : '\n'
  let rest = content
  const start = content.indexOf(BEGIN)
  const end = content.indexOf(END)
  if (start >= 0 && end > start) {
    rest = content.slice(0, start).replace(/(\r?\n)+$/, '') + content.slice(end + END.length).replace(/^(\r?\n)+/, eol)
  }
  rest = rest.replace(/(\r?\n)*$/, '')
  if (domains.length === 0) return rest + eol
  const lines = [BEGIN, ...domains.flatMap(d => [`127.0.0.1 ${d}`, `::1 ${d}`]), END]
  return `${rest}${eol}${eol}${lines.join(eol)}${eol}`
}

/**
 * Write the hosts file with admin rights: a temp file is copied over the real
 * one by an elevated process (UAC prompt on Windows). A backup is kept.
 */
export function writeHostsElevated(content: string): Promise<{ ok: boolean; error?: string }> {
  const dir = join(app.getPath('userData'), 'hosts')
  mkdirSync(dir, { recursive: true })
  const backup = join(dir, 'hosts.backup')
  if (!existsSync(backup) && existsSync(HOSTS_PATH)) copyFileSync(HOSTS_PATH, backup)

  const temp = join(tmpdir(), `devforge-hosts-${Date.now()}`)
  writeFileSync(temp, content, 'utf-8')

  return new Promise(resolve => {
    const done = (err: Error | null) => {
      // Verify instead of trusting the exit code (UAC cancel, AV…)
      const ok = !err && readHosts() === content
      resolve(ok ? { ok } : { ok, error: err?.message ?? 'The hosts file was not updated (permission denied or cancelled)' })
    }
    if (process.platform === 'win32') {
      const q = (s: string) => s.replace(/'/g, "''")
      const inner = `Copy-Item -LiteralPath '${q(temp)}' -Destination '${q(HOSTS_PATH)}' -Force`
      execFile('powershell', ['-NoProfile', '-NonInteractive', '-Command',
        `Start-Process -FilePath powershell -Verb RunAs -Wait -WindowStyle Hidden -ArgumentList @('-NoProfile','-Command',"${inner.replace(/"/g, '`"')}")`
      ], { windowsHide: true }, done)
    } else if (process.platform === 'darwin') {
      execFile('osascript', ['-e', `do shell script "cp '${temp}' '${HOSTS_PATH}'" with administrator privileges`], done)
    } else {
      execFile('pkexec', ['cp', temp, HOSTS_PATH], done)
    }
  })
}
