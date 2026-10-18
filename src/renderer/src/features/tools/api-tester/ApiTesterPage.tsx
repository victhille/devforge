import { useState } from 'react'
import { Send, Plus, Trash2, Eye, FileCode2, List } from 'lucide-react'
import { useI18n } from '@renderer/i18n/I18nContext'
import { cn } from '@renderer/lib/cn'
import { formatSize } from '@renderer/lib/format'
import Button from '@renderer/components/ui/Button'
import Card from '@renderer/components/ui/Card'
import CopyButton from '@renderer/components/ui/CopyButton'
import IconButton from '@renderer/components/ui/IconButton'
import Tabs from '@renderer/components/ui/Tabs'
import { Input, Select, Textarea } from '@renderer/components/ui/Input'
import { Page, PageHeader } from '@renderer/components/ui/Page'
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

  return (
    <Page className="h-full max-w-none gap-4">
      <PageHeader title={t.apiTester.title} subtitle={t.apiTester.subtitle} />

      {/* Request bar */}
      <div className="flex shrink-0 gap-2">
        <Select
          value={method}
          onChange={e => setMethod(e.target.value as Method)}
          className={cn('w-28 font-mono font-bold', METHOD_COLOR[method])}
        >
          {METHODS.map(m => <option key={m} value={m}>{m}</option>)}
        </Select>
        <Input
          value={url}
          onChange={e => setUrl(e.target.value)}
          placeholder={t.apiTester.urlPlaceholder}
          onKeyDown={e => e.key === 'Enter' && send()}
          className="font-mono"
        />
        <Button onClick={send} loading={loading} disabled={!url}>
          {!loading && <Send size={14} />}
          {loading ? t.apiTester.sending : t.apiTester.send}
        </Button>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-2 gap-4">
        {/* Request config */}
        <Card className="flex min-h-0 flex-col">
          <div className="border-b border-line-subtle p-2">
            <Tabs<ReqTab>
              value={reqTab}
              onChange={setReqTab}
              items={[
                { value: 'headers', label: t.apiTester.tabHeaders },
                { value: 'body',    label: t.apiTester.tabBody }
              ]}
            />
          </div>

          {reqTab === 'headers' ? (
            <div className="flex flex-col gap-2 overflow-y-auto p-3">
              {headers.map((h, i) => (
                <div key={i} className="flex gap-2">
                  <Input value={h.key}   onChange={e => updateHeader(i, { key: e.target.value })}   placeholder={t.apiTester.key}   className="h-8 font-mono text-sm" />
                  <Input value={h.value} onChange={e => updateHeader(i, { value: e.target.value })} placeholder={t.apiTester.value} className="h-8 font-mono text-sm" />
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
              className="flex-1 resize-none rounded-none rounded-b-xl border-0 bg-transparent p-3"
            />
          )}
        </Card>

        {/* Response */}
        <Card className="flex min-h-0 flex-col">
          {error ? (
            <div className="m-3 rounded-lg bg-danger-soft p-3 font-mono text-sm text-danger">{error}</div>
          ) : !response ? (
            <div className="flex flex-1 items-center justify-center text-fg-muted">{t.apiTester.noResponse}</div>
          ) : (
            <>
              <div className="flex items-center gap-4 border-b border-line-subtle px-3 py-2 text-sm text-fg-muted">
                <span className={cn('rounded border px-2 py-0.5 font-mono font-semibold', statusTone(response.status))}>
                  {response.status} {response.statusText}
                </span>
                <span>{t.apiTester.time}: <strong className="text-fg-secondary">{response.time}ms</strong></span>
                <span>{t.apiTester.size}: <strong className="text-fg-secondary">{formatSize(response.size)}</strong></span>
                <CopyButton text={response.body} className="ml-auto" />
              </div>
              <div className="flex items-center gap-3 border-b border-line-subtle px-3 py-2">
                <Tabs<ResTab>
                  value={resTab}
                  onChange={setResTab}
                  items={[
                    ...(response.html ? [{ value: 'preview' as ResTab, label: t.apiTester.tabPreview, icon: <Eye size={13} /> }] : []),
                    { value: 'body',    label: t.apiTester.tabBody, icon: <FileCode2 size={13} /> },
                    { value: 'headers', label: `${t.apiTester.tabHeaders} (${Object.keys(response.headers).length})`, icon: <List size={13} /> }
                  ]}
                />
                {resTab === 'preview' && <span className="text-xs text-fg-muted">{t.apiTester.previewNote}</span>}
              </div>
              {resTab === 'preview' ? (
                <iframe
                  title={t.apiTester.tabPreview}
                  src={previewUrl(response.body, url)}
                  sandbox=""
                  referrerPolicy="no-referrer"
                  className="min-h-0 flex-1 rounded-b-xl bg-white"
                />
              ) : resTab === 'headers' ? (
                <div className="flex-1 overflow-auto p-3 font-mono text-sm">
                  {Object.entries(response.headers).map(([k, v]) => (
                    <div key={k} className="flex gap-3 border-b border-line-subtle py-1.5">
                      <span className="w-56 shrink-0 text-accent">{k}</span>
                      <span className="break-all text-fg-secondary">{v}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <pre className="flex-1 overflow-auto p-3 font-mono text-sm leading-relaxed whitespace-pre-wrap break-all text-fg">
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
