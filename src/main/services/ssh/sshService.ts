import { Client, type ConnectConfig } from 'ssh2'
import { randomUUID } from 'crypto'
import { buildSshConfig } from './sshClient'
import type { SSHConnection, SSHSessionStatus } from '@shared/types'

type DataCb   = (sessionId: string, data: string) => void
type StatusCb = (status: SSHSessionStatus) => void

interface Session {
  sessionId: string
  connectionId: string
  client: Client
  stream: import('ssh2').ClientChannel | null
}

export class SSHService {
  private sessions = new Map<string, Session>()
  private onData:   DataCb   = () => {}
  private onStatus: StatusCb = () => {}

  setCallbacks(onData: DataCb, onStatus: StatusCb): void {
    this.onData   = onData
    this.onStatus = onStatus
  }

  connect(conn: SSHConnection): string {
    const sessionId = randomUUID()

    let hostError: Error | null = null
    let cfg: ConnectConfig
    try {
      cfg = buildSshConfig(conn, err => { hostError = err })
    } catch (err) {
      this.onStatus({ sessionId, connectionId: conn.id, status: 'error', error: (err as Error).message })
      return sessionId
    }

    const client = new Client()

    this.sessions.set(sessionId, { sessionId, connectionId: conn.id, client, stream: null })

    this.onStatus({ sessionId, connectionId: conn.id, status: 'connecting' })

    client.on('ready', () => {
      this.onStatus({ sessionId, connectionId: conn.id, status: 'connected' })

      client.shell({ term: 'xterm-256color' }, (err, stream) => {
        if (err) {
          this.onStatus({ sessionId, connectionId: conn.id, status: 'error', error: err.message })
          client.end()
          return
        }

        const session = this.sessions.get(sessionId)
        if (session) session.stream = stream

        stream.on('data', (data: Buffer) => {
          this.onData(sessionId, data.toString('utf-8'))
        })

        stream.stderr.on('data', (data: Buffer) => {
          this.onData(sessionId, data.toString('utf-8'))
        })

        stream.on('close', () => {
          this.onStatus({ sessionId, connectionId: conn.id, status: 'disconnected' })
          client.end()
          this.sessions.delete(sessionId)
        })
      })
    })

    client.on('error', (err) => {
      // A rejected host key surfaces as a generic error: show the real reason
      this.onStatus({ sessionId, connectionId: conn.id, status: 'error', error: (hostError ?? err).message })
      this.sessions.delete(sessionId)
    })

    client.on('close', () => {
      const existing = this.sessions.get(sessionId)
      if (existing) {
        this.onStatus({ sessionId, connectionId: conn.id, status: 'disconnected' })
        this.sessions.delete(sessionId)
      }
    })

    client.connect(cfg)
    return sessionId
  }

  write(sessionId: string, data: string): void {
    const session = this.sessions.get(sessionId)
    session?.stream?.write(data)
  }

  resize(sessionId: string, cols: number, rows: number): void {
    const session = this.sessions.get(sessionId)
    session?.stream?.setWindow(rows, cols, 0, 0)
  }

  disconnect(sessionId: string): void {
    const session = this.sessions.get(sessionId)
    if (session) {
      session.stream?.close()
      session.client.end()
      this.sessions.delete(sessionId)
    }
  }

  connectForDashboard(conn: SSHConnection): Promise<string> {
    return new Promise((resolve, reject) => {
      const sessionId = randomUUID()

      let hostError: Error | null = null
      let cfg: ConnectConfig
      try { cfg = buildSshConfig(conn, err => { hostError = err }) } catch (err) { reject(err); return }

      const client = new Client()
      this.sessions.set(sessionId, { sessionId, connectionId: conn.id, client, stream: null })

      client.on('ready', () => {
        this.onStatus({ sessionId, connectionId: conn.id, status: 'connected' })
        resolve(sessionId)
      })
      client.on('error', (err) => {
        this.sessions.delete(sessionId)
        reject(hostError ?? err)
      })
      client.on('close', () => {
        const existing = this.sessions.get(sessionId)
        if (existing) {
          this.onStatus({ sessionId, connectionId: conn.id, status: 'disconnected' })
          this.sessions.delete(sessionId)
        }
      })
      client.connect(cfg)
    })
  }

  exec(sessionId: string, command: string, timeoutMs = 12000): Promise<string> {
    return new Promise((resolve, reject) => {
      const session = this.sessions.get(sessionId)
      if (!session) { reject(new Error('Session not found')); return }

      const timer = setTimeout(() => reject(new Error('Command timed out')), timeoutMs)

      session.client.exec(command, (err, stream) => {
        if (err) { clearTimeout(timer); reject(err); return }
        let output = ''
        stream.on('data', (d: Buffer) => { output += d.toString() })
        stream.stderr.on('data', (d: Buffer) => { output += d.toString() })
        stream.on('close', () => { clearTimeout(timer); resolve(output.trim()) })
      })
    })
  }

  /** A TCP stream to a port of the server itself, through the SSH session (the port never needs to be public) */
  forwardOut(sessionId: string, port: number): Promise<import('stream').Duplex> {
    return new Promise((resolve, reject) => {
      const session = this.sessions.get(sessionId)
      if (!session) { reject(new Error('Session not found')); return }
      session.client.forwardOut('127.0.0.1', 0, '127.0.0.1', port, (err, stream) => (err ? reject(err) : resolve(stream)))
    })
  }

  /** Copies a file of the server to this PC over SFTP (to `localPath`, written in place) */
  download(sessionId: string, remotePath: string, localPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const session = this.sessions.get(sessionId)
      if (!session) { reject(new Error('Session not found')); return }
      session.client.sftp((err, sftp) => {
        if (err) { reject(err); return }
        sftp.fastGet(remotePath, localPath, e => { sftp.end(); if (e) reject(e); else resolve() })
      })
    })
  }

  /** Run a command and stream its output; resolves with the exit code. */
  execStream(sessionId: string, command: string, onData: (text: string) => void, timeoutMs = 30 * 60_000): Promise<number | null> {
    return new Promise((resolve, reject) => {
      const session = this.sessions.get(sessionId)
      if (!session) { reject(new Error('Session not found')); return }

      session.client.exec(command, (err, stream) => {
        if (err) { reject(err); return }
        const timer = setTimeout(() => { stream.close(); reject(new Error('Command timed out')) }, timeoutMs)
        stream.on('data', (d: Buffer) => onData(d.toString()))
        stream.stderr.on('data', (d: Buffer) => onData(d.toString()))
        stream.on('exit', (code: number | null) => { clearTimeout(timer); resolve(code) })
        stream.on('close', () => { clearTimeout(timer); resolve(null) })
      })
    })
  }

  disconnectAll(): void {
    for (const session of this.sessions.values()) {
      session.stream?.close()
      session.client.end()
    }
    this.sessions.clear()
  }
}

export const sshService = new SSHService()
