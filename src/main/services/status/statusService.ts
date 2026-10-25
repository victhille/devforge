import { readFileSync } from 'fs'
import { join } from 'path'
import { app } from 'electron'
import type {
  StatusAlerts, StatusConfig, StatusExposure, StatusIncident, StatusInstallOptions, StatusOverview, StatusPrecheck
} from '@shared/types'
import { writeJsonFile } from '../../lib/jsonFile'
import { log } from '../../lib/log'
import { runOn, sessionFor } from '../monitor/vpsWatch'
import { sshService } from '../ssh/sshService'
import { shQuote } from '../ssh/sshClient'
import { loadSshConnections } from '../ssh/sshStorage'
import { checkDomain } from '../n8n/n8nService'
import { testOutput } from '../vps/testOutputs'
import {
  DOMAIN_RE, EMAIL_RE, OVERVIEW_SCRIPT, PRECHECK_SCRIPT, SEP, STATUS_PORT,
  OPEN_FIREWALL_SCRIPT, cleanConfig, cleanIncidents, defaultConfig, firewallBlocks, installScript, sslipFor, uninstallScript, writeDataScript
} from './statusScripts'

/**
 * The status page of a VPS, installed and followed from DevForge. The service
 * runs on the server (24/7, even with this PC off); DevForge reads its files
 * through SSH and writes its settings the same way.
 */

interface Stored { connectionId: string; exposure: StatusExposure; domain: string; installedAt: string }

const storePath = () => join(app.getPath('userData'), 'status.json')
function readStore(): Stored[] {
  try { return (JSON.parse(readFileSync(storePath(), 'utf-8')) as { pages?: Stored[] }).pages ?? [] } catch { return [] }
}
const writeStore = (pages: Stored[]) => writeJsonFile(storePath(), { pages })

function server(connectionId: string) {
  const conn = loadSshConnections().find(c => c.id === connectionId)
  if (!conn) throw new Error('Unknown server')
  return conn
}

export async function precheck(connectionId: string): Promise<StatusPrecheck> {
  const conn = server(connectionId)
  const out = testOutput('statusPrecheck') ?? await runOn(connectionId, PRECHECK_SCRIPT, 30_000)
  const [docker = '', compose = '', ports = '', n8n = '', installed = '', ufw = ''] = out.split(SEP).map(s => s.trim())
  const busy = new Set<number>()
  for (const line of ports.split('\n')) {
    const m = /:(\d+)$/.exec(line.trim())
    if (m && (m[1] === '80' || m[1] === '443')) busy.add(Number(m[1]))
  }
  const n8nCaddy = n8n === 'yes'
  return {
    docker: docker === 'yes', compose: compose === 'yes', busyPorts: [...busy].sort((a, b) => a - b), n8nCaddy, installed: installed === 'yes',
    firewallBlocks: firewallBlocks(ufw),
    sslip: sslipFor(conn.host),
    suggested: n8nCaddy ? 'n8n' : busy.size ? 'port' : 'caddy'
  }
}

export const domainCheck = (connectionId: string, domain: string) => checkDomain(connectionId, domain)

/** Runs a script on the server, streaming its output; true when it exits with 0 */
async function stream(connectionId: string, script: string, onLog: (text: string) => void): Promise<boolean> {
  const sid = await sessionFor(connectionId)
  let all = ''
  const code = await sshService.execStream(sid, `bash -lc ${shQuote(script)} 2>&1; echo "${SEP}$?"`, text => {
    all += text
    const clean = text.replace(new RegExp(`${SEP}\\d*\\s*$`), '')
    if (clean) onLog(clean)
  }, 15 * 60_000)
  const m = new RegExp(`${SEP}(\\d+)\\s*$`).exec(all)
  return (m ? Number(m[1]) : code) === 0
}

export async function install(connectionId: string, opts: StatusInstallOptions, onLog: (text: string) => void): Promise<{ ok: boolean }> {
  const conn = server(connectionId)
  const exposure: StatusExposure = opts.exposure === 'n8n' || opts.exposure === 'port' ? opts.exposure : 'caddy'
  const domain = (opts.domain ?? '').trim().toLowerCase()
  const email = (opts.email ?? '').trim()
  if (exposure !== 'port' && !DOMAIN_RE.test(domain)) throw new Error('BAD_DOMAIN')
  if (exposure === 'caddy' && email && !EMAIL_RE.test(email)) throw new Error('BAD_EMAIL')
  // Without the name pointing here, Let's Encrypt refuses the certificate (sslip.io always points right)
  if (exposure !== 'port' && !domain.endsWith('.sslip.io')) {
    const check = await checkDomain(connectionId, domain)
    if (!check.ok) throw new Error(check.domainIps.length ? `DOMAIN_ELSEWHERE:${check.domainIps.join(', ')}` : 'DOMAIN_UNKNOWN')
  }
  log('info', 'status', `Install on ${conn.name} (${exposure}${domain ? ` ${domain}` : ''})`)
  const ok = await stream(connectionId, installScript(exposure, domain, email, defaultConfig(conn.name)), onLog)
  if (ok) writeStore([...readStore().filter(p => p.connectionId !== connectionId), { connectionId, exposure, domain, installedAt: new Date().toISOString() }])
  return { ok }
}

