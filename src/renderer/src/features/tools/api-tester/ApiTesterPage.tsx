import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Send, Plus, Trash2, ShieldCheck } from 'lucide-react'
import { useI18n } from '@renderer/i18n/I18nContext'
import { cn } from '@renderer/lib/cn'
import { formatSize } from '@renderer/lib/format'
import { usePersistentState } from '@renderer/hooks/usePersistentState'
import Badge from '@renderer/components/ui/Badge'
import Button from '@renderer/components/ui/Button'
import Card from '@renderer/components/ui/Card'
import CopyButton from '@renderer/components/ui/CopyButton'
import IconButton from '@renderer/components/ui/IconButton'
import Tabs from '@renderer/components/ui/Tabs'
import { Input, Select, Textarea } from '@renderer/components/ui/Input'
import { useAssistantPageContext } from '@renderer/features/assistant/AssistantContext'
import Notice from '@renderer/components/ui/Notice'
import { headersToSend, pathOf, queryRows, withQuery, type Auth, type Row } from './request'

type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
type ReqTab = 'params' | 'headers' | 'body' | 'auth'
type ResTab = 'json' | 'raw' | 'headers' | 'preview'

interface ApiResponse {
  status:     number
  statusText: string
  time:       number
  size:       number
  /** As received */
  raw:        string
  /** Indented, when it is JSON */
  json:       string | null
  headers:    Record<string, string>
  /** HTML document: shown rendered in the preview tab */
  html:       boolean
}
/** A request sent, kept between sessions: its method and URL only (never headers nor body) */
interface Sent { method: Method; url: string; status: number }

const METHODS: Method[] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']
const HISTORY_MAX = 30

const METHOD_COLOR: Record<Method, string> = {
  GET:    'text-success',
  POST:   'text-accent',
  PUT:    'text-warning',
  PATCH:  'text-info',
  DELETE: 'text-danger'
}
/** « DEL » in the history, as in the mock-up */
const shortMethod = (m: Method) => (m === 'DELETE' ? 'DEL' : m === 'PATCH' ? 'PATCH' : m)

const statusColor = (s: number): 'success' | 'warning' | 'danger' => (s < 300 ? 'success' : s < 400 ? 'warning' : 'danger')

function asJson(text: string): string | null {
  try { return JSON.stringify(JSON.parse(text), null, 2) } catch { return null }
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

/** Key / value rows with a tick to send them or not (params and headers) */
function RowsEditor({ rows, onChange, addLabel, keyLabel, valueLabel, removeLabel, sendLabel }: {
  rows: Row[]; onChange: (rows: Row[]) => void; addLabel: string; keyLabel: string; valueLabel: string; removeLabel: string; sendLabel: string
}) {
  const set = (i: number, patch: Partial<Row>) => onChange(rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)))
  return (
    <div className="flex flex-col">
      {rows.map((r, i) => (
        <div key={i} className="flex items-center gap-3 border-b border-line-subtle py-2">
          <input type="checkbox" checked={r.on} onChange={e => set(i, { on: e.target.checked })} aria-label={sendLabel.replace('{name}', r.key || keyLabel)}
            className="size-4 shrink-0 accent-accent" />
          <Input value={r.key} onChange={e => set(i, { key: e.target.value })} placeholder={keyLabel} aria-label={keyLabel}
            className="h-8 flex-1 border-transparent bg-transparent px-1 font-mono text-sm font-semibold focus:border-line" />
          <Input value={r.value} onChange={e => set(i, { value: e.target.value })} placeholder={valueLabel} aria-label={valueLabel}
            className="h-8 flex-1 border-transparent bg-transparent px-1 text-right font-mono text-sm text-fg-secondary focus:border-line focus:text-left" />
          <IconButton size="sm" tone="danger" title={removeLabel} onClick={() => onChange(rows.filter((_, idx) => idx !== i))}><Trash2 size={13} /></IconButton>
        </div>
      ))}
      <Button variant="ghost" size="sm" className="mt-2 self-start" onClick={() => onChange([...rows, { key: '', value: '', on: true }])}>
        <Plus size={13} aria-hidden /> {addLabel}
      </Button>
    </div>
  )
}

/**
 * As in the mock-up: the requests sent on the left, the URL bar, the request
 * (params, headers, body, auth) then the response (JSON, raw, headers, preview).
 */
