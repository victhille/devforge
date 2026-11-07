/** Remote commands run over SSH on a VPS and parsers for their output (app and main process). */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SysInfo {
  hostname: string
  kernel:   string
  os:       string
}

export interface VPSStats {
  cpu:    number
  load:   [number, number, number]
  uptime: number
  memory: { total: number; used: number; available: number }
  swap:   { total: number; used: number }
  disks:  Array<{ device: string; mount: string; total: number; used: number; avail: number; pct: number }>
  procs:  Array<{ user: string; pid: number; cpu: number; mem: number; cmd: string }>
  docker: Array<{ name: string; image: string; status: string }>
}

// ─── SSH Commands ─────────────────────────────────────────────────────────────

export const CMD_SYSINFO = [
  'hostname',
  'uname -r',
  "cat /etc/os-release 2>/dev/null | grep '^PRETTY_NAME' | cut -d'\"' -f2 || echo Linux"
].join(' && echo "§§§" && ')

export const CMD_MEM    = "cat /proc/meminfo | grep -E '^(MemTotal|MemFree|MemAvailable|Buffers|Cached|SwapTotal|SwapFree):'"
export const CMD_UPTIME = 'cat /proc/uptime && echo "§§§" && cat /proc/loadavg'
export const CMD_DISK   = "df -B1 2>/dev/null | grep '^/dev/' | awk '{print $1\"\\t\"$2\"\\t\"$3\"\\t\"$4\"\\t\"$5\"\\t\"$6}'"
export const CMD_PROCS  = "ps aux --sort=-%cpu 2>/dev/null | awk 'NR>1 && NR<=11 {cmd=$11; for(i=12;i<=NF;i++) cmd=cmd\" \"$i; print $1\"\\t\"$2\"\\t\"$3\"\\t\"$4\"\\t\"cmd}'"
export const CMD_DOCKER = "docker ps --format '{{.Names}}|{{.Image}}|{{.Status}}' 2>/dev/null || echo ''"
export const CMD_CPU    = 'vmstat 1 2 2>/dev/null | tail -1 || echo "0 0 0 0 0 0 0 0 0 0 0 0 0 0 100 0 0"'

// ─── Parsers ──────────────────────────────────────────────────────────────────

export function parseSysInfo(raw: string): SysInfo {
  const parts = raw.split('§§§').map(s => s.trim())
  return { hostname: parts[0] ?? '', kernel: parts[1] ?? '', os: parts[2] ?? 'Linux' }
}

export function parseStats(mem: string, uptime: string, disk: string, procs: string, docker: string, cpu: string): VPSStats {
  const memMap: Record<string, number> = {}
  for (const line of mem.split('\n').filter(Boolean)) {
    const m = line.match(/^(\w+):\s+(\d+)/)
    if (m) memMap[m[1]] = parseInt(m[2]) * 1024
  }

  const upParts   = uptime.split('§§§')
  const uptimeSec = parseFloat(upParts[0]?.trim().split(' ')[0] ?? '0')
  const loadParts = upParts[1]?.trim().split(' ') ?? []
  const load: [number, number, number] = [
    parseFloat(loadParts[0] ?? '0'),
    parseFloat(loadParts[1] ?? '0'),
    parseFloat(loadParts[2] ?? '0'),
  ]

  const cpuFields = cpu.split(/\s+/).filter(Boolean)
  const cpuIdle   = parseFloat(cpuFields[14] ?? '100')
  const cpuPct    = Math.max(0, Math.min(100, 100 - cpuIdle))

  const disks = disk.split('\n').filter(Boolean).map(line => {
    const p = line.split('\t')
    return {
      device: p[0] ?? '', total: parseInt(p[1] ?? '0') || 0,
      used:   parseInt(p[2] ?? '0') || 0, avail: parseInt(p[3] ?? '0') || 0,
      pct:    parseInt((p[4] ?? '0%').replace('%', '')) || 0, mount: p[5] ?? '',
    }
  }).filter(d => d.total > 0)

  const procList = procs.split('\n').filter(Boolean).map(line => {
    const p = line.split('\t')
    return {
      user: p[0] ?? '', pid: parseInt(p[1] ?? '0'),
      cpu:  parseFloat(p[2] ?? '0'), mem: parseFloat(p[3] ?? '0'),
      cmd:  (p[4] ?? '').split('/').pop()?.split(' ')[0] ?? p[4] ?? '',
    }
  })

  const dockerList = docker.split('\n').filter(l => l && l.includes('|')).map(line => {
    const [name, image, status] = line.split('|')
    return { name: name ?? '', image: image ?? '', status: status ?? '' }
  })

  return {
    cpu: cpuPct, load, uptime: uptimeSec,
    memory: { total: memMap.MemTotal ?? 0, used: (memMap.MemTotal ?? 0) - (memMap.MemAvailable ?? 0), available: memMap.MemAvailable ?? 0 },
    swap:   { total: memMap.SwapTotal ?? 0, used: (memMap.SwapTotal ?? 0) - (memMap.SwapFree ?? 0) },
    disks, procs: procList, docker: dockerList,
  }
}
