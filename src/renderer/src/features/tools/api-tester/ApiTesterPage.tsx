import { useState, type CSSProperties } from 'react'
import { Send, Plus, Trash2, ShieldCheck } from 'lucide-react'
import { useI18n } from '@renderer/i18n/I18nContext'
import { cn } from '@renderer/lib/cn'
import { formatSize } from '@renderer/lib/format'
import Button from '@renderer/components/ui/Button'
import Card from '@renderer/components/ui/Card'
import CopyButton from '@renderer/components/ui/CopyButton'
import IconButton from '@renderer/components/ui/IconButton'
import { Input, Textarea } from '@renderer/components/ui/Input'
import { Page } from '@renderer/components/ui/Page'
import { useAssistantPageContext } from '@renderer/features/assistant/AssistantContext'

type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
type ReqTab = 'headers' | 'body'
type ResTab = 'preview' | 'body' | 'headers'

interface Header { key: string; value: string }
interface ApiResponse {
  status:     number
  statusText: string
  time:       number
  size:       number
  body:       string
  headers:    Record<string, string>
  /** HTML document: shown rendered in the preview tab */
  html:       boolean
}

const METHODS: Method[] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']

const METHOD_COLOR: Record<Method, string> = {
  GET:    'text-success',
  POST:   'text-accent',
  PUT:    'text-warning',
  PATCH:  'text-violet-400',
  DELETE: 'text-danger'
}

function statusTone(s: number): string {
  if (s < 300) return 'text-success bg-success-soft border-success/25'
  if (s < 400) return 'text-warning bg-warning-soft border-warning/25'
  return 'text-danger bg-danger-soft border-danger/25'
}

function prettify(text: string): string {
  try { return JSON.stringify(JSON.parse(text), null, 2) } catch { return text }
}

/** Header values that look like credentials are not sent to the assistant */
const redact = (h: Record<string, string>) =>
  Object.fromEntries(Object.entries(h).map(([k, v]) => [k, /auth|cookie|token|secret|api[-_]?key|password/i.test(k) ? '***' : v]))

function isHtml(headers: Record<string, string>, body: string): boolean {
  return /text\/html|application\/xhtml/i.test(headers['content-type'] ?? '') || /^\s*(<!doctype html|<html[\s>])/i.test(body)
}

/**
 * Rendered in a sandboxed frame without scripts. A data: URL rather than
 * srcdoc: it does not inherit the app's strict CSP, so the page's own images
 * and styles load like in a browser. <base> resolves its relative links.
 */
function previewUrl(html: string, pageUrl: string): string {
  const base = `<base href="${pageUrl.replace(/"/g, '&quot;')}">`
  const doc = /<head[^>]*>/i.test(html) ? html.replace(/<head[^>]*>/i, m => m + base) : base + html
  return 'data:text/html;charset=utf-8,' + encodeURIComponent(doc)
}

