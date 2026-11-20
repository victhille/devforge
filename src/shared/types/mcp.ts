// ─── MCP servers that Forgy can use as tools ─────────────────────────────────

/** How DevForge reaches a server: an address (https://…/mcp), or a command run on this PC */
export type McpTransport = 'http' | 'stdio'

/** What a server asks for: a sign-in in the browser (OAuth), nothing, or nothing but running on this PC */
export type McpAuth = 'oauth' | 'none' | 'local'

export type McpState = 'off' | 'needs-login' | 'connecting' | 'ready' | 'error'

export interface McpServer {
  /** A catalog id (vercel, context7…) or `custom-…` */
  id: string
  name: string
  transport: McpTransport
  auth: McpAuth
  /** The address, or the command line, as shown to the user */
  target: string
  /** Part of the catalog (described by DevForge), else added by the user */
  catalog: boolean
  /** Added to DevForge (a catalog entry not added only shows in the list) */
  added: boolean
  /** Forgy may use its tools */
  enabled: boolean
  state: McpState
  error: string | null
  /** Its tools, once connected: how many, and how many only read */
  tools: number
  readOnlyTools: number
  /** Signed in (a token is saved) */
  signedIn: boolean
}

export interface McpCustom {
  name: string
  /** https://… for an address, anything else is a command run on this PC */
  target: string
}

export interface McpAPI {
  list: () => Promise<McpServer[]>
  /** Adds a catalog server (and signs in if it asks for it) */
  add: (id: string) => Promise<McpServer>
  addCustom: (custom: McpCustom) => Promise<McpServer>
  remove: (id: string) => Promise<void>
  setEnabled: (id: string, enabled: boolean) => Promise<McpServer>
  /** Opens the browser to sign in, and waits for the answer */
  signIn: (id: string) => Promise<McpServer>
  signOut: (id: string) => Promise<McpServer>
  /** Connects again and lists the tools */
  test: (id: string) => Promise<McpServer>
}
