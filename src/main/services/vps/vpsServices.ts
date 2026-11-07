import type { VpsService } from '@shared/types'
import { runOn } from '../monitor/vpsWatch'
import { openForward } from '../ssh/localForward'
import { testOutput } from './testOutputs'

/**
 * Web interfaces published by the server's containers (Portainer, phpMyAdmin,
 * wg-easy, n8n…), opened on this PC through the SSH session: no `ssh -L`, and
 * an interface kept on 127.0.0.1 stays off the internet.
 */

/** Known images: display name, the container port of their web interface, scheme */
const KNOWN: { kind: string; name: string; image: RegExp; port: number; scheme?: 'https' }[] = [
  { kind: 'portainer', name: 'Portainer', image: /portainer\/portainer/, port: 9000 },
  { kind: 'portainer', name: 'Portainer', image: /portainer\/portainer/, port: 9443, scheme: 'https' },
  { kind: 'phpmyadmin', name: 'phpMyAdmin', image: /phpmyadmin/, port: 80 },
  { kind: 'adminer', name: 'Adminer', image: /adminer/, port: 8080 },
  { kind: 'pgadmin', name: 'pgAdmin', image: /pgadmin/, port: 80 },
  { kind: 'wg-easy', name: 'wg-easy', image: /wg-easy/, port: 51821 },
  { kind: 'n8n', name: 'n8n', image: /n8n/, port: 5678 },
  { kind: 'grafana', name: 'Grafana', image: /grafana/, port: 3000 },
  { kind: 'uptime-kuma', name: 'Uptime Kuma', image: /uptime-kuma/, port: 3001 },
  { kind: 'npm', name: 'Nginx Proxy Manager', image: /nginx-proxy-manager/, port: 81 },
  { kind: 'netdata', name: 'Netdata', image: /netdata/, port: 19999 },
  { kind: 'mailpit', name: 'Mailpit', image: /mailpit/, port: 8025 },
  { kind: 'minio', name: 'MinIO', image: /minio/, port: 9001 },
  { kind: 'filebrowser', name: 'File Browser', image: /filebrowser/, port: 80 },
  { kind: 'code-server', name: 'code-server', image: /code-server/, port: 8080 },
  { kind: 'dozzle', name: 'Dozzle', image: /dozzle/, port: 8080 }
]

/** Ports that are not web interfaces (databases, caches, mail…) */
const NOT_WEB = new Set([22, 25, 53, 110, 143, 465, 587, 993, 995, 1433, 3306, 5432, 6379, 11211, 27017, 5672, 9200])

/** `docker ps` lines "name|image|ports|state|status" → the web interfaces */
export function parseServices(ps: string): VpsService[] {
  const out: VpsService[] = []
  for (const line of ps.split('\n')) {
    const [container = '', image = '', ports = '', state = '', status = ''] = line.trim().split('|')
    if (!container) continue
    const seen = new Set<number>()
    for (const m of ports.matchAll(/(\d+\.\d+\.\d+\.\d+|\[[^\]]*\]):(\d+)->(\d+)\/tcp/g)) {
      const [, ip = '', hostPort = '', containerPort = ''] = m
      const port = Number(hostPort)
      // 0.0.0.0 and [::] list the same port twice
      if (seen.has(port)) { const known = out.find(s => s.container === container && s.port === port); if (known && ip !== '127.0.0.1') known.exposed = true; continue }
      seen.add(port)
      const known = KNOWN.find(k => k.image.test(image) && k.port === Number(containerPort))
      if (!known && NOT_WEB.has(Number(containerPort))) continue
      out.push({
        container, image,
        name: known?.name ?? container,
        kind: known?.kind ?? 'other',
        port,
        scheme: known?.scheme ?? (containerPort === '443' || containerPort === '9443' || containerPort === '8443' ? 'https' : 'http'),
        exposed: ip !== '127.0.0.1' && ip !== '[::1]',
        running: state === 'running',
        status
      })
    }
  }
  return out.sort((a, b) => Number(b.kind !== 'other') - Number(a.kind !== 'other') || a.name.localeCompare(b.name))
}

export async function listServices(connectionId: string): Promise<VpsService[]> {
  const canned = testOutput('services')
  if (canned !== null) return parseServices(canned)
  return parseServices(await runOn(connectionId, "docker ps -a --format '{{.Names}}|{{.Image}}|{{.Ports}}|{{.State}}|{{.Status}}' 2>/dev/null || true", 30_000))
}

export async function openService(connectionId: string, port: number, scheme: 'http' | 'https'): Promise<string> {
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid port')
  const local = await openForward(connectionId, port)
  return `${scheme === 'https' ? 'https' : 'http'}://localhost:${local}`
}
