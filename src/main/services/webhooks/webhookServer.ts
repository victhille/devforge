import http from 'http'
import { randomUUID } from 'crypto'
import type { CapturedRequest, WebhookResponse, WebhookStatus } from '@shared/types'

const MAX_BODY = 1024 * 1024
const MAX_REQUESTS = 100

let server: http.Server | null = null
let port: number | null = null
let lastError: string | undefined
let response: WebhookResponse = { status: 200, contentType: 'application/json', body: '{"ok":true}' }
let requests: CapturedRequest[] = []
let onRequest: (r: CapturedRequest) => void = () => {}

export function setWebhookCallback(cb: typeof onRequest): void { onRequest = cb }

function handle(req: http.IncomingMessage, res: http.ServerResponse): void {
  const chunks: Buffer[] = []
  let size = 0
  let truncated = false
  req.on('data', (c: Buffer) => {
    size += c.length
    if (size <= MAX_BODY) chunks.push(c); else truncated = true
  })
  req.on('end', () => {
    const captured: CapturedRequest = {
      id: randomUUID(),
      at: new Date().toISOString(),
      method: req.method ?? 'GET',
      url: req.url ?? '/',
      headers: Object.fromEntries(Object.entries(req.headers).map(([k, v]) => [k, Array.isArray(v) ? v.join(', ') : v ?? ''])),
      body: Buffer.concat(chunks).toString('utf-8'),
      truncated
    }
    requests = [captured, ...requests].slice(0, MAX_REQUESTS)
    onRequest(captured)
    res.writeHead(response.status, { 'Content-Type': response.contentType })
    res.end(response.body)
  })
}

export const webhookStatus = (): WebhookStatus => ({ port, error: port ? undefined : lastError, response })

export function startWebhooks(p: number): Promise<WebhookStatus> {
  stopWebhooks()
  return new Promise(resolve => {
    const s = http.createServer(handle)
    s.once('error', (err: NodeJS.ErrnoException) => {
      lastError = err.code === 'EADDRINUSE' ? `Port ${p} is already used` : err.message
      resolve(webhookStatus())
    })
    // Localhost only: expose it on purpose with a tunnel (cloudflared, ngrok)
    s.listen(p, '127.0.0.1', () => {
      server = s
      port = p
      lastError = undefined
      resolve(webhookStatus())
    })
  })
}

export function stopWebhooks(): WebhookStatus {
  server?.close()
  server = null
  port = null
  return webhookStatus()
}

export const listRequests = () => requests
export function clearRequests(): void { requests = [] }

export function setResponse(r: WebhookResponse): void {
  if (!Number.isInteger(r.status) || r.status < 100 || r.status > 599) throw new Error('Invalid status code')
  response = r
}

/** Hop-by-hop and length headers must not be forwarded as is */
const SKIP_HEADERS = new Set(['host', 'connection', 'content-length', 'transfer-encoding', 'keep-alive', 'upgrade', 'accept-encoding'])

export async function replay(id: string, targetUrl: string) {
  const r = requests.find(x => x.id === id)
  if (!r) return { status: null, body: '', error: 'Request not found' }
  if (!/^https?:\/\//i.test(targetUrl)) return { status: null, body: '', error: 'URL must start with http:// or https://' }
  try {
    const target = new URL(targetUrl)
    const captured = new URL(r.url, 'http://x')
    // Keep the target's own path when one is given, else reuse the captured path
    const final = target.pathname !== '/' ? new URL(target.pathname + captured.search, target.origin) : new URL(r.url, target.origin)
    const res = await fetch(final, {
      method: r.method,
      headers: Object.fromEntries(Object.entries(r.headers).filter(([k]) => !SKIP_HEADERS.has(k))),
      body: ['GET', 'HEAD'].includes(r.method) ? undefined : r.body,
      signal: AbortSignal.timeout(15_000)
    })
    return { status: res.status, body: (await res.text()).slice(0, 20_000) }
  } catch (err) {
    return { status: null, body: '', error: err instanceof Error ? err.message : String(err) }
  }
}