export default function ApiTesterPage() {
  const { t, lang } = useI18n()
  const a = t.apiTester
  // ?method=GET&url=…: a request prepared elsewhere (Symfony workshop, routes)
  const [params] = useSearchParams()
  const asked = (params.get('method') ?? '').toUpperCase() as Method
  const [method,   setMethod]   = useState<Method>(METHODS.includes(asked) ? asked : 'GET')
  const [url,      setUrl]      = useState(params.get('url') ?? '')
  const [headers,  setHeaders]  = useState<Row[]>([{ key: 'Content-Type', value: 'application/json', on: true }])
  const [body,     setBody]     = useState('')
  const [auth,     setAuth]     = useState<Auth>({ kind: 'none', token: '', user: '', password: '' })
  const [reqTab,   setReqTab]   = useState<ReqTab>('params')
  const [response, setResponse] = useState<ApiResponse | null>(null)
  const [resTab,   setResTab]   = useState<ResTab>('json')
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState('')
  const [history,  setHistory]  = usePersistentState<Sent[]>('devforge:api-history', [])

  useEffect(() => {
    const u = params.get('url')
    if (u) { setUrl(u); setResponse(null); setError('') }
    const m = (params.get('method') ?? '').toUpperCase() as Method
    if (METHODS.includes(m)) setMethod(m)
  }, [params])

  // The params as rows: read from the URL typed, written back into it (a row empty or unticked stays here)
  const [paramRows, setParamRows] = useState<Row[]>(() => queryRows(url))
  const lastUrl = useRef(url)
  useEffect(() => { if (url !== lastUrl.current) { lastUrl.current = url; setParamRows(queryRows(url)) } }, [url])
  const editParams = (rows: Row[]) => {
    setParamRows(rows)
    const next = withQuery(url, rows.filter(r => r.on))
    lastUrl.current = next
    setUrl(next)
  }
  const sentHeaders = useMemo(() => headersToSend(headers, auth), [headers, auth])

  useAssistantPageContext(url ? {
    label: `API Tester — ${method} ${url}`,
    content: [
      `Request: ${method} ${url}`,
      `Request headers: ${JSON.stringify(redact(sentHeaders))}`,
      method !== 'GET' && body ? `Request body:\n${body.slice(0, 4000)}` : '',
      response
        ? `Response: ${response.status} ${response.statusText} in ${response.time} ms, ${response.size} bytes\nResponse headers: ${JSON.stringify(redact(response.headers))}\nResponse body:\n${response.raw.slice(0, 12000)}`
        : error ? `Error: ${error}` : 'No response yet'
    ].filter(Boolean).join('\n')
  } : null)

  async function send() {
    if (!url) return
    setLoading(true)
    setError('')
    setResponse(null)
    try {
      const res = await window.devforge.http.request({
        method,
        url,
        headers: sentHeaders,
        body: method === 'GET' ? undefined : body || undefined
      })
      setHistory(h => [{ method, url, status: res.status ?? 0 }, ...h.filter(x => x.method !== method || x.url !== url)].slice(0, HISTORY_MAX))
      if (res.error) { setError(res.error); return }
      const resHeaders = res.headers ?? {}
      const raw = res.body ?? ''
      const html = isHtml(resHeaders, raw)
      const json = html ? null : asJson(raw)
      setResponse({ status: res.status ?? 0, statusText: res.statusText ?? '', time: res.time ?? 0, size: res.size ?? 0, raw, json, headers: resHeaders, html })
      setResTab(html ? 'preview' : json !== null ? 'json' : 'raw')
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : a.error)
    } finally {
      setLoading(false)
    }
  }

  function reset() {
    setMethod('GET'); setUrl(''); setBody(''); setResponse(null); setError('')
  }

  const resTabs = response ? [
    ...(response.json !== null ? [{ value: 'json' as ResTab, label: 'JSON' }] : []),
    { value: 'raw' as ResTab, label: a.tabRaw },
    { value: 'headers' as ResTab, label: a.tabHeaders },
    ...(response.html ? [{ value: 'preview' as ResTab, label: a.tabPreview }] : [])
  ] : []
  const count = (n: number) => (n ? <span className="ml-1.5 rounded-md bg-active px-1.5 font-mono text-2xs text-fg-secondary">{n}</span> : null)

  return (
    <div className="flex h-full">
      {/* The requests sent, kept from one session to the next */}
      <aside aria-label={a.history} className="hidden w-[272px] shrink-0 flex-col border-r border-line-subtle bg-surface lg:flex">
        <div className="flex h-14 shrink-0 items-center justify-between px-4">
          <h2 className="font-display text-md font-bold tracking-[-.01em] text-fg">{a.history}</h2>
          <IconButton title={a.newRequest} onClick={reset}><Plus size={15} /></IconButton>
        </div>
        <div className="flex-1 overflow-y-auto px-3 pb-3">
          {history.length === 0 ? <p className="px-2 py-3 text-sm text-fg-muted">{a.historyEmpty}</p> : (
            <ul className="flex flex-col gap-1">
              {history.map((h, i) => {
                const current = h.method === method && h.url === url
                return (
                  <li key={`${h.method} ${h.url} ${i}`}>
                    <button onClick={() => { setMethod(h.method); setUrl(h.url); setResponse(null); setError('') }} title={h.url}
                      aria-current={current ? 'true' : undefined}
                      className={cn('flex h-10 w-full items-center gap-3 rounded-control px-2.5 text-left font-mono transition-colors', current ? 'bg-accent-soft' : 'hover:bg-hover')}>
                      <span className={cn('w-11 shrink-0 text-xs font-bold', METHOD_COLOR[h.method])}>{shortMethod(h.method)}</span>
                      <span className={cn('min-w-0 flex-1 truncate text-sm', current ? 'text-fg' : 'text-fg-secondary')}>{pathOf(h.url)}</span>
                      {(h.status >= 400 || h.status === 0) && <span className="text-xs text-danger">{h.status || '—'}</span>}
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
        {history.length > 0 && (
          <button onClick={() => setHistory([])} className="shrink-0 px-5 pb-5 text-left text-xs text-fg-muted hover:text-danger">{a.clearHistory}</button>
        )}
      </aside>

      <div className="df-mockup flex min-w-0 flex-1 flex-col gap-4 overflow-y-auto px-8 pt-6.5 pb-24">
        <header>
          <p className="mb-1 text-sm text-fg-muted">{t.nav.groupData}</p>
          <h1 className="font-display text-page font-bold tracking-[-.025em] text-fg">{a.title}</h1>
        </header>

        {/* Method and URL in one field, then Send */}
        <div className="flex flex-wrap gap-2.5">
          <div className="flex h-11.5 min-w-[300px] flex-1 items-center overflow-hidden rounded-card border border-line bg-surface focus-within:border-accent/60">
            <label className="flex h-full items-center border-r border-line">
              <span className="sr-only">{a.method}</span>
              <select value={method} onChange={e => setMethod(e.target.value as Method)}
                className={cn('h-full cursor-pointer bg-transparent px-4 font-mono text-base font-bold outline-none', METHOD_COLOR[method])}>
                {METHODS.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </label>
            <label className="flex h-full min-w-0 flex-1">
              <span className="sr-only">URL</span>
              <input value={url} onChange={e => setUrl(e.target.value)} onKeyDown={e => e.key === 'Enter' && send()}
                placeholder={a.urlPlaceholder} spellCheck={false}
                className="min-w-0 flex-1 bg-transparent px-4 font-mono text-base text-fg outline-none placeholder:text-fg-muted" />
            </label>
          </div>
          <Button onClick={send} loading={loading} disabled={!url} className="h-11.5 px-5">
            {!loading && <Send size={14} aria-hidden />} {loading ? a.sending : a.send}
          </Button>
        </div>

        {/* The request */}
        <Card className="flex flex-col gap-3 px-4.5 pt-2 pb-4">
          <Tabs<ReqTab> variant="underline" value={reqTab} onChange={setReqTab} label={a.request} items={[
            { value: 'params', label: <>{a.tabParams}{count(paramRows.filter(r => r.on && r.key).length)}</> },
            { value: 'headers', label: <>{a.tabHeaders}{count(Object.keys(sentHeaders).length)}</> },
            { value: 'body', label: a.tabBody },
            { value: 'auth', label: a.tabAuth }
          ]} />
          {reqTab === 'params' ? (
            <RowsEditor rows={paramRows} onChange={editParams} addLabel={a.addParam} keyLabel={a.key} valueLabel={a.value} removeLabel={a.remove} sendLabel={a.sendRow} />
          ) : reqTab === 'headers' ? (
            <RowsEditor rows={headers} onChange={setHeaders} addLabel={a.addHeader} keyLabel={a.key} valueLabel={a.value} removeLabel={a.remove} sendLabel={a.sendRow} />
          ) : reqTab === 'body' ? (
            <>
              {method === 'GET' && <p className="text-sm text-fg-muted">{a.bodyGet}</p>}
              <Textarea value={body} onChange={e => setBody(e.target.value)} placeholder={a.bodyPlaceholder} spellCheck={false} rows={8}
                aria-label={a.tabBody} className="font-mono text-sm" />
            </>
          ) : (
            <div className="flex flex-col gap-3">
              <label className="flex items-center gap-3 text-sm text-fg-secondary">{a.authKind}
                <Select value={auth.kind} onChange={e => setAuth(x => ({ ...x, kind: e.target.value as Auth['kind'] }))} className="w-48">
                  <option value="none">{a.authNone}</option>
                  <option value="bearer">Bearer</option>
                  <option value="basic">Basic</option>
                </Select>
              </label>
              {auth.kind === 'bearer' && (
                <Input type="password" value={auth.token} onChange={e => setAuth(x => ({ ...x, token: e.target.value }))} placeholder={a.token} aria-label={a.token} className="font-mono" autoComplete="off" />
              )}
              {auth.kind === 'basic' && (
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <Input value={auth.user} onChange={e => setAuth(x => ({ ...x, user: e.target.value }))} placeholder={a.user} aria-label={a.user} autoComplete="off" />
                  <Input type="password" value={auth.password} onChange={e => setAuth(x => ({ ...x, password: e.target.value }))} placeholder={a.password} aria-label={a.password} autoComplete="off" />
                </div>
              )}
              <p className="text-xs text-fg-muted">{a.authHint}</p>
            </div>
          )}
        </Card>

        {/* The response */}
        <Card className="flex min-h-[260px] flex-col gap-3 p-4.5">
          {error ? (
            <Notice tone="danger" role="alert" className="font-mono text-sm">{error}</Notice>
          ) : !response ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 text-sm text-fg-muted">
              <span className="flex size-11 items-center justify-center rounded-xl bg-active text-fg-secondary"><Send size={18} aria-hidden /></span>
              {loading ? a.sending : a.noResponse}
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-3">
                <span key={response.time} className="df-pop"><Badge mono color={statusColor(response.status)}>{response.status} {response.statusText}</Badge></span>
                <span className="font-mono text-xs text-fg-secondary">
                  {response.time} ms · {formatSize(response.size, lang)}{response.headers['content-type'] ? ` · ${response.headers['content-type'].split(';')[0]}` : ''}
                </span>
                <span className="ml-auto flex items-center gap-2">
                  <Tabs<ResTab> value={resTab} onChange={setResTab} items={resTabs} label={a.responseView} />
                  <CopyButton text={response.raw} title={a.copyBody} />
                </span>
              </div>
              {resTab === 'preview' ? (
                <div className="flex min-h-0 flex-1 flex-col gap-2">
                  <span className="flex items-center gap-1.5 font-mono text-xs text-fg-muted"><ShieldCheck size={13} aria-hidden /> {a.previewNote}</span>
                  <iframe title={a.tabPreview} src={previewUrl(response.raw, url)} sandbox="" referrerPolicy="no-referrer" className="min-h-[380px] flex-1 rounded-control bg-white" />
                </div>
              ) : resTab === 'headers' ? (
                <div className="overflow-hidden rounded-control border border-line-subtle font-mono text-sm">
                  {Object.entries(response.headers).map(([k, v]) => (
                    <div key={k} className="flex gap-3 border-b border-line-subtle px-3 py-2 last:border-0">
                      <span className="w-56 shrink-0 text-fg-muted">{k}</span>
                      <span className="break-all text-fg-secondary">{v}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <pre tabIndex={0} className="max-h-[520px] overflow-auto rounded-control bg-console px-4 py-3.5 font-mono text-sm leading-relaxed whitespace-pre-wrap break-all text-fg">
                  {resTab === 'json' && response.json !== null ? response.json : response.raw}
                </pre>
              )}
            </>
          )}
        </Card>
      </div>
    </div>
  )
}
