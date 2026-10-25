// DevForge status service: checks sites and services, keeps 90 days of
// history, opens and closes incidents, sends alerts, serves the public page.
// No dependency: Node 22 only. Installed by DevForge in ~/devforge/status,
// which writes config.json and manual-incidents.json; this program writes
// state.json, history.json and incidents.json. Only public things are served.

import { createServer } from 'node:http'
import { existsSync, mkdirSync, readFileSync, renameSync, statSync, writeFileSync } from 'node:fs'
import { connect } from 'node:net'
import { join } from 'node:path'

const DIR = process.env.STATUS_DIR || '/data'
const PORT = Number(process.env.PORT || 3901)
const BIND = process.env.BIND || '127.0.0.1'
const DAYS = 90
/** Seconds between two rounds, at least (tests go faster) */
const MIN_INTERVAL = Number(process.env.STATUS_MIN_INTERVAL || 15)
const file = name => join(DIR, name)

// ─── Files ────────────────────────────────────────────────────────────────────

function readJson(name, fallback) {
  try { return JSON.parse(readFileSync(file(name), 'utf-8')) } catch { return fallback }
}

/** Written whole then renamed: a reader never sees half a file */
function writeJson(name, value) {
  const tmp = file(`${name}.tmp`)
  writeFileSync(tmp, JSON.stringify(value))
  renameSync(tmp, file(name))
}

const DEFAULT_CONFIG = { title: 'Status', intervalSec: 60, failuresBeforeDown: 3, monitors: [], alerts: { ntfy: null, webhook: null } }
let config = DEFAULT_CONFIG
let configStamp = 0

function loadConfig() {
  try {
    const stamp = statSync(file('config.json')).mtimeMs
    if (stamp === configStamp) return
    configStamp = stamp
    config = { ...DEFAULT_CONFIG, ...readJson('config.json', {}) }
    config.monitors = (config.monitors || []).filter(m => m && m.id && m.target && (m.type === 'http' || m.type === 'tcp'))
  } catch { /* no config yet: nothing to check */ }
}

let state = { updatedAt: null, monitors: {} }
let history = {}
let incidents = []

// ─── Checks ───────────────────────────────────────────────────────────────────

async function checkHttp(m) {
  const t0 = Date.now()
  const res = await fetch(m.target, { redirect: 'follow', signal: AbortSignal.timeout(10_000), headers: { 'user-agent': 'DevForge-Status/1' } })
  await res.arrayBuffer().catch(() => {})
  const ok = m.expectStatus ? res.status === m.expectStatus : res.status < 400
  return { ok, ms: Date.now() - t0, error: ok ? null : `HTTP ${res.status}` }
}

function checkTcp(m) {
  const [host, port] = m.target.split(/:(?=\d+$)/)
  const t0 = Date.now()
  return new Promise(resolve => {
    const socket = connect({ host, port: Number(port), timeout: 5000 })
    const done = (ok, error) => { socket.destroy(); resolve({ ok, ms: Date.now() - t0, error }) }
    socket.once('connect', () => done(true, null))
    socket.once('timeout', () => done(false, 'timeout'))
    socket.once('error', err => done(false, err.code || err.message))
  })
}

async function check(m) {
  try { return await (m.type === 'tcp' ? checkTcp(m) : checkHttp(m)) } catch (err) {
    return { ok: false, ms: null, error: err?.name === 'TimeoutError' ? 'timeout' : (err?.cause?.code || err?.message || 'error') }
  }
}

const today = (d = new Date()) => d.toISOString().slice(0, 10)

function record(id, r) {
  const days = history[id] || (history[id] = {})
  const day = days[today()] || (days[today()] = { total: 0, ok: 0, ms: 0 })
  day.total++
  if (r.ok) { day.ok++; if (r.ms !== null) day.ms += r.ms }
  // 90 days kept
  const keep = new Set(Array.from({ length: DAYS }, (_, i) => today(new Date(Date.now() - i * 86_400_000))))
  for (const d of Object.keys(days)) if (!keep.has(d)) delete days[d]
}

// ─── Alerts ───────────────────────────────────────────────────────────────────

async function alert(title, message, down) {
  const a = config.alerts || {}
  const jobs = []
  if (a.ntfy?.topic) {
    const server = (a.ntfy.server || 'https://ntfy.sh').replace(/\/$/, '')
    // JSON publishing: accents in the title survive (an HTTP header would not carry them)
    jobs.push(fetch(`${server}/`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ topic: a.ntfy.topic, title, message, priority: down ? 4 : 3, tags: [down ? 'red_circle' : 'green_circle'] }),
      signal: AbortSignal.timeout(10_000)
    }))
  }
  if (a.webhook) {
    jobs.push(fetch(a.webhook, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ source: 'devforge-status', title, message, down, at: new Date().toISOString() }),
      signal: AbortSignal.timeout(10_000)
    }))
  }
  for (const r of await Promise.allSettled(jobs)) if (r.status === 'rejected') console.error('alert failed:', r.reason?.message || r.reason)
}

