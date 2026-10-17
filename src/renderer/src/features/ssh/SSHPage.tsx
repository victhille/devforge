import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { WebLinksAddon } from '@xterm/addon-web-links'
import {
  Plus, Trash2, Terminal as TerminalIcon, Wifi, WifiOff,
  Loader, ChevronRight, Edit2, X, Server, Key, Lock, BarChart2
} from 'lucide-react'
import type { SSHConnection, SSHSessionStatus } from '@shared/types'
import { useI18n } from '@renderer/i18n/I18nContext'
import Button from '@renderer/components/ui/Button'
import styles from './SSHPage.module.css'
import '@xterm/xterm/css/xterm.css'

// ─── Colors for connection dot ────────────────────────────────────────────────

const CONNECTION_COLORS = [
  '#4F8EF7', '#3DD68C', '#F5A623', '#F7615A',
  '#A78BFA', '#34D399', '#60A5FA', '#F472B6'
]

// ─── Connection Form ──────────────────────────────────────────────────────────

interface ConnectionFormProps {
  initial?: SSHConnection
  onSave: (conn: SSHConnection) => void
  onCancel: () => void
}

function ConnectionForm({ initial, onSave, onCancel }: ConnectionFormProps) {
  const { t } = useI18n()
  const [name, setName]             = useState(initial?.name ?? '')
  const [host, setHost]             = useState(initial?.host ?? '')
  const [port, setPort]             = useState(String(initial?.port ?? 22))
  const [username, setUsername]     = useState(initial?.username ?? '')
  const [authMethod, setAuthMethod] = useState<'password' | 'privateKey'>(initial?.authMethod ?? 'password')
  const [password, setPassword]     = useState('')
  const [keyPath, setKeyPath]       = useState(initial?.privateKeyPath ?? '')
  const [color, setColor]           = useState(initial?.color ?? CONNECTION_COLORS[0])
  const [errors, setErrors]         = useState<Record<string, string>>({})

  async function browseKey() {
    const dir = await window.devforge.selectDirectory()
    if (dir) setKeyPath(dir)
  }

  function validate(): boolean {
    const errs: Record<string, string> = {}
    if (!name.trim())     errs.name     = 'Required'
    if (!host.trim())     errs.host     = 'Required'
    if (!username.trim()) errs.username = 'Required'
    const p = parseInt(port, 10)
    if (isNaN(p) || p < 1 || p > 65535) errs.port = 'Invalid port'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  function handleSave() {
    if (!validate()) return
    onSave({
      id:             initial?.id ?? crypto.randomUUID(),
      name:           name.trim(),
      host:           host.trim(),
      port:           parseInt(port, 10),
      username:       username.trim(),
      authMethod,
      password:       authMethod === 'password' ? password : undefined,
      privateKeyPath: authMethod === 'privateKey' ? keyPath : undefined,
      color,
      createdAt:      initial?.createdAt ?? new Date().toISOString()
    })
  }

  return (
    <div className={styles.formOverlay}>
      <div className={styles.formPanel}>
        <div className={styles.formHeader}>
          <h3>{initial ? t.ssh.editConnection : t.ssh.newConnection}</h3>
          <button className={styles.iconBtn} onClick={onCancel}><X size={16} /></button>
        </div>

        <div className={styles.formBody}>
          <div className={styles.field}>
            <label>{t.ssh.labelName}</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="My VPS" className={errors.name ? styles.inputErr : ''} />
            {errors.name && <span className={styles.err}>{errors.name}</span>}
          </div>

          <div className={styles.fieldRow}>
            <div className={`${styles.field} ${styles.grow}`}>
              <label>{t.ssh.labelHost}</label>
              <input value={host} onChange={e => setHost(e.target.value)} placeholder="192.168.1.1" className={errors.host ? styles.inputErr : ''} />
              {errors.host && <span className={styles.err}>{errors.host}</span>}
            </div>
            <div className={styles.field} style={{ width: 80 }}>
              <label>{t.ssh.labelPort}</label>
              <input value={port} onChange={e => setPort(e.target.value)} placeholder="22" className={errors.port ? styles.inputErr : ''} />
              {errors.port && <span className={styles.err}>{errors.port}</span>}
            </div>
          </div>

          <div className={styles.field}>
            <label>{t.ssh.labelUsername}</label>
            <input value={username} onChange={e => setUsername(e.target.value)} placeholder="root" className={errors.username ? styles.inputErr : ''} />
            {errors.username && <span className={styles.err}>{errors.username}</span>}
          </div>

          <div className={styles.field}>
            <label>{t.ssh.labelAuth}</label>
            <div className={styles.authTabs}>
              <button
                className={`${styles.authTab} ${authMethod === 'password' ? styles.authTabActive : ''}`}
                onClick={() => setAuthMethod('password')}
              >
                <Lock size={13} /> {t.ssh.authPassword}
              </button>
              <button
                className={`${styles.authTab} ${authMethod === 'privateKey' ? styles.authTabActive : ''}`}
                onClick={() => setAuthMethod('privateKey')}
              >
                <Key size={13} /> {t.ssh.authKey}
              </button>
            </div>
          </div>

          {authMethod === 'password' ? (
            <div className={styles.field}>
              <label>{t.ssh.labelPassword}</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder={initial?.hasPassword ? t.ssh.passwordUnchanged : '••••••••'} />
            </div>
          ) : (
            <div className={styles.field}>
              <label>{t.ssh.labelKeyPath}</label>
              <div className={styles.pathRow}>
                <input value={keyPath} onChange={e => setKeyPath(e.target.value)} placeholder="~/.ssh/id_rsa" />
                <Button variant="secondary" size="sm" onClick={browseKey}>{t.ssh.browseKey}</Button>
              </div>
            </div>
          )}

          <div className={styles.field}>
            <label>{t.ssh.labelColor}</label>
            <div className={styles.colorRow}>
              {CONNECTION_COLORS.map(c => (
                <button
                  key={c}
                  className={`${styles.colorDot} ${color === c ? styles.colorDotActive : ''}`}
                  style={{ background: c }}
                  onClick={() => setColor(c)}
                />
              ))}
            </div>
          </div>
        </div>

        <div className={styles.formFooter}>
          <Button variant="ghost" onClick={onCancel}>{t.ssh.cancel}</Button>
          <Button onClick={handleSave}>{t.ssh.save}</Button>
        </div>
      </div>
    </div>
  )
}

// ─── Terminal pane ────────────────────────────────────────────────────────────

interface TerminalPaneProps {
  sessionId: string
  status: SSHSessionStatus['status']
  error?: string
  active: boolean
}

function TerminalPane({ sessionId, status, error, active }: TerminalPaneProps) {
  const { t } = useI18n()
  const containerRef = useRef<HTMLDivElement>(null)
  const termRef      = useRef<Terminal | null>(null)
  const fitRef       = useRef<FitAddon | null>(null)
  const unsubRef     = useRef<(() => void) | null>(null)

  useEffect(() => {
    if (!containerRef.current) return

    const term = new Terminal({
      theme: {
        background:  '#090B10',
        foreground:  '#D4D4D4',
        cursor:      '#4F8EF7',
        selectionBackground: 'rgba(79,142,247,0.3)',
        black:       '#1E2435',
        brightBlack: '#4A5068',
        red:         '#F7615A', brightRed:    '#FF7875',
        green:       '#3DD68C', brightGreen:  '#5EF9A8',
        yellow:      '#F5A623', brightYellow: '#FFD666',
        blue:        '#4F8EF7', brightBlue:   '#74AAFF',
        magenta:     '#A78BFA', brightMagenta:'#C4B5FD',
        cyan:        '#38BDF8', brightCyan:   '#7DD3FC',
        white:       '#CBD5E1', brightWhite:  '#F1F5F9'
      },
      fontFamily: "'JetBrains Mono', 'Cascadia Code', 'Fira Code', 'Consolas', monospace",
      fontSize:    13,
      lineHeight:  1.4,
      cursorBlink: true,
      scrollback:  5000,
      allowProposedApi: true
    })

    const fit   = new FitAddon()
    const links = new WebLinksAddon()
    term.loadAddon(fit)
    term.loadAddon(links)
    term.open(containerRef.current)
    fit.fit()

    termRef.current = term
    fitRef.current  = fit

    // Subscribe to SSH data for this session
    const unsub = window.devforge.onSshData((sid, data) => {
      if (sid === sessionId) term.write(data)
    })
    unsubRef.current = unsub

    // Send keystrokes to SSH
    term.onData(data => {
      window.devforge.sshWrite(sessionId, data)
    })

    // Resize
    const ro = new ResizeObserver(() => {
      fit.fit()
      const { cols, rows } = term
      window.devforge.sshResize(sessionId, cols, rows)
    })
    ro.observe(containerRef.current)

    return () => {
      ro.disconnect()
      unsub()
      term.dispose()
      termRef.current = null
    }
  }, [sessionId])

  // Re-fit when pane becomes active
  useEffect(() => {
    if (active && fitRef.current) {
      setTimeout(() => fitRef.current?.fit(), 50)
    }
  }, [active])

  return (
    <div className={`${styles.terminalPane} ${active ? styles.terminalActive : ''}`}>
      {status === 'connecting' && (
        <div className={styles.termOverlay}>
          <Loader size={20} className={styles.spin} />
          <span>{t.ssh.connecting}</span>
        </div>
      )}
      {status === 'error' && (
        <div className={styles.termOverlay}>
          <WifiOff size={20} style={{ color: 'var(--danger)' }} />
          <span style={{ color: 'var(--danger)' }}>{error ?? t.ssh.disconnected}</span>
        </div>
      )}
      {status === 'disconnected' && (
        <div className={styles.termOverlay}>
          <WifiOff size={20} style={{ color: 'var(--text-muted)' }} />
          <span style={{ color: 'var(--text-muted)' }}>{t.ssh.disconnected}</span>
        </div>
      )}
      <div
        ref={containerRef}
        className={styles.xtermContainer}
        style={{ opacity: status === 'connected' ? 1 : 0 }}
      />
    </div>
  )
}

// ─── Main SSH Page ─────────────────────────────────────────────────────────────

interface ActiveSession {
  sessionId: string
  connectionId: string
  connectionName: string
  connectionColor: string
  status: SSHSessionStatus['status']
  error?: string
}

export default function SSHPage() {
  const { t }    = useI18n()
  const navigate = useNavigate()
  const [connections, setConnections] = useState<SSHConnection[]>([])
  const [sessions, setSessions]       = useState<ActiveSession[]>([])
  const [activeSessionId, setActive]  = useState<string | null>(null)
  const [showForm, setShowForm]       = useState(false)
  const [editTarget, setEditTarget]   = useState<SSHConnection | undefined>()

  useEffect(() => {
    window.devforge.getSshConnections().then(setConnections)
  }, [])

  useEffect(() => {
    const unsub = window.devforge.onSshStatus(status => {
      setSessions(prev =>
        prev.map(s =>
          s.sessionId === status.sessionId
            ? { ...s, status: status.status, error: status.error }
            : s
        )
      )
    })
    return unsub
  }, [])

  async function handleConnect(conn: SSHConnection) {
    // Don't open duplicate session for same connection
    const exists = sessions.find(s => s.connectionId === conn.id && s.status !== 'disconnected')
    if (exists) { setActive(exists.sessionId); return }

    const sessionId = await window.devforge.sshConnect(conn.id)
    const session: ActiveSession = {
      sessionId,
      connectionId:    conn.id,
      connectionName:  conn.name,
      connectionColor: conn.color,
      status: 'connecting'
    }
    setSessions(prev => [...prev, session])
    setActive(sessionId)
  }

  async function handleCloseSession(sessionId: string) {
    await window.devforge.sshDisconnect(sessionId)
    setSessions(prev => prev.filter(s => s.sessionId !== sessionId))
    setActive(prev => {
      if (prev !== sessionId) return prev
      const remaining = sessions.filter(s => s.sessionId !== sessionId)
      return remaining.length > 0 ? remaining[remaining.length - 1].sessionId : null
    })
  }

  async function handleSaveConnection(conn: SSHConnection) {
    await window.devforge.saveSshConnection(conn)
    setConnections(prev => {
      const idx = prev.findIndex(c => c.id === conn.id)
      return idx >= 0 ? prev.map(c => c.id === conn.id ? conn : c) : [...prev, conn]
    })
    setShowForm(false)
    setEditTarget(undefined)
  }

  async function handleDeleteConnection(id: string) {
    await window.devforge.removeSshConnection(id)
    setConnections(prev => prev.filter(c => c.id !== id))
  }

  return (
    <div className={styles.page}>
      {/* ── Left panel: connections list ─────────────────── */}
      <aside className={styles.connPanel}>
        <div className={styles.connHeader}>
          <span className={styles.connTitle}>{t.ssh.connections}</span>
          <button className={styles.iconBtn} onClick={() => { setEditTarget(undefined); setShowForm(true) }}>
            <Plus size={15} />
          </button>
        </div>

        <div className={styles.connList}>
          {connections.length === 0 && (
            <div className={styles.connEmpty}>
              <Server size={24} style={{ color: 'var(--text-muted)' }} />
              <span>{t.ssh.noConnections}</span>
              <Button variant="secondary" size="sm" onClick={() => setShowForm(true)}>{t.ssh.addServer}</Button>
            </div>
          )}
          {connections.map(conn => {
            const active = sessions.find(s => s.connectionId === conn.id && s.status !== 'disconnected')
            return (
              <div key={conn.id} className={styles.connItem}>
                <button
                  className={styles.connBtn}
                  onClick={() => handleConnect(conn)}
                >
                  <span className={styles.connDot} style={{ background: conn.color }} />
                  <div className={styles.connInfo}>
                    <span className={styles.connName}>{conn.name}</span>
                    <span className={styles.connMeta}>{conn.username}@{conn.host}:{conn.port}</span>
                  </div>
                  {active && (
                    <span className={styles.connBadge} style={{ background: `${conn.color}22`, color: conn.color }}>
                      {active.status === 'connecting' ? '...' : 'live'}
                    </span>
                  )}
                  <ChevronRight size={13} className={styles.connArrow} />
                </button>
                <div className={styles.connActions}>
                  <button className={styles.iconBtn} onClick={() => navigate(`/vps/${conn.id}`)} title="Dashboard">
                    <BarChart2 size={12} />
                  </button>
                  <button className={styles.iconBtn} onClick={() => { setEditTarget(conn); setShowForm(true) }}>
                    <Edit2 size={12} />
                  </button>
                  <button className={styles.iconBtn} onClick={() => handleDeleteConnection(conn.id)}>
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </aside>

      {/* ── Right panel: terminal tabs ───────────────────── */}
      <div className={styles.termPanel}>
        {sessions.length === 0 ? (
          <div className={styles.emptyTerminal}>
            <TerminalIcon size={40} style={{ color: 'var(--text-muted)' }} />
            <p>{t.ssh.emptyTerminal}</p>
          </div>
        ) : (
          <>
            {/* Tabs */}
            <div className={styles.tabBar}>
              {sessions.map(s => {
                const isActive = s.sessionId === activeSessionId
                return (
                  <button
                    key={s.sessionId}
                    className={`${styles.tab} ${isActive ? styles.tabActive : ''}`}
                    onClick={() => setActive(s.sessionId)}
                  >
                    <span className={styles.tabDot} style={{ background: s.connectionColor }} />
                    <span>{s.connectionName}</span>
                    {s.status === 'connecting' && <Loader size={11} className={styles.spin} />}
                    {s.status === 'connected'  && <Wifi    size={11} style={{ color: 'var(--success)' }} />}
                    {(s.status === 'disconnected' || s.status === 'error') && <WifiOff size={11} style={{ color: 'var(--text-muted)' }} />}
                    <button
                      className={styles.tabClose}
                      onClick={e => { e.stopPropagation(); handleCloseSession(s.sessionId) }}
                    >
                      <X size={11} />
                    </button>
                  </button>
                )
              })}
            </div>

            {/* Terminal panes (all mounted, only active is visible) */}
            <div className={styles.termPanes}>
              {sessions.map(s => (
                <TerminalPane
                  key={s.sessionId}
                  sessionId={s.sessionId}
                  status={s.status}
                  error={s.error}
                  active={s.sessionId === activeSessionId}
                />
              ))}
            </div>
          </>
        )}
      </div>

      {/* Connection form overlay */}
      {showForm && (
        <ConnectionForm
          initial={editTarget}
          onSave={handleSaveConnection}
          onCancel={() => { setShowForm(false); setEditTarget(undefined) }}
        />
      )}
    </div>
  )
}
