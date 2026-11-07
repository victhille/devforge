import type { HealthCheck, HealthFixId, HealthLevel, VpsHealth } from '@shared/types'
import { log } from '../../lib/log'
import { runOn, sessionFor } from '../monitor/vpsWatch'
import { sshService } from '../ssh/sshService'
import { shQuote } from '../ssh/sshClient'
import { loadSshConnections } from '../ssh/sshStorage'
import { testOutput } from './testOutputs'

/**
 * Health and security of a VPS, read in one SSH command, then turned into
 * checks (ok / warn / bad). Reading changes nothing. A fix is a fixed command
 * built here from its id, shown to the user, and run only on their click.
 */

const SEP = '@@DF@@'

/** Read-only: every section is allowed to fail on its own */
export const HEALTH_SCRIPT = [
  'sudo -n true 2>/dev/null && echo yes || echo no',
  'apt list --upgradable 2>/dev/null | tail -n +2 | wc -l; apt list --upgradable 2>/dev/null | grep -c -- "-security" || true',
  '[ -f /var/run/reboot-required ] && echo yes || echo no',
  'df -P / | tail -1; df -Pi / | tail -1',
  'free -b | grep Mem',
  "ss -ltnuH 2>/dev/null | awk '{print $1, $5}' | sort -u",
  '(sudo -n sshd -T 2>/dev/null || grep -hEi "^[[:space:]]*(PermitRootLogin|PasswordAuthentication|Port)[[:space:]]" /etc/ssh/sshd_config.d/*.conf /etc/ssh/sshd_config 2>/dev/null) | grep -Ei "^[[:space:]]*(permitrootlogin|passwordauthentication|port) "',
  'systemctl is-active fail2ban 2>/dev/null || true',
  '(sudo -n journalctl -u ssh -u sshd --since "24 hours ago" --no-pager 2>/dev/null || journalctl -u ssh -u sshd --since "24 hours ago" --no-pager 2>/dev/null) | grep -cE "Failed password|Invalid user" || true',
  "docker ps -a --format '{{.Names}}|{{.State}}|{{.Status}}' 2>/dev/null; echo '--'; docker inspect --format '{{.Name}}|{{.RestartCount}}' $(docker ps -aq 2>/dev/null) 2>/dev/null",
  "docker system df --format '{{.Type}}|{{.Reclaimable}}' 2>/dev/null",
  '. /etc/os-release 2>/dev/null && echo "$PRETTY_NAME"; uptime -p 2>/dev/null'
].join(`; echo '${SEP}'; `)

const SIZE: Record<string, number> = { B: 1, kB: 1e3, KB: 1e3, MB: 1e6, GB: 1e9, TB: 1e12 }
const size = (s: string) => { const m = /^([\d.]+)\s*([kKMGT]?B)/.exec(s.trim()); return m ? Number(m[1]) * (SIZE[m[2]!] ?? 1) : 0 }
const worst = (a: HealthLevel, b: HealthLevel): HealthLevel => (['bad', 'warn', 'unknown', 'ok'].find(l => l === a || l === b) as HealthLevel)

/** Ports that are expected to be reachable: SSH, the web, WireGuard */
const EXPECTED = new Set(['tcp:80', 'tcp:443', 'udp:443', 'udp:51820'])

