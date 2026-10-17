import { Client, type ConnectConfig } from 'ssh2'
import { readFileSync, existsSync } from 'fs'
import { randomUUID } from 'crypto'
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

    const cfg: ConnectConfig = {
      host:     conn.host,
      port:     conn.port,
      username: conn.username,
      readyTimeout: 10000
    }

    if (conn.authMethod === 'password') {
      cfg.password = conn.password
    } else if (conn.authMethod === 'privateKey') {
      const keyPath = conn.privateKeyPath ?? ''
      if (!existsSync(keyPath)) {
        this.onStatus({ sessionId, connectionId: conn.id, status: 'error', error: `Private key not found: ${keyPath}` })
        return sessionId
      }
      cfg.privateKey = readFileSync(keyPath)
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
      this.onStatus({ sessionId, connectionId: conn.id, status: 'error', error: err.message })
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

      const cfg: ConnectConfig = {
        host: conn.host, port: conn.port, username: conn.username, readyTimeout: 10000
      }
      if (conn.authMethod === 'password') {
        cfg.password = conn.password
      } else if (conn.authMethod === 'privateKey') {
        const keyPath = conn.privateKeyPath ?? ''
        if (!existsSync(keyPath)) { reject(new Error(`Private key not found: ${keyPath}`)); return }
        cfg.privateKey = readFileSync(keyPath)
      }

      const client = new Client()
      this.sessions.set(sessionId, { sessionId, connectionId: conn.id, client, stream: null })

      client.on('ready', () => {
        this.onStatus({ sessionId, connectionId: conn.id, status: 'connected' })
        resolve(sessionId)
      })
      client.on('error', (err) => {
        this.sessions.delete(sessionId)
        reject(err)
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

  disconnectAll(): void {
    for (const session of this.sessions.values()) {
      session.stream?.close()
      session.client.end()
    }
    this.sessions.clear()
  }
}

export const sshService = new SSHService()