// ─── Loop ─────────────────────────────────────────────────────────────────────

async function round() {
  loadConfig()
  const now = new Date().toISOString()
  await Promise.all(config.monitors.map(async m => {
    const r = await check(m)
    record(m.id, r)
    const s = state.monitors[m.id] || { status: 'unknown', since: now, fails: 0 }
    s.fails = r.ok ? 0 : s.fails + 1
    s.lastCheck = now
    s.lastMs = r.ms
    s.lastError = r.error
    // A test monitor goes down at the first failure
    const limit = m.test ? 1 : Math.max(1, config.failuresBeforeDown || 3)
    if (!r.ok && s.fails >= limit && s.status !== 'down') {
      s.status = 'down'
      s.since = now
      incidents.unshift({ id: `${m.id}-${Date.now()}`, monitorId: m.id, title: `${m.name} indisponible`, cause: r.error, startedAt: now, resolvedAt: null })
      await alert(`${m.name} ne répond plus`, `${m.target} — ${r.error}`, true)
    } else if (r.ok && s.status !== 'up') {
      const wasDown = s.status === 'down'
      s.status = 'up'
      s.since = now
      if (wasDown) {
        const open = incidents.find(i => i.monitorId === m.id && !i.resolvedAt)
        if (open) open.resolvedAt = now
        await alert(`${m.name} répond de nouveau`, `${m.target} — ${r.ms} ms`, false)
      }
    }
    state.monitors[m.id] = s
  }))
  // Monitors removed from the config leave the state, their open incident is closed
  for (const id of Object.keys(state.monitors)) {
    if (config.monitors.some(m => m.id === id)) continue
    delete state.monitors[id]
    for (const i of incidents) if (i.monitorId === id && !i.resolvedAt) i.resolvedAt = now
  }
  state.updatedAt = now
  incidents = incidents.slice(0, 200)
  writeJson('state.json', state)
  writeJson('history.json', history)
  writeJson('incidents.json', incidents)
}

async function loop() {
  try { await round() } catch (err) { console.error('round failed:', err) }
  setTimeout(loop, Math.max(MIN_INTERVAL, config.intervalSec || 60) * 1000)
}

// ─── Public page ──────────────────────────────────────────────────────────────

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])

/** What anyone may see: public monitors, their 90 days, public incidents */
function publicView() {
  const monitors = config.monitors.filter(m => m.public).map(m => {
    const days = history[m.id] || {}
    const list = Array.from({ length: DAYS }, (_, i) => {
      const d = today(new Date(Date.now() - (DAYS - 1 - i) * 86_400_000))
      const x = days[d]
      return { day: d, uptime: x && x.total ? x.ok / x.total : null }
    })
    const total = Object.values(days).reduce((a, x) => a + x.total, 0)
    const ok = Object.values(days).reduce((a, x) => a + x.ok, 0)
    return { id: m.id, name: m.name, status: state.monitors[m.id]?.status || 'unknown', uptime: total ? ok / total : null, days: list }
  })
  const ids = new Set(monitors.map(m => m.id))
  const manual = readJson('manual-incidents.json', [])
  const all = [
    ...incidents.filter(i => ids.has(i.monitorId)).map(i => ({ title: i.title, body: '', startedAt: i.startedAt, resolvedAt: i.resolvedAt })),
    ...manual.filter(i => i.public !== false).map(i => ({ title: i.title, body: i.body || '', startedAt: i.startedAt, resolvedAt: i.resolvedAt || null }))
  ].sort((a, b) => b.startedAt.localeCompare(a.startedAt)).slice(0, 20)
  return { title: config.title, updatedAt: state.updatedAt, monitors, incidents: all }
}

const pct = u => u === null ? '—' : `${(Math.floor(u * 10000) / 100).toString().replace('.', ',')} %`
const when = iso => new Date(iso).toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Europe/Paris' })

