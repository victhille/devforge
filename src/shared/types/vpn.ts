// ─── VPN: WireGuard managed by wg-easy on a VPS ────────────────────────────────

/** What runs on the server */
export interface VpnDetect {
  /** A wg-easy container is running */
  found: boolean
  container: string | null
  image: string | null
  /** "15.2.2" from the image tag, null for "latest" or a digest */
  version: string | null
  /** Port of wg-easy's web interface on the server (127.0.0.1 side), null when not published */
  port: number | null
  /** wg-easy before v15 has another API */
  supported: boolean
}

/** A server whose wg-easy login is saved in DevForge (the password stays in the main process, encrypted) */
export interface VpnServer {
  connectionId: string
  port: number
  username: string
}

export interface VpnClient {
  id: number
  name: string
  enabled: boolean
  ipv4: string
  ipv6: string | null
  createdAt: string | null
  /** ISO date, null when it never expires */
  expiresAt: string | null
  /** Last WireGuard handshake: null when the device never connected */
  latestHandshakeAt: string | null
  /** Bytes received / sent by the server for this client */
  transferRx: number | null
  transferTx: number | null
}

export interface VpnAPI {
  servers: () => Promise<VpnServer[]>
  detect: (connectionId: string) => Promise<VpnDetect>
  /** Checked against wg-easy before it is saved; throws BAD_LOGIN */
  saveLogin: (connectionId: string, port: number, username: string, password: string) => Promise<VpnServer>
  forget: (connectionId: string) => Promise<void>
  clients: (connectionId: string) => Promise<VpnClient[]>
  /** Returns the new client's id */
  create: (connectionId: string, name: string, expiresAt: string | null) => Promise<number>
  remove: (connectionId: string, clientId: number) => Promise<void>
  setEnabled: (connectionId: string, clientId: number, enabled: boolean) => Promise<void>
  /** The client's QR code as an SVG data: URL (contains its private key: shown on demand only) */
  qrcode: (connectionId: string, clientId: number) => Promise<string>
  /** Asks where to save the .conf file; null when cancelled */
  saveConfig: (connectionId: string, clientId: number) => Promise<string | null>
  /** wg-easy's own interface on this PC through the SSH session; returns its http://localhost URL */
  openWeb: (connectionId: string) => Promise<string>
}
