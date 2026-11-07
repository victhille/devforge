// ─── Cross-feature suggestions ───────────────────────────────────────────────

export interface LogFileSuggestion {
  projectName: string
  path: string
  size: number
  modifiedAt: string
}

export interface UrlSuggestion {
  name: string
  url: string
  /** e.g. "shop/.env APP_URL" or "local domain" */
  source: string
}

export interface DomainSuggestion {
  projectName: string
  domain: string
  port: number
  /** Where the port comes from: ".env PORT", "Vite default"… */
  source: string
  /** Something listens on this port right now */
  running: boolean
}

export interface SuggestAPI {
  logFiles:   () => Promise<LogFileSuggestion[]>
  monitorUrls: () => Promise<UrlSuggestion[]>
  domains:    () => Promise<DomainSuggestion[]>
}
