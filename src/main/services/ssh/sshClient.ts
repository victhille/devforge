import { Client, type ConnectConfig } from 'ssh2'
import { readFileSync, existsSync } from 'fs'
import net from 'net'
import type { SSHConnection } from '@shared/types'
import { getSshConnectionWithSecret } from './sshStorage'

/** ssh2 config from a saved connection (password or private key) */
export function buildSshConfig(conn: SSHConnection): ConnectConfig {
  const cfg: ConnectConfig = { host: conn.host, port: conn.port, username: conn.username, readyTimeout: 10_000, keepaliveInterval: 15_000 }
  if (conn.authMethod === 'password') cfg.password = conn.password
  else {
    const keyPath = conn.privateKeyPath ?? ''
    if (!existsSync(keyPath)) throw new Error(`Private key not found: ${keyPath}`)
    cfg.privateKey = readFileSync(keyPath)
  }
  return cfg
}

/** Open a standalone SSH client for a saved connection id */
export function connectSsh(connectionId: string): Promise<Client> {
  const conn = getSshConnectionWithSecret(connectionId)
  if (!conn) return Promise.reject(new Error('SSH connection not found'))
  return new Promise((resolve, reject) => {
    const client = new Client()
    client.once('ready', () => resolve(client))
    client.once('error', reject)
    try { client.connect(buildSshConfig(conn)) } catch (err) { reject(err) }
  })
}

/** Run one command and return stdout+stderr with the exit code */
export function sshRun(client: Client, command: string, timeoutMs = 20_000): Promise<{ code: number | null; output: string }> {
  return new Promise((resolve, reject) => {
    client.exec(command, (err, stream) => {
      if (err) return reject(err)
      let output = ''
      const timer = setTimeout(() => { stream.close(); reject(new Error('Command timed out')) }, timeoutMs)
      stream.on('data', (d: Buffer) => { output += d.toString() })
      stream.stderr.on('data', (d: Buffer) => { output += d.toString() })
      stream.on('close', (code: number | null) => { clearTimeout(timer); resolve({ code, output }) })
    })
  })
}

export interface Tunnel { localPort: number; close: () => void }

/**
 * Local TCP port forwarded through SSH to `remoteHost:remotePort` (as seen from
 * the server), like `ssh -L`. Lets DB drivers talk to databases that are not
 * exposed on the internet.
 */
export async function openTunnel(connectionId: string, remoteHost: string, remotePort: number): Promise<Tunnel> {
  const client = await connectSsh(connectionId)
  const server = net.createServer(socket => {
    client.forwardOut('127.0.0.1', 0, remoteHost, remotePort, (err, stream) => {
      if (err) { socket.destroy(); return }
      socket.pipe(stream).pipe(socket)
      socket.on('error', () => stream.close())
      stream.on('error', () => socket.destroy())
    })
  })
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => resolve())
  })
  // Server dropped the SSH link: stop accepting local connections
  client.on('close', () => server.close())
  return {
    localPort: (server.address() as net.AddressInfo).port,
    close: () => { server.close(); client.end() }
  }
}
