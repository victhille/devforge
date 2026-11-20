import { createServer, type Server } from 'http'
import { say } from './say'

/**
 * Where the browser comes back after a sign-in (MCP servers, Vercel): a server on this PC only, open
 * the time of one sign-in. The address is fixed, registered with each service.
 */
export const LOOPBACK_PORT = 47823
export const LOOPBACK_URL = `http://127.0.0.1:${LOOPBACK_PORT}/callback`
const TIMEOUT = 5 * 60 * 1000

export interface Loopback {
  /** The code the browser brings back with the expected state */
  code: Promise<string>
  /** The state this sign-in sent; until it is set, every request is refused */
  expect: (state: string) => void
  /** Closes the port (always called, in a finally) */
  stop: () => void
}

let busy = false

/**
 * Opens the port for one sign-in (one at a time: the port is shared). A request without the state of
 * this sign-in (another page calling the port) is refused and the wait goes on.
 */
export function openLoopback(): Loopback {
  if (busy) throw new Error(say('Une autre connexion est en cours : termine-la d’abord', 'Another sign-in is under way: finish it first'))
  busy = true
  let state = ''
  let server: Server | null = null
  let timer: NodeJS.Timeout | undefined
  const stop = () => {
    clearTimeout(timer)
    server?.close()
    server = null
    state = ''
    busy = false
  }
  const code = new Promise<string>((resolve, reject) => {
    const s = createServer((req, res) => {
      const url = new URL(req.url ?? '/', LOOPBACK_URL)
      if (url.pathname !== '/callback') {
        res.writeHead(404).end()
        return
      }
      const mine = !!state && url.searchParams.get('state') === state
      const got = url.searchParams.get('code')
      const ok = mine && !!got
      res.writeHead(ok ? 200 : 400, { 'Content-Type': 'text/html; charset=utf-8', 'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'" })
      res.end(page(ok))
      if (!mine) return
      if (got) resolve(got)
      else reject(new Error(url.searchParams.get('error_description') || url.searchParams.get('error') || say('Connexion refusée', 'Sign-in refused')))
    })
    server = s
    s.once('error', (err: NodeJS.ErrnoException) =>
      reject(
        new Error(
          err.code === 'EADDRINUSE'
            ? say(
                `Le port ${LOOPBACK_PORT} est déjà pris : ferme ce qui l’utilise et réessaie`,
                `Port ${LOOPBACK_PORT} is already used: close what uses it and try again`
              )
            : err.message
        )
      )
    )
    s.listen(LOOPBACK_PORT, '127.0.0.1')
    timer = setTimeout(() => reject(new Error(say('Connexion pas terminée après 5 minutes', 'Sign-in not finished after 5 minutes'))), TIMEOUT)
  })
  // Read only when the service asks for a sign-in
  code.catch(() => {})
  return { code, expect: s => void (state = s), stop }
}

const page = (ok: boolean) =>
  `<!doctype html><meta charset="utf-8"><title>DevForge</title><body style="font-family:Segoe UI,sans-serif;background:#121110;color:#F2EEE9;display:grid;place-items:center;height:100vh;margin:0"><div style="text-align:center"><h1 style="font-size:22px">${ok ? 'DevForge est connecté · DevForge is connected' : 'Connexion refusée · Sign-in refused'}</h1><p style="color:#B5ADA4">${ok ? 'Tu peux fermer cet onglet et revenir à DevForge. · You can close this tab.' : 'Reviens à DevForge pour réessayer. · Go back to DevForge to try again.'}</p></div></body>`
