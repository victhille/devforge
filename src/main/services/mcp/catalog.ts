import type { McpAuth, McpTransport } from '@shared/types'

/**
 * The official MCP servers DevForge offers in Settings › Connections. Their addresses are fixed
 * here: the window only ever names a server by its id. A command server (stdio) is pinned to a
 * version, so that what runs on the PC does not change by itself.
 */
export interface CatalogServer {
  id: string
  name: string
  transport: McpTransport
  auth: McpAuth
  /** https://… for an address; the command and its arguments for a server run on this PC */
  url?: string
  command?: string[]
}

export const CATALOG: CatalogServer[] = [
  { id: 'vercel', name: 'Vercel', transport: 'http', auth: 'oauth', url: 'https://mcp.vercel.com' },
  { id: 'context7', name: 'Context7', transport: 'http', auth: 'none', url: 'https://mcp.context7.com/mcp' },
  { id: 'supabase', name: 'Supabase', transport: 'http', auth: 'oauth', url: 'https://mcp.supabase.com/mcp' },
  { id: 'sentry', name: 'Sentry', transport: 'http', auth: 'oauth', url: 'https://mcp.sentry.dev/mcp' },
  { id: 'linear', name: 'Linear', transport: 'http', auth: 'oauth', url: 'https://mcp.linear.app/mcp' },
  { id: 'notion', name: 'Notion', transport: 'http', auth: 'oauth', url: 'https://mcp.notion.com/mcp' },
  { id: 'playwright', name: 'Playwright', transport: 'stdio', auth: 'local', command: ['npx', '-y', '@playwright/mcp@0.0.86'] }
]

export const catalogEntry = (id: string): CatalogServer | undefined => CATALOG.find(c => c.id === id)

/**
 * DevForge's own description, published on its site (a Client ID Metadata Document): a server that
 * accepts it needs no registration, and the sign-in comes back to this PC only.
 */
export const CLIENT_METADATA_URL = 'https://victhille.github.io/devforge/oauth/mcp-client.json'