const parse = <T>(text: string, fallback: T): T => { try { return text.trim() ? JSON.parse(text) as T : fallback } catch { return fallback } }

export async function overview(connectionId: string): Promise<StatusOverview> {
  const conn = server(connectionId)
  const out = testOutput('statusOverview') ?? await runOn(connectionId, OVERVIEW_SCRIPT, 30_000)
  const [installed = '', ps = '', config = '', state = '', history = '', incidents = '', manual = ''] = out.split(SEP)
  const stored = readStore().find(p => p.connectionId === connectionId)
  const running = ps.split('\n').some(l => l.trim() === 'status|running')
  const s = parse<{ updatedAt: string | null; monitors: StatusOverview['monitors'] }>(state, { updatedAt: null, monitors: {} })
  const url = !stored ? null : stored.exposure === 'port' ? `http://${conn.host}:${STATUS_PORT}` : `https://${stored.domain}`
  return {
    installed: installed.trim() === 'yes', running, url, exposure: stored?.exposure ?? null,
    config: parse<StatusConfig | null>(config, null),
    updatedAt: s.updatedAt, monitors: s.monitors ?? {},
    history: parse(history, {}),
    incidents: [
      ...parse<StatusIncident[]>(incidents, []).map(i => ({ ...i, auto: true })),
      ...parse<StatusIncident[]>(manual, []).map(i => ({ ...i, auto: false }))
    ].sort((a, b) => b.startedAt.localeCompare(a.startedAt))
  }
}

export async function saveConfig(connectionId: string, config: StatusConfig): Promise<void> {
  server(connectionId)
  await runOn(connectionId, writeDataScript('config.json', cleanConfig(config)), 30_000)
}

export async function saveIncidents(connectionId: string, incidents: StatusIncident[]): Promise<void> {
  server(connectionId)
  await runOn(connectionId, writeDataScript('manual-incidents.json', cleanIncidents(incidents)), 30_000)
}

/** From this PC: the same request the service sends on an outage */
export async function testAlert(alerts: StatusAlerts): Promise<void> {
  const clean = cleanConfig({ ...defaultConfig('Test'), alerts }).alerts
  const title = 'DevForge · alerte de test'
  const message = 'Si tu lis ceci, les alertes de la page de statut arrivent bien.'
  if (clean.ntfy) {
    const res = await fetch(`${clean.ntfy.server}/`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, signal: AbortSignal.timeout(15_000),
      body: JSON.stringify({ topic: clean.ntfy.topic, title, message, tags: ['white_check_mark'] })
    })
    if (!res.ok) throw new Error(`ntfy ${res.status}`)
  }
  if (clean.webhook) {
    const res = await fetch(clean.webhook, {
      method: 'POST', headers: { 'content-type': 'application/json' }, signal: AbortSignal.timeout(15_000),
      body: JSON.stringify({ source: 'devforge-status', title, message, down: false, test: true, at: new Date().toISOString() })
    })
    if (!res.ok) throw new Error(`webhook ${res.status}`)
  }
  if (!clean.ntfy && !clean.webhook) throw new Error('NO_ALERTS')
}

/** ufw lets 80 and 443 in (asked by a click on the status page) */
export async function openFirewall(connectionId: string): Promise<{ ok: boolean; output: string }> {
  const conn = server(connectionId)
  log('info', 'status', `Opening 80/443 in ufw on ${conn.name}`)
  try {
    const output = await runOn(connectionId, OPEN_FIREWALL_SCRIPT, 30_000)
    return { ok: firewallBlocks(output).length === 0, output }
  } catch (err) { return { ok: false, output: err instanceof Error ? err.message : String(err) } }
}

export async function uninstall(connectionId: string, onLog: (text: string) => void): Promise<{ ok: boolean }> {
  server(connectionId)
  const ok = await stream(connectionId, uninstallScript(), onLog)
  if (ok) writeStore(readStore().filter(p => p.connectionId !== connectionId))
  return { ok }
}
