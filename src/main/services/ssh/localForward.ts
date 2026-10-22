import { request } from 'http'
import { createServer, type AddressInfo, type Server, type Socket } from 'net'
import { log } from '../../lib/log'
import { sshService } from './sshService'
import { sessionFor } from '../monitor/vpsWatch'

/**
 * A port on this PC (127.0.0.1) piped to a port of a server through
 * DevForge's SSH session: what `ssh -L` does, without a terminal or a key
 * file. One forward per server and remote port, reused when asked again.
 */
const forwards = new Map<string, Server>()
const keyOf = (connectionId: string, remotePort: number) => `${connectionId}:${remotePort}`

/** Opens (or reuses) the forward; `preferred` is tried first, any free port otherwise. Returns the local port. */
export async function openForward(connectionId: string, remotePort: number, preferred = remotePort): Promise<number> {
  const key = keyOf(connectionId, remotePort)
  const known = forwards.get(key)
  if (known?.listening) return (known.address() as AddressInfo).port
  await sessionFor(connectionId)
  const server = createServer(sock => {
    sock.pause()
    sessionFor(connectionId)
      .then(sid => sshService.forwardOut(sid, remotePort))
      .then(remote => { sock.pipe(remote).pipe(sock); remote.on('error', () => sock.destroy()); sock.on('error', () => remote.destroy()); sock.resume() })
      .catch(err => { log('warn', 'ssh', `Forward ${remotePort}: ${err instanceof Error ? err.message : err}`); sock.destroy() })
  })
  const listen = (port: number) => new Promise<void>((ok, ko) => { server.once('error', ko); server.listen(port, '127.0.0.1', () => { server.off('error', ko); ok() }) })
  await listen(preferred).catch(() => listen(0))
  forwards.set(key, server)
  const port = (server.address() as AddressInfo).port
  log('info', 'ssh', `Forward 127.0.0.1:${port} → ${connectionId}:${remotePort}`)
  return port
}

export function closeForward(connectionId: string, remotePort: number): void {
  const key = keyOf(connectionId, remotePort)
  forwards.get(key)?.close()
  forwards.delete(key)
}

export function closeAllForwards(): void {
  for (const s of forwards.values()) s.close()
  forwards.clear()
}

/**
 * An SSH channel is a Duplex, not a net.Socket: Node's HTTP client calls
 * socket.setTimeout / setNoDelay / setKeepAlive on it, and a missing one
 * throws before the request is sent (the server then answers 408).
 */
export function asSocket(stream: import('stream').Duplex): Socket {
  const s = stream as unknown as Record<string, unknown>
  for (const m of ['setTimeout', 'setNoDelay', 'setKeepAlive']) if (typeof s[m] !== 'function') s[m] = () => stream
  return stream as unknown as Socket
}

export interface SshHttpResponse { status: number; headers: Record<string, string | string[] | undefined>; body: Buffer }

/** One HTTP request to 127.0.0.1:<port> on the server, through the SSH session (no local port opened) */
export async function sshHttp(connectionId: string, port: number, opts: { method: string; path: string; headers?: Record<string, string>; body?: string; timeoutMs?: number }): Promise<SshHttpResponse> {
  const sock = asSocket(await sshService.forwardOut(await sessionFor(connectionId), port))
  return new Promise((resolve, reject) => {
    // Our own timer: the channel has no real socket timeout
    const timer = setTimeout(() => req.destroy(new Error('The server did not answer')), opts.timeoutMs ?? 20_000)
    const req = request({
      host: '127.0.0.1', port, method: opts.method, path: opts.path,
      headers: { ...(opts.body !== undefined ? { 'content-type': 'application/json', 'content-length': String(Buffer.byteLength(opts.body)) } : {}), ...opts.headers },
      createConnection: () => sock
    }, res => {
      const chunks: Buffer[] = []
      res.on('data', c => chunks.push(c as Buffer))
      res.on('end', () => { clearTimeout(timer); sock.destroy(); resolve({ status: res.statusCode ?? 500, headers: res.headers, body: Buffer.concat(chunks) }) })
    })
    req.on('error', err => { clearTimeout(timer); sock.destroy(); reject(err) })
    req.end(opts.body)
  })
}
