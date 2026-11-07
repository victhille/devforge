import { createServer, request, type Server } from 'http'
import { networkInterfaces } from 'os'
import type { AddressInfo } from 'net'
import { afterAll, afterEach, describe, expect, it } from 'vitest'
import { clearRequests, listRequests, replay, setResponse, startWebhooks, stopWebhooks } from '../../src/main/services/webhooks/webhookServer'

/** v4.0: the webhook receiver, a server listening on this PC */

// A port of its own per test: fetch keeps sockets to the previous server alive
let PORT = 40000 + (process.pid % 2000) * 10
const url = (path = '/hook') => `http://127.0.0.1:${PORT}${path}`

afterEach(() => { PORT++; stopWebhooks(); clearRequests(); setResponse({ status: 200, contentType: 'application/json', body: '{"ok":true}' }) })
afterAll(() => stopWebhooks())

/** A raw POST, so a body can be streamed past the limit */
function post(path: string, size: number): Promise<number> {
  return new Promise((res, rej) => {
    const req = request(url(path), { method: 'POST', headers: { 'content-type': 'text/plain' } }, r => { r.resume(); r.on('end', () => res(r.statusCode ?? 0)) })
    req.on('error', rej)
    const chunk = Buffer.alloc(64 * 1024, 'a')
    for (let sent = 0; sent < size; sent += chunk.length) req.write(chunk.subarray(0, Math.min(chunk.length, size - sent)))
    req.end()
  })
}

describe('listening', () => {
  it('listens on this PC only', async () => {
    const st = await startWebhooks(PORT)
    expect(st).toMatchObject({ port: PORT })
    expect((await fetch(url())).status).toBe(200)
    // Not on the network addresses of the machine
    const lan = Object.values(networkInterfaces()).flat().find(i => i && i.family === 'IPv4' && !i.internal)
    if (lan) await expect(fetch(`http://${lan.address}:${PORT}/`, { signal: AbortSignal.timeout(2000) })).rejects.toThrow()
  })

  it('refuses a port that is not a plain user port, with a message instead of a crash', async () => {
    for (const p of [0, 80, 70000, 1.5, Number.NaN, '3000' as unknown as number]) {
      const st = await startWebhooks(p)
      expect(st.port, String(p)).toBeNull()
      expect(st.error).toMatch(/1024 to 65535/)
    }
  })

  it('says when the port is taken', async () => {
    const other: Server = createServer().listen(PORT, '127.0.0.1')
    await new Promise(r => other.once('listening', r))
    try {
      expect(await startWebhooks(PORT)).toMatchObject({ port: null, error: `Port ${PORT} is already used` })
    } finally { other.close() }
  })
})

describe('capturing', () => {
  it('keeps the method, path, headers and body of a request', async () => {
    await startWebhooks(PORT)
    await fetch(url('/stripe?x=1'), { method: 'POST', headers: { 'x-signature': 'abc', 'content-type': 'application/json' }, body: '{"id":1}' })
    expect(listRequests()[0]).toMatchObject({ method: 'POST', url: '/stripe?x=1', body: '{"id":1}', truncated: false })
    expect(listRequests()[0].headers['x-signature']).toBe('abc')
  })

  it('keeps only the first megabyte of a huge body, and still answers', async () => {
    await startWebhooks(PORT)
    expect(await post('/big', 3 * 1024 * 1024)).toBe(200)
    const r = listRequests()[0]
    expect(r.truncated).toBe(true)
    expect(r.body.length).toBe(1024 * 1024)
  })

  it('keeps the last 100 requests', async () => {
    await startWebhooks(PORT)
    for (let i = 0; i < 105; i++) await fetch(url(`/n${i}`))
    expect(listRequests()).toHaveLength(100)
    expect(listRequests()[0].url).toBe('/n104')
  })
})

describe('the answer', () => {
  it('sends the chosen status, type and body', async () => {
    setResponse({ status: 201, contentType: 'text/plain', body: 'created' })
    await startWebhooks(PORT)
    const res = await fetch(url())
    expect(res.status).toBe(201)
    expect(res.headers.get('content-type')).toBe('text/plain')
    expect(await res.text()).toBe('created')
  })

  it('refuses a header that would break every answer, and keeps the previous one', async () => {
    for (const bad of [
      { status: 99, contentType: 'text/plain', body: '' },
      { status: 200, contentType: 'text/html\r\nSet-Cookie: x=1', body: '' },
      { status: 200, contentType: '', body: '' },
      { status: 200, contentType: 'text/plain', body: 42 as unknown as string }
    ]) expect(() => setResponse(bad), JSON.stringify(bad)).toThrow()
    await startWebhooks(PORT)
    const res = await fetch(url())
    expect(res.headers.get('content-type')).toBe('application/json')
    expect(res.headers.get('set-cookie')).toBeNull()
  })
})

describe('replay', () => {
  it('sends a captured request to an http(s) address only', async () => {
    await startWebhooks(PORT)
    await fetch(url('/hook'), { method: 'POST', body: 'hello' })
    const id = listRequests()[0].id
    for (const target of ['file:///C:/Windows/win.ini', 'ftp://example.com/', 'javascript:alert(1)']) {
      expect((await replay(id, target)).error, target).toMatch(/http/)
    }
    expect((await replay('nope', url())).error).toBe('Request not found')
  })

  it('replays the method and body to the target', async () => {
    let got = ''
    const target = createServer((req, res) => { let b = ''; req.on('data', c => { b += c }); req.on('end', () => { got = `${req.method} ${req.url} ${b}`; res.end('done') }) })
    await new Promise<void>(r => target.listen(0, '127.0.0.1', () => r()))
    try {
      await startWebhooks(PORT)
      await fetch(url('/hook?a=1'), { method: 'POST', body: 'hello' })
      const r = await replay(listRequests()[0].id, `http://127.0.0.1:${(target.address() as AddressInfo).port}`)
      expect(r).toMatchObject({ status: 200, body: 'done' })
      expect(got).toBe('POST /hook?a=1 hello')
    } finally { target.close() }
  })
})
