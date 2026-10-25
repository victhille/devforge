import type { StatusConfig, StatusExposure, StatusIncident, StatusMonitor } from '@shared/types'
import STATUS_APP from './status-app.mjs?raw'

/**
 * Scripts and files of the status service on the server. Everything lives in
 * ~/devforge/status (data in data/). With the "n8n" exposure, a site block is
 * added between markers to the Caddyfile of ~/devforge/n8n, and kept in
 * site.caddy so an n8n re-install puts it back.
 */

export const STATUS_DIR = '~/devforge/status'
export const N8N_DIR = '~/devforge/n8n'
export const STATUS_PORT = 3901
export const SEP = '@@DF@@'
const MARK = '# devforge-status'
const END = '# /devforge-status'

export const DOMAIN_RE = /^(?=.{4,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i
export const EMAIL_RE = /^[^\s@'"]+@[^\s@'"]+\.[^\s@'"]+$/
const ID_RE = /^[a-z0-9][a-z0-9-]{0,40}$/
const TOPIC_RE = /^[\w-]{6,64}$/

const b64 = (s: string) => Buffer.from(s, 'utf-8').toString('base64')
const write = (content: string, path: string) => `echo ${b64(content)} | base64 -d > ${path}`

/** status.203-0-113-10.sslip.io: a working address without any DNS setup */
export const sslipFor = (host: string) => /^\d{1,3}(\.\d{1,3}){3}$/.test(host) ? `status.${host.replace(/\./g, '-')}.sslip.io` : null

export function composeFile(exposure: StatusExposure): string {
  const status = [
    '  status:',
    '    image: node:22-alpine',
    '    container_name: devforge-status',
    '    restart: unless-stopped',
    '    user: "${STATUS_UID}:${STATUS_GID}"',
    '    working_dir: /app',
    '    command: ["node", "/app/status.mjs"]',
    '    environment:',
    `      PORT: "${STATUS_PORT}"`,
    '      STATUS_DIR: /data',
    // Behind its own Caddy only the server itself reaches it
    `      BIND: "${exposure === 'caddy' ? '127.0.0.1' : '0.0.0.0'}"`,
    '    volumes:',
    '      - ./status.mjs:/app/status.mjs:ro',
    '      - ./data:/data',
    // Host network: checks reach 127.0.0.1 services too; with n8n, its network so its Caddy reaches the page
    ...(exposure === 'n8n' ? ['    networks:', '      - n8n'] : ['    network_mode: host'])
  ]
  const caddy = exposure !== 'caddy' ? [] : [
    '  caddy:',
    '    image: caddy:2-alpine',
    '    restart: unless-stopped',
    '    network_mode: host',
    '    volumes:',
    '      - ./Caddyfile:/etc/caddy/Caddyfile:ro',
    '      - caddy_data:/data',
    '      - caddy_config:/config'
  ]
  const tail = exposure === 'caddy' ? ['', 'volumes:', '  caddy_data:', '  caddy_config:']
    : exposure === 'n8n' ? ['', 'networks:', '  n8n:', '    external: true', '    name: n8n_default'] : []
  return ['services:', ...status, ...caddy, ...tail].join('\n') + '\n'
}

export const caddyFile = (domain: string, email: string) => `{
	email ${email}
}

${domain} {
	encode gzip
	reverse_proxy 127.0.0.1:${STATUS_PORT}
}
`

/** The block added to n8n's Caddyfile */
export const n8nSite = (domain: string) => `${MARK}
${domain} {
	encode gzip
	reverse_proxy devforge-status:${STATUS_PORT}
}
${END}
`

/** Drops our block from n8n's Caddyfile; cat > keeps the file Caddy has mounted */
const dropN8nSite = [
  `if [ -f ${N8N_DIR}/Caddyfile ]; then awk '/^${MARK}$/{s=1} !s{print} /^# \\/devforge-status$/{s=0}' ${N8N_DIR}/Caddyfile > /tmp/devforge-caddy && cat /tmp/devforge-caddy > ${N8N_DIR}/Caddyfile && rm -f /tmp/devforge-caddy; fi`
]
const reloadN8nCaddy = `(cd ${N8N_DIR} && docker compose exec -T caddy caddy reload --config /etc/caddy/Caddyfile)`

export const defaultConfig = (title: string): StatusConfig => ({
  title, intervalSec: 60, failuresBeforeDown: 3, monitors: [], alerts: { ntfy: null, webhook: null }
})

export const waitHealth = (tries = 30) =>
  `ok=; for i in $(seq 1 ${tries}); do if docker compose exec -T status wget -q -O /dev/null http://127.0.0.1:${STATUS_PORT}/health 2>/dev/null; then ok=1; break; fi; sleep 2; done; ` +
  `if [ -n "$ok" ]; then echo "The status page answers"; else echo "No answer after ${tries * 2} s: see the logs"; exit 4; fi`

export function installScript(exposure: StatusExposure, domain: string, email: string, config: StatusConfig): string {
  return [
    'set -e',
    `mkdir -p ${STATUS_DIR}/data && cd ${STATUS_DIR}`,
    write(STATUS_APP, 'status.mjs'),
    write(composeFile(exposure), 'compose.yaml'),
    'printf \'STATUS_UID=%s\\nSTATUS_GID=%s\\n\' "$(id -u)" "$(id -g)" > .env',
    exposure === 'caddy' ? write(caddyFile(domain, email), 'Caddyfile') : 'rm -f Caddyfile',
    // The settings already made stay
    `[ -f data/config.json ] || ${write(JSON.stringify(config, null, 2), 'data/config.json')}`,
    ...dropN8nSite,
    ...(exposure === 'n8n'
      ? [write(n8nSite(domain), 'site.caddy'), `cat site.caddy >> ${N8N_DIR}/Caddyfile`]
      : ['rm -f site.caddy']),
    'docker compose pull -q',
    'docker compose up -d --remove-orphans',
    // n8n's Caddy reads its Caddyfile again (our block added, or an older one removed)
    `[ -f ${N8N_DIR}/Caddyfile ] && ${reloadN8nCaddy} || true`,
    waitHealth(),
    'docker compose ps'
  ].join('\n')
}

export const uninstallScript = () => [
  `cd ${STATUS_DIR} 2>/dev/null && docker compose down --remove-orphans || true`,
  ...dropN8nSite,
  `[ -f ${N8N_DIR}/Caddyfile ] && ${reloadN8nCaddy} || true`,
  `rm -rf ${STATUS_DIR}`
].join('\n')

export const OVERVIEW_SCRIPT = [
  `[ -f ${STATUS_DIR}/compose.yaml ] && echo yes || true`,
  `cd ${STATUS_DIR} 2>/dev/null && docker compose ps --format '{{.Service}}|{{.State}}' 2>/dev/null || true`,
  ...['config.json', 'state.json', 'history.json', 'incidents.json', 'manual-incidents.json'].map(f => `cat ${STATUS_DIR}/data/${f} 2>/dev/null || true`)
].join(`; echo '${SEP}'; `)

export const PRECHECK_SCRIPT = [
  'docker --version >/dev/null 2>&1 && echo yes || true',
  'docker compose version >/dev/null 2>&1 && echo yes || true',
  "(ss -ltnH 2>/dev/null || netstat -ltn 2>/dev/null) | awk '{print $4}'",
  `[ -f ${N8N_DIR}/Caddyfile ] && (cd ${N8N_DIR} && docker compose ps --format '{{.Service}}' 2>/dev/null | grep -qx caddy) && echo yes || true`,
  `[ -f ${STATUS_DIR}/compose.yaml ] && echo yes || true`
].join(`; echo '${SEP}'; `)

/** A file written whole on the server, renamed at the end (the service never reads half of it) */
export const writeDataScript = (name: 'config.json' | 'manual-incidents.json', content: unknown) =>
  `cd ${STATUS_DIR}/data && ${write(JSON.stringify(content, null, 2), `${name}.tmp`)} && mv ${name}.tmp ${name}`

// ─── Checks before anything is written on the server ─────────────────────────

function cleanMonitor(m: StatusMonitor): StatusMonitor {
  const id = String(m.id ?? '')
  const name = String(m.name ?? '').trim()
  const target = String(m.target ?? '').trim()
  if (!ID_RE.test(id)) throw new Error('BAD_ID')
  if (!name || name.length > 60) throw new Error('BAD_NAME')
  if (m.type === 'http') {
    let url: URL
    try { url = new URL(target) } catch { throw new Error('BAD_URL') }
    if (!/^https?:$/.test(url.protocol)) throw new Error('BAD_URL')
  } else if (m.type === 'tcp') {
    if (!/^[\w.-]+:\d{1,5}$/.test(target) || Number(target.split(':').pop()) > 65535) throw new Error('BAD_TCP')
  } else throw new Error('BAD_TYPE')
  return { id, name, type: m.type, target, public: m.public === true, ...(m.test ? { test: true } : {}) }
}

export function cleanConfig(c: StatusConfig): StatusConfig {
  const monitors = (c.monitors ?? []).slice(0, 50).map(cleanMonitor)
  if (new Set(monitors.map(m => m.id)).size !== monitors.length) throw new Error('DUPLICATE_ID')
  const ntfy = c.alerts?.ntfy
  if (ntfy && (!TOPIC_RE.test(ntfy.topic) || !/^https?:\/\/[^\s/]+\/?$/.test(ntfy.server))) throw new Error('BAD_NTFY')
  const webhook = c.alerts?.webhook?.trim() || null
  if (webhook && !/^https?:\/\/\S+$/.test(webhook)) throw new Error('BAD_WEBHOOK')
  return {
    title: String(c.title ?? '').trim().slice(0, 80) || 'Status',
    intervalSec: Math.min(3600, Math.max(30, Math.round(Number(c.intervalSec) || 60))),
    failuresBeforeDown: Math.min(10, Math.max(1, Math.round(Number(c.failuresBeforeDown) || 3))),
    monitors,
    alerts: { ntfy: ntfy ? { server: ntfy.server.replace(/\/$/, ''), topic: ntfy.topic } : null, webhook }
  }
}

export function cleanIncidents(list: StatusIncident[]): StatusIncident[] {
  return (list ?? []).filter(i => !i.auto).slice(0, 100).map(i => {
    const title = String(i.title ?? '').trim().slice(0, 120)
    if (!title || !/^[\w-]{1,64}$/.test(String(i.id))) throw new Error('BAD_INCIDENT')
    const date = (d: unknown) => typeof d === 'string' && !Number.isNaN(Date.parse(d)) ? new Date(d).toISOString() : null
    const startedAt = date(i.startedAt)
    if (!startedAt) throw new Error('BAD_INCIDENT')
    return { id: String(i.id), title, body: String(i.body ?? '').slice(0, 2000), startedAt, resolvedAt: date(i.resolvedAt), auto: false }
  })
}