export default function ApiTesterPage() {
  const { t } = useI18n()
  const [method,   setMethod]   = useState<Method>('GET')
  const [url,      setUrl]      = useState('')
  const [headers,  setHeaders]  = useState<Header[]>([{ key: 'Content-Type', value: 'application/json' }])
  const [body,     setBody]     = useState('')
  const [reqTab,   setReqTab]   = useState<ReqTab>('headers')
  const [response, setResponse] = useState<ApiResponse | null>(null)
  const [resTab,   setResTab]   = useState<ResTab>('body')
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState('')
  const [history,  setHistory]  = useState<{ method: Method; url: string; status: number }[]>([])

  useAssistantPageContext(url ? {
    label: `API Tester — ${method} ${url}`,
    content: [
      `Request: ${method} ${url}`,
      `Request headers: ${JSON.stringify(redact(Object.fromEntries(headers.filter(h => h.key).map(h => [h.key, h.value]))))}`,
      method !== 'GET' && body ? `Request body:\n${body.slice(0, 4000)}` : '',
      response
        ? `Response: ${response.status} ${response.statusText} in ${response.time} ms, ${response.size} bytes\nResponse headers: ${JSON.stringify(redact(response.headers))}\nResponse body:\n${response.body.slice(0, 12000)}`
        : error ? `Error: ${error}` : 'No response yet'
    ].filter(Boolean).join('\n')
  } : null)

  const updateHeader = (i: number, patch: Partial<Header>) =>
    setHeaders(h => h.map((hdr, idx) => (idx === i ? { ...hdr, ...patch } : hdr)))

  async function send() {
    if (!url) return
    setLoading(true)
    setError('')
    setResponse(null)
    try {
      const res = await window.devforge.http.request({
        method,
        url,
        headers: Object.fromEntries(headers.filter(h => h.key).map(h => [h.key, h.value])),
        body: method === 'GET' ? undefined : body || undefined
      })
      setHistory(h => [{ method, url, status: res.status ?? 0 }, ...h.filter(x => x.method !== method || x.url !== url)].slice(0, 5))
      if (res.error) { setError(res.error); return }
      const resHeaders = res.headers ?? {}
      const html = isHtml(resHeaders, res.body ?? '')
      setResponse({
        status:     res.status ?? 0,
        statusText: res.statusText ?? '',
        time:       res.time ?? 0,
        size:       res.size ?? 0,
        body:       html ? res.body ?? '' : prettify(res.body ?? ''),
        headers:    resHeaders,
        html
      })
      setResTab(html ? 'preview' : 'body')
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t.apiTester.error)
    } finally {
      setLoading(false)
    }
  }

  const tabClass = (on: boolean) => cn('h-[38px] border-b-2 px-2.5 text-[12.5px] font-medium transition-colors',
    on ? 'border-accent text-fg' : 'border-transparent text-fg-secondary hover:text-fg')
  const contentType = response?.headers['content-type']?.split(';')[0]

  return (
    <Page className="h-full max-w-none gap-4 px-7 pt-6">
      <h1 className="df-rise text-[26px] leading-tight font-semibold tracking-[-.02em] text-fg">{t.apiTester.title}</h1>

      {/* Request bar: method and URL in one field */}
      <div className="df-rise flex shrink-0 flex-wrap gap-2" style={{ '--i': 1 } as CSSProperties}>
        <div className="flex h-[42px] min-w-[300px] flex-1 items-center overflow-hidden rounded-[11px] border border-line bg-canvas focus-within:border-accent/60">
          <label className="flex h-full items-center border-r border-line">
            <span className="sr-only">Method</span>
            <select value={method} onChange={e => setMethod(e.target.value as Method)}
              className={cn('h-full cursor-pointer bg-transparent px-3 font-mono text-base font-semibold outline-none', METHOD_COLOR[method])}>
              {METHODS.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </label>
          <label className="flex h-full min-w-0 flex-1">
            <span className="sr-only">URL</span>
            <input value={url} onChange={e => setUrl(e.target.value)} onKeyDown={e => e.key === 'Enter' && send()}
              placeholder={t.apiTester.urlPlaceholder}
              className="min-w-0 flex-1 bg-transparent px-3 font-mono text-base text-fg outline-none placeholder:text-fg-muted" />
          </label>
        </div>
        <Button onClick={send} loading={loading} disabled={!url} className="h-[42px] rounded-[11px] px-5">
          {!loading && <Send size={14} />}
          {loading ? t.apiTester.sending : t.apiTester.send}
        </Button>
      </div>

      <div className="flex min-h-0 flex-1 flex-wrap items-stretch gap-4">
        {/* Request config */}
        <Card className="df-rise flex min-h-0 max-w-[380px] flex-[1_1_300px] flex-col rounded-[14px]" style={{ '--i': 2 } as CSSProperties}>
          <div className="flex gap-1 border-b border-line-subtle px-2.5" role="tablist">
            <button role="tab" aria-selected={reqTab === 'headers'} className={tabClass(reqTab === 'headers')} onClick={() => setReqTab('headers')}>
              {t.apiTester.tabHeaders} · {headers.filter(h => h.key).length}
            </button>
            <button role="tab" aria-selected={reqTab === 'body'} className={tabClass(reqTab === 'body')} onClick={() => setReqTab('body')}>{t.apiTester.tabBody}</button>
          </div>

          {reqTab === 'headers' ? (
            <div className="flex flex-col gap-2 overflow-y-auto p-3.5">
              {headers.map((h, i) => (
                <div key={i} className="flex gap-2">
                  <Input value={h.key}   onChange={e => updateHeader(i, { key: e.target.value })}   placeholder={t.apiTester.key}   className="h-8 bg-canvas font-mono text-sm" />
                  <Input value={h.value} onChange={e => updateHeader(i, { value: e.target.value })} placeholder={t.apiTester.value} className="h-8 bg-canvas font-mono text-sm" />
                  <IconButton tone="danger" title="Remove" onClick={() => setHeaders(hs => hs.filter((_, idx) => idx !== i))}>
                    <Trash2 size={13} />
                  </IconButton>
                </div>
              ))}
              <Button variant="ghost" size="sm" className="self-start" onClick={() => setHeaders(h => [...h, { key: '', value: '' }])}>
                <Plus size={13} /> {t.apiTester.addHeader}
              </Button>
            </div>
          ) : (
            <Textarea
              value={body}
              onChange={e => setBody(e.target.value)}
              placeholder={t.apiTester.bodyPlaceholder}
              spellCheck={false}
              className="flex-1 resize-none rounded-none border-0 bg-transparent p-3.5"
            />
          )}

          {/* Requests sent in this session */}
          {history.length > 0 && (
            <div className="mt-auto flex flex-col gap-1.5 border-t border-line-subtle px-3.5 py-3">
              <span className="font-mono text-2xs font-medium tracking-widest text-fg-muted uppercase">{t.apiTester.history}</span>
              {history.map((h, i) => (
                <button key={i} onClick={() => { setMethod(h.method); setUrl(h.url) }} className="flex gap-2 text-left font-mono text-xs text-fg-secondary hover:text-fg">
                  <span className={METHOD_COLOR[h.method]}>{h.method}</span>
                  <span className="min-w-0 flex-1 truncate">{h.url.replace(/^https?:\/\/[^/]+/, '') || '/'}</span>
                  <span className={h.status >= 400 || h.status === 0 ? 'text-danger' : ''}>{h.status || '—'}</span>
                </button>
              ))}
            </div>
          )}
        </Card>

        {/* Response */}
        <Card className="df-rise flex min-h-[420px] min-w-0 flex-[999_1_420px] flex-col overflow-hidden rounded-[14px]" style={{ '--i': 3 } as CSSProperties}>
          {error ? (
            <div className="m-3.5 rounded-lg bg-danger-soft p-3 font-mono text-sm text-danger">{error}</div>
          ) : !response ? (
            <div className="flex flex-1 items-center justify-center text-fg-muted">{t.apiTester.noResponse}</div>
          ) : (
            <>
              <div className="flex min-h-[46px] flex-wrap items-center gap-3 border-b border-line-subtle px-3.5">
                <span key={response.time} className={cn('df-pop rounded-full border px-2.5 py-0.5 font-mono text-xs font-semibold', statusTone(response.status))}>
                  {response.status} {response.statusText}
                </span>
                <span className="font-mono text-xs text-fg-secondary">
                  {response.time} ms · {formatSize(response.size)}{contentType ? ` · ${contentType}` : ''}
                </span>
                <div role="tablist" className="ml-auto flex rounded-[9px] border border-line bg-canvas p-[3px]">
                  {([
                    ...(response.html ? [['preview', t.apiTester.tabPreview]] : []),
                    ['body', t.apiTester.tabRaw],
                    ['headers', t.apiTester.tabHeaders]
                  ] as [ResTab, string][]).map(([value, label]) => (
                    <button key={value} role="tab" aria-selected={resTab === value} onClick={() => setResTab(value)}
                      className={cn('h-7 rounded-[7px] px-3 text-xs font-medium transition-colors', resTab === value ? 'bg-elevated text-fg' : 'text-fg-secondary hover:text-fg')}>
                      {label}
                    </button>
                  ))}
                </div>
                <CopyButton text={response.body} />
              </div>
              {resTab === 'preview' ? (
                <div className="flex min-h-0 flex-1 flex-col gap-2 p-3.5">
                  <span className="flex items-center gap-1.5 font-mono text-[11.5px] text-fg-muted"><ShieldCheck size={13} /> {t.apiTester.previewNote}</span>
                  <iframe
                    title={t.apiTester.tabPreview}
                    src={previewUrl(response.body, url)}
                    sandbox=""
                    referrerPolicy="no-referrer"
                    className="min-h-[380px] flex-1 rounded-[10px] bg-white"
                  />
                </div>
              ) : resTab === 'headers' ? (
                <div className="flex-1 overflow-auto px-4 py-3 font-mono text-sm">
                  {Object.entries(response.headers).map(([k, v]) => (
                    <div key={k} className="flex gap-3 border-b border-line-subtle py-1.5">
                      <span className="w-56 shrink-0 text-fg-muted">{k}</span>
                      <span className="break-all text-fg-secondary">{v}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <pre className="flex-1 overflow-auto px-4 py-3 font-mono text-sm leading-relaxed whitespace-pre-wrap break-all text-fg">
                  {response.body}
                </pre>
              )}
            </>
          )}
        </Card>
      </div>
    </Page>
  )
}