function page() {
  const v = publicView()
  const down = v.monitors.filter(m => m.status === 'down')
  const banner = down.length ? { cls: 'bad', text: down.length === 1 ? `${esc(down[0].name)} est indisponible` : `${down.length} services indisponibles` } : { cls: 'ok', text: 'Tout fonctionne' }
  const bars = m => m.days.map(d => `<i class="${d.uptime === null ? 'n' : d.uptime >= 0.995 ? 'g' : d.uptime >= 0.95 ? 'w' : 'r'}" title="${d.day} · ${pct(d.uptime)}"></i>`).join('')
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="refresh" content="60"><title>${esc(v.title)}</title><style>
:root{--bg:#F6F7F9;--card:#fff;--ink:#14171C;--muted:#5A6372;--line:#E1E4EA;--g:#2FB27A;--w:#E3A23B;--r:#E5484D;--n:#D5D9E0}
@media (prefers-color-scheme:dark){:root{--bg:#0D0F13;--card:#161A21;--ink:#E8ECF2;--muted:#9AA4B2;--line:#262C36;--n:#2B323D}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.5 system-ui,-apple-system,"Segoe UI",sans-serif}
main{max-width:820px;margin:0 auto;padding:36px 16px;display:flex;flex-direction:column;gap:22px}
h1{font-size:20px;margin:0}h2{font-size:15px;margin:0}
.banner{padding:18px 20px;border-radius:14px;color:#fff;display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap}
.banner.ok{background:var(--g)}.banner.bad{background:var(--r)}.banner span{opacity:.9}
.card{background:var(--card);border:1px solid var(--line);border-radius:14px;overflow:hidden}
.row{padding:16px 20px;border-top:1px solid var(--line)}.row:first-child{border-top:0}
.head{display:flex;gap:10px;align-items:center;margin-bottom:8px}.head strong{flex:1}.dot{font-size:12px}
.up{color:var(--g)}.down{color:var(--r)}.unknown{color:var(--muted)}
.bars{display:flex;gap:2px;height:30px}.bars i{flex:1;border-radius:2px;background:var(--n)}.bars i.g{background:var(--g)}.bars i.w{background:var(--w)}.bars i.r{background:var(--r)}
.legend{display:flex;justify-content:space-between;color:var(--muted);font-size:12px;padding:0 20px 12px}
.muted{color:var(--muted)}.inc p{margin:6px 0 0}footer{color:var(--muted);text-align:center;font-size:12px}
</style></head><body><main>
<h1>${esc(v.title)}</h1>
<div class="banner ${banner.cls}" role="status"><strong>${banner.text}</strong><span>${v.updatedAt ? `vérifié le ${when(v.updatedAt)}` : 'premières vérifications en cours'}</span></div>
<section class="card" aria-label="Services">${v.monitors.map(m => `<div class="row"><div class="head"><span class="dot ${m.status}" aria-hidden="true">●</span><strong>${esc(m.name)}</strong><span class="muted">${pct(m.uptime)} sur 90 jours</span></div><div class="bars" role="img" aria-label="${esc(m.name)} : disponibilité des 90 derniers jours">${bars(m)}</div></div>`).join('') || '<div class="row muted">Aucun service public.</div>'}
${v.monitors.length ? '<div class="legend"><span>il y a 90 jours</span><span>aujourd\'hui</span></div>' : ''}</section>
<section><h2>Incidents récents</h2>${v.incidents.length ? v.incidents.map(i => `<div class="card row inc" style="margin-top:10px"><div class="head" style="margin:0"><strong>${esc(i.title)}</strong><span class="${i.resolvedAt ? 'up' : 'down'}">${i.resolvedAt ? 'résolu' : 'en cours'}</span></div><p class="muted">${when(i.startedAt)}${i.resolvedAt ? ` → ${when(i.resolvedAt)}` : ''}</p>${i.body ? `<p>${esc(i.body)}</p>` : ''}</div>`).join('') : '<p class="muted">Aucun incident.</p>'}</section>
<footer>Surveillé 24 h sur 24 · page générée par DevForge</footer>
</main></body></html>`
}

createServer((req, res) => {
  const path = (req.url || '/').split('?')[0]
  if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405).end(); return }
  const headers = { 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' }
  try {
    if (path === '/health') { res.writeHead(200, { ...headers, 'content-type': 'text/plain' }).end('ok'); return }
    if (path === '/status.json') { res.writeHead(200, { ...headers, 'content-type': 'application/json', 'access-control-allow-origin': '*' }).end(JSON.stringify(publicView())); return }
    if (path === '/') { res.writeHead(200, { ...headers, 'content-type': 'text/html; charset=utf-8', 'content-security-policy': "default-src 'none'; style-src 'unsafe-inline'" }).end(page()); return }
    res.writeHead(404, headers).end('Not found')
  } catch (err) {
    console.error(err)
    res.writeHead(500, headers).end('Error')
  }
}).listen(PORT, BIND, () => console.log(`status page on ${BIND}:${PORT}`))

mkdirSync(DIR, { recursive: true })
if (existsSync(file('state.json'))) state = readJson('state.json', state)
history = readJson('history.json', {})
incidents = readJson('incidents.json', [])
loop()
