// ─── Webhook tester ──────────────────────────────────────────────────────────

export interface CapturedRequest {
  id: string
  at: string
  method: string
  /** Path with query string */
  url: string
  headers: Record<string, string>
  body: string
  /** true when the body was cut at 1 MB */
  truncated: boolean
}

export interface WebhookResponse {
  status: number
  contentType: string
  body: string
}

export interface WebhookStatus {
  port: number | null
  error?: string
  response: WebhookResponse
}

export interface WebhooksAPI {
  start:  (port: number) => Promise<WebhookStatus>
  stop:   () => Promise<WebhookStatus>
  status: () => Promise<WebhookStatus>
  list:   () => Promise<CapturedRequest[]>
  clear:  () => Promise<void>
  setResponse: (r: WebhookResponse) => Promise<void>
  /** Send a captured request again to another URL */
  replay: (id: string, targetUrl: string) => Promise<{ status: number | null; body: string; error?: string }>
  onRequest: (cb: (r: CapturedRequest) => void) => () => void
}
