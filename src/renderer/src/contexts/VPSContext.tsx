import { createContext, useContext, useRef, useState, useCallback, type ReactNode } from 'react'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface VPSSessionState {
  sessionId: string
  status:    'connecting' | 'connected' | 'error' | 'disconnected'
  error?:    string
}

interface VPSContextType {
  sessions:     Map<string, VPSSessionState>
  getOrConnect: (connectionId: string) => Promise<string>
  reconnect:    (connectionId: string) => Promise<string>
}

// ─── Context ──────────────────────────────────────────────────────────────────

const VPSContext = createContext<VPSContextType | null>(null)

export function VPSProvider({ children }: { children: ReactNode }) {
  const [sessions, setSessions] = useState<Map<string, VPSSessionState>>(new Map())
  const sessionsRef = useRef<Map<string, VPSSessionState>>(new Map())
  const pendingRef  = useRef<Map<string, Promise<string>>>(new Map())

  function updateSession(connectionId: string, session: VPSSessionState) {
    sessionsRef.current = new Map(sessionsRef.current).set(connectionId, session)
    setSessions(sessionsRef.current)
  }

  async function _connect(connectionId: string): Promise<string> {
    updateSession(connectionId, { sessionId: '', status: 'connecting' })

    const promise = window.devforge.sshConnectDashboard(connectionId)
      .then(sessionId => {
        updateSession(connectionId, { sessionId, status: 'connected' })
        pendingRef.current.delete(connectionId)
        return sessionId
      })
      .catch(err => {
        updateSession(connectionId, { sessionId: '', status: 'error', error: String(err) })
        pendingRef.current.delete(connectionId)
        throw err
      })

    pendingRef.current.set(connectionId, promise)
    return promise
  }

  const getOrConnect = useCallback(async (connectionId: string): Promise<string> => {
    // Already connected → reuse
    const existing = sessionsRef.current.get(connectionId)
    if (existing?.status === 'connected') return existing.sessionId

    // Already connecting → wait for it
    const pending = pendingRef.current.get(connectionId)
    if (pending) return pending

    return _connect(connectionId)
  }, [])

  const reconnect = useCallback(async (connectionId: string): Promise<string> => {
    // Disconnect old session if any
    const existing = sessionsRef.current.get(connectionId)
    if (existing?.sessionId) {
      window.devforge.sshDisconnect(existing.sessionId).catch(() => {})
    }
    pendingRef.current.delete(connectionId)
    return _connect(connectionId)
  }, [])

  return (
    <VPSContext.Provider value={{ sessions, getOrConnect, reconnect }}>
      {children}
    </VPSContext.Provider>
  )
}

export function useVPS() {
  const ctx = useContext(VPSContext)
  if (!ctx) throw new Error('useVPS must be used inside VPSProvider')
  return ctx
}