export function parseHealth(out: string, opts: { sshPort: number; keyAuth: boolean; now?: Date }): VpsHealth {
  const s = out.split(SEP).map(x => x.trim())
  const [sudoS = '', aptS = '', rebootS = '', dfS = '', memS = '', ssS = '', sshdS = '', f2bS = '', failsS = '', dockerS = '', dfDockerS = '', osS = ''] = s
  const sudo = sudoS === 'yes'
  const checks: HealthCheck[] = []
  const add = (id: string, level: HealthLevel, values: HealthCheck['values'] = {}, fix?: HealthFixId) => checks.push({ id, level, values, ...(fix && level !== 'ok' ? { fix } : {}) })

  // Updates
  const [pending = NaN, security = 0] = aptS.split('\n').map(Number)
  if (Number.isNaN(pending)) add('updates', 'unknown')
  else add('updates', pending === 0 ? 'ok' : security > 0 ? 'bad' : 'warn', { count: pending, security }, 'apt-upgrade')
  add('reboot', rebootS === 'yes' ? 'warn' : 'ok', {}, 'reboot')

  // Disk and inodes: "/dev/sda1 19221248 8661552 10543312 46% /"
  const [disk = '', inodes = ''] = dfS.split('\n')
  const pct = (l: string) => Number(/(\d+)%/.exec(l)?.[1] ?? NaN)
  const d = pct(disk), i = pct(inodes)
  const free = Number(disk.trim().split(/\s+/)[3] ?? 0) * 1024
  add('disk', Number.isNaN(d) ? 'unknown' : d >= 90 ? 'bad' : d >= 80 ? 'warn' : 'ok', { percent: d, free })
  if (!Number.isNaN(i) && i >= 80) add('inodes', i >= 90 ? 'bad' : 'warn', { percent: i })

  // Memory: "Mem: total used free shared cache available"
  const mem = memS.split(/\s+/).slice(1).map(Number)
  if (mem.length >= 6 && mem[0]) {
    const avail = Math.round((mem[5]! / mem[0]) * 100)
    add('memory', avail < 10 ? 'bad' : avail < 20 ? 'warn' : 'ok', { available: avail, total: mem[0] })
  }

  // Listening ports open to the internet (not loopback, not link-local, not DHCP)
  const open: string[] = []
  for (const line of ssS.split('\n')) {
    const [proto = '', addr = ''] = line.trim().split(' ')
    const m = /^(.*):(\d+)$/.exec(addr)
    if (!m) continue
    const host = m[1]!, port = Number(m[2])
    if (/^127\.|^\[::1\]|%lo|^\[fe80|^\[?fe80/.test(host) || (proto === 'udp' && (port === 68 || port === 546))) continue
    const key = `${proto}:${port}`
    if (port === opts.sshPort && proto === 'tcp') continue
    if (!EXPECTED.has(key) && !open.includes(key)) open.push(key)
  }
  add('ports', ssS ? (open.length ? 'warn' : 'ok') : 'unknown', { ports: open.map(k => k.replace(':', ' ')).join(', ') })

  // SSH configuration (first value wins, as for sshd)
  const sshd: Record<string, string> = {}
  for (const line of sshdS.split('\n')) {
    const [k = '', v = ''] = line.trim().split(/\s+/)
    if (k && !(k.toLowerCase() in sshd)) sshd[k.toLowerCase()] = v.toLowerCase()
  }
  const root = sshd.permitrootlogin ?? 'unknown'
  const password = sshd.passwordauthentication ?? 'unknown'
  add('ssh-root', root === 'unknown' ? 'unknown' : root === 'yes' ? 'bad' : 'ok', { value: root }, opts.keyAuth ? 'ssh-harden' : undefined)
  add('ssh-password', password === 'unknown' ? 'unknown' : password === 'yes' ? 'warn' : 'ok', { value: password }, opts.keyAuth ? 'ssh-harden' : undefined)

  // fail2ban and failed logins
  const f2b = f2bS.split('\n').pop() === 'active'
  add('fail2ban', f2b ? 'ok' : 'warn', {}, 'install-fail2ban')
  const fails = Number(failsS.split('\n').pop())
  if (!Number.isNaN(fails) && failsS !== '') add('ssh-failures', !f2b && fails > 50 ? 'warn' : 'ok', { count: fails })

  // Containers: restarting, stopped on an error, restart loops
  const [psPart = '', restartsPart = ''] = dockerS.split(/^--$/m)
  const restarts = new Map(restartsPart.split('\n').map(l => { const [n = '', c = '0'] = l.trim().replace(/^\//, '').split('|'); return [n, Number(c)] as const }))
  const broken: string[] = []
  const looping: string[] = []
  for (const line of psPart.split('\n')) {
    const [name = '', state = '', status = ''] = line.trim().split('|')
    if (!name) continue
    if (state === 'restarting' || (state === 'exited' && !/Exited \(0\)/.test(status))) broken.push(name)
    else if ((restarts.get(name) ?? 0) > 5) looping.push(name)
  }
  if (psPart.trim()) add('containers', broken.length ? 'bad' : looping.length ? 'warn' : 'ok', { broken: broken.join(', '), looping: looping.join(', ') })

  // Docker space that can be given back (unused images, build cache)
  let reclaim = 0
  for (const line of dfDockerS.split('\n')) {
    const [type = '', r = ''] = line.split('|')
    if (type === 'Images' || type === 'Build Cache') reclaim += size(r)
  }
  if (dfDockerS) add('docker-space', reclaim > 1e9 ? 'warn' : 'ok', { size: Math.round(reclaim) }, 'docker-prune')

  const [os = null, uptime = null] = osS.split('\n').map(x => x.trim() || null)
  return { checkedAt: (opts.now ?? new Date()).toISOString(), os, uptime, sudo, checks }
}

/** Overall level of a server: the worst of its checks */
export const overall = (h: VpsHealth): HealthLevel => h.checks.reduce<HealthLevel>((acc, c) => (c.level === 'unknown' ? acc : worst(acc, c.level)), 'ok')

function connection(connectionId: string) {
  const conn = loadSshConnections().find(c => c.id === connectionId)
  if (!conn) throw new Error('Unknown server')
  return conn
}

export async function readHealth(connectionId: string): Promise<VpsHealth> {
  const conn = connection(connectionId)
  const out = testOutput('health') ?? await runOn(connectionId, HEALTH_SCRIPT, 60_000)
  return parseHealth(out, { sshPort: conn.port || 22, keyAuth: conn.authMethod !== 'password' })
}

// ─── Fixes ────────────────────────────────────────────────────────────────────

const APT = 'sudo -n env DEBIAN_FRONTEND=noninteractive apt-get'

/**
 * The command of a fix. `00-` so it is read first: sshd keeps the first value
 * it sees, and cloud images ship a 50-cloud-init.conf that turns passwords on.
 */
export function fixCommand(fix: HealthFixId): string {
  switch (fix) {
    case 'apt-upgrade': return `${APT} update && ${APT} -y -o Dpkg::Options::=--force-confdef -o Dpkg::Options::=--force-confold upgrade`
    case 'reboot': return 'sudo -n systemctl reboot'
    case 'docker-prune': return 'docker image prune -af && docker builder prune -af'
    case 'install-fail2ban': return `${APT} update && ${APT} install -y fail2ban && sudo -n systemctl enable --now fail2ban`
    case 'ssh-harden': return "printf 'PasswordAuthentication no\\nPermitRootLogin prohibit-password\\n' | sudo -n tee /etc/ssh/sshd_config.d/00-devforge.conf >/dev/null && sudo -n sshd -t && sudo -n systemctl reload ssh && echo 'SSH: key login only'"
    default: throw new Error('Unknown fix')
  }
}

const FIXES: HealthFixId[] = ['apt-upgrade', 'reboot', 'docker-prune', 'install-fail2ban', 'ssh-harden']

export async function runFix(connectionId: string, fix: HealthFixId, onLog: (text: string) => void): Promise<{ ok: boolean }> {
  if (!FIXES.includes(fix)) throw new Error('Unknown fix')
  const conn = connection(connectionId)
  // Turning passwords off is only safe when DevForge itself logs in with a key
  if (fix === 'ssh-harden' && conn.authMethod === 'password') throw new Error('NEEDS_KEY')
  const command = fixCommand(fix)
  log('info', 'vps', `Fix ${fix} on ${connectionId}`)
  const sid = await sessionFor(connectionId)
  let all = ''
  try {
    const code = await sshService.execStream(sid, `bash -lc ${shQuote(command)} 2>&1; echo "${SEP}$?"`, text => {
      all += text
      const clean = text.replace(new RegExp(`${SEP}\\d*\\s*$`), '')
      if (clean) onLog(clean)
    }, 30 * 60_000)
    const m = new RegExp(`${SEP}(\\d+)\\s*$`).exec(all)
    return { ok: (m ? Number(m[1]) : code) === 0 }
  } catch (err) {
    // A reboot cuts the session: that is the expected end
    if (fix === 'reboot') return { ok: true }
    throw err
  }
}
