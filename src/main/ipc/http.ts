import { ipcMain } from 'electron'
import type { HttpRequest, HttpResponse } from '@shared/types'

const MAX_BODY = 5 * 1024 * 1024

/**
 * HTTP requests for the API tester, sent from the main process: no CORS limits
 * and the renderer keeps a strict Content-Security-Policy (no outbound fetch).
 */
async function send(req: HttpRequest): Promise<HttpResponse> {
  if (!/^https?:\/\//i.test(req.url)) return { error: 'URL must start with http:// or https://' }
  const start = Date.now()
  try {
    const res = await fetch(req.url, {
      method: req.method,
      headers: req.headers,
      body: ['GET', 'HEAD'].includes(req.method) ? undefined : req.body || undefined,
      signal: AbortSignal.timeout(60_000),
      redirect: 'follow'
    })
    const buf = Buffer.from(await res.arrayBuffer())
    return {
      status: res.status,
      statusText: res.statusText,
      headers: Object.fromEntries(res.headers.entries()),
      body: buf.subarray(0, MAX_BODY).toString('utf-8'),
      size: buf.length,
      time: Date.now() - start
    }
  } catch (err) {
    const e = err as Error & { cause?: { code?: string; message?: string } }
    return { error: e.name === 'TimeoutError' ? 'Timeout after 60s' : e.cause?.code ?? e.cause?.message ?? e.message }
  }
}

export function registerHttpHandlers(): void {
  ipcMain.handle('http:request', (_e, req: HttpRequest) => send(req))
}
