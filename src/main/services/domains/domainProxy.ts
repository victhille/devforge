import http from 'http'
import net from 'net'
import type { LocalDomain } from '@shared/types'

const PORTS = [80, 8088]

let server: http.Server | null = null
let listeningPort: number | null = null
let lastError: string | undefined
let routes = new Map<string, number>()

const hostOf = (req: http.IncomingMessage) => (req.headers.host ?? '').split(':')[0].toLowerCase()

function page(res: http.ServerResponse, status: number, title: string, body: string): void {
  res.writeHead(status, { 'Content-Type': 'text/html; charset=utf-8' })
  res.end(`<!doctype html><meta charset="utf-8"><title>${title}</title>
<body style="font-family:system-ui;background:#0D0F14;color:#E8EAF0;display:grid;place-items:center;height:100vh;margin:0">
<div style="max-width:520px"><h2>${title}</h2><p style="color:#8A91A8">${body}</p><p style="color:#4A5068">DevForge local domains</p></div>`)
}

function handle(req: http.IncomingMessage, res: http.ServerResponse): void {
  const host = hostOf(req)
  const port = routes.get(host)
  if (!port) {
    const list = [...routes.keys()].map(d => `<a style="color:#4F8EF7" href="http://${d}${listeningPort === 80 ? '' : ':' + listeningPort}">${d}</a>`).join(' · ')
    return page(res, 404, `Unknown domain: ${host}`, list ? `Configured: ${list}` : 'No domain configured in DevForge.')
  }
  const upstream = http.request(
    { host: '127.0.0.1', port, method: req.method, path: req.url, headers: { ...req.headers, 'x-forwarded-host': req.headers.host ?? host } },
    up => {
      res.writeHead(up.statusCode ?? 502, up.headers)
      up.pipe(res)
    }
  )
  upstream.on('error', () => page(res, 502, `${host} → localhost:${port}`, `Nothing answers on port ${port}. Is your dev server running?`))
  req.pipe(upstream)
}

/** WebSocket passthrough (Vite / webpack HMR, socket.io…) */
function upgrade(req: http.IncomingMessage, socket: net.Socket, head: Buffer): void {
  const port = routes.get(hostOf(req))
  if (!port) { socket.destroy(); return }
  const target = net.connect(port, '127.0.0.1', () => {
    const headers = Object.entries(req.headers).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`).join('\r\n')
    target.write(`${req.method} ${req.url} HTTP/${req.httpVersion}\r\n${headers}\r\n\r\n`)
    if (head.length) target.write(head)
    socket.pipe(target).pipe(socket)
  })
  target.on('error', () => socket.destroy())
  socket.on('error', () => target.destroy())
}

function listen(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const s = http.createServer(handle)
    s.on('upgrade', upgrade)
    s.once('error', (err: NodeJS.ErrnoException) => { lastError = `${err.code ?? err.message} on port ${port}`; resolve(false) })
    s.listen(port, '127.0.0.1', () => { server = s; listeningPort = port; resolve(true) })
  })
}

/** Start (or update) the proxy for the enabled domains; stops it when none. */
export async function syncProxy(domains: LocalDomain[]): Promise<void> {
  routes = new Map(domains.filter(d => d.enabled).map(d => [d.domain.toLowerCase(), d.port]))
  if (routes.size === 0) return stopProxy()
  if (server) return
  lastError = undefined
  for (const port of PORTS) if (await listen(port)) return
}

export function stopProxy(): void {
  server?.close()
  server = null
  listeningPort = null
}

export const proxyState = () => ({ proxyPort: listeningPort, proxyError: listeningPort ? undefined : lastError })
