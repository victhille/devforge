import { useCallback, useEffect, useMemo, useState } from 'react'
import { Eraser, Power, Repeat, Send, Webhook } from 'lucide-react'
import type { CapturedRequest, WebhookStatus } from '@shared/types'
import { useI18n } from '@renderer/i18n/I18nContext'
import { useToast } from '@renderer/app/ToastContext'
import { cn } from '@renderer/lib/cn'
import Badge from '@renderer/components/ui/Badge'
import Button from '@renderer/components/ui/Button'
import CopyButton from '@renderer/components/ui/CopyButton'
import EmptyState from '@renderer/components/ui/EmptyState'
import Modal from '@renderer/components/ui/Modal'
import { Field, Input, Textarea } from '@renderer/components/ui/Input'
import { SectionTitle } from '@renderer/components/ui/Page'

const METHOD_COLOR: Record<string, string> = {
  GET: 'text-success', POST: 'text-accent', PUT: 'text-warning', PATCH: 'text-violet-400', DELETE: 'text-danger'
}

function pretty(body: string): string {
  try { return JSON.stringify(JSON.parse(body), null, 2) } catch { return body }
}

/** One-line curl reproducing the request against the local server */
function toCurl(r: CapturedRequest, port: number): string {
  const skip = new Set(['host', 'content-length', 'connection'])
  const headers = Object.entries(r.headers).filter(([k]) => !skip.has(k)).map(([k, v]) => `-H '${k}: ${v.replace(/'/g, "'\\''")}'`)
  const body = r.body ? ` --data-raw '${r.body.replace(/'/g, "'\\''")}'` : ''
  return `curl -X ${r.method} 'http://localhost:${port}${r.url}' ${headers.join(' ')}${body}`
}

export default function WebhooksPage() {
  const { t, lang } = useI18n()
  const w = t.webhooks
  const toast = useToast()
  const [status, setStatus] = useState<WebhookStatus | null>(null)
  const [port, setPort] = useState('9999')
  const [requests, setRequests] = useState<CapturedRequest[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [replayUrl, setReplayUrl] = useState('http://localhost:3000')
  const [replayResult, setReplayResult] = useState<string | null>(null)
  const [editingResponse, setEditingResponse] = useState(false)

  const load = useCallback(async () => {
    const [st, list] = await Promise.all([window.devforge.webhooks.status(), window.devforge.webhooks.list()])
    setStatus(st)
    setRequests(list)
    if (st.port) setPort(String(st.port))
  }, [])

  useEffect(() => {
    load()
    return window.devforge.webhooks.onRequest(r => {
      setRequests(prev => [r, ...prev].slice(0, 100))
      setSelected(s => s ?? r.id)
    })
  }, [load])

  async function toggle() {
    const st = status?.port ? await window.devforge.webhooks.stop() : await window.devforge.webhooks.start(Number(port))
    setStatus(st)
    if (st.error) toast.show({ tone: 'error', title: w.startFailed, description: st.error })
  }

  async function doReplay(id: string) {
    setReplayResult(null)
    const r = await window.devforge.webhooks.replay(id, replayUrl)
    setReplayResult(r.error ? `✗ ${r.error}` : `HTTP ${r.status}\n\n${pretty(r.body)}`)
  }

  const req = useMemo(() => requests.find(r => r.id === selected) ?? null, [requests, selected])
  const url = status?.port ? `http://localhost:${status.port}` : null

  return (
    <div className="flex h-full flex-col">
      {/* Server bar */}
      <div className="flex shrink-0 flex-wrap items-center gap-3 border-b border-line-subtle bg-surface px-6 py-3">
        <Webhook size={18} className="text-accent" />
        <h1 className="text-lg font-semibold text-fg">{w.title}</h1>
        <div className="ml-4 flex items-center gap-2">
          <Input type="number" value={port} onChange={e => setPort(e.target.value)} disabled={!!status?.port} aria-label="Port" className="h-8 w-24 font-mono" />
          <Button size="sm" variant={status?.port ? 'danger' : 'primary'} onClick={toggle}>
            <Power size={13} /> {status?.port ? w.stop : w.start}
          </Button>
        </div>
        {url && (
          <span className="flex items-center gap-1 rounded-lg bg-success-soft px-2.5 py-1 font-mono text-sm text-success">
            <span className="size-2 animate-pulse rounded-full bg-success" /> {url}
            <CopyButton text={url} />
          </span>
        )}
        <div className="ml-auto flex items-center gap-2">
          <Button size="sm" variant="ghost" onClick={() => setEditingResponse(true)}>
            {w.response}: <span className="font-mono">{status?.response.status}</span>
          </Button>
          <Button size="sm" variant="ghost" onClick={async () => { await window.devforge.webhooks.clear(); setRequests([]); setSelected(null) }}>
            <Eraser size={13} /> {w.clear}
          </Button>
        </div>
      </div>
      {url && (
        <p className="shrink-0 border-b border-line-subtle bg-surface px-6 pb-2.5 text-xs text-fg-muted">
          {w.tunnelHint} <code className="rounded bg-elevated px-1.5 py-0.5 text-fg-secondary">cloudflared tunnel --url {url}</code>
          {' '}<CopyButton text={`cloudflared tunnel --url ${url}`} />
        </p>
      )}

      <div className="flex min-h-0 flex-1">
        {/* Requests */}
        <aside className="flex w-80 shrink-0 flex-col overflow-y-auto border-r border-line-subtle">
          {requests.length === 0 && (
            <p className="p-6 text-center text-sm text-fg-muted">{status?.port ? w.waiting : w.notStarted}</p>
          )}
          {requests.map(r => (
            <button key={r.id} onClick={() => { setSelected(r.id); setReplayResult(null) }}
              className={cn('flex flex-col gap-0.5 border-b border-line-subtle px-4 py-2.5 text-left', selected === r.id ? 'bg-active' : 'hover:bg-hover')}>
              <span className="flex items-center gap-2">
                <span className={cn('w-14 font-mono text-xs font-bold', METHOD_COLOR[r.method] ?? 'text-fg')}>{r.method}</span>
                <span className="truncate font-mono text-xs text-fg">{r.url}</span>
              </span>
              <span className="text-2xs text-fg-muted">{new Date(r.at).toLocaleTimeString(lang)} · {r.body.length} B{r.headers['user-agent'] ? ` · ${r.headers['user-agent'].split(/[\s/]/)[0]}` : ''}</span>
            </button>
          ))}
        </aside>

        {/* Detail */}
        <section className="flex min-w-0 flex-1 flex-col gap-5 overflow-y-auto p-6">
          {!req ? (
            <EmptyState icon={<Webhook size={32} />} title={w.emptyTitle} description={w.emptyHint} />
          ) : (
            <>
              <div className="flex items-center gap-3">
                <span className={cn('font-mono text-lg font-bold', METHOD_COLOR[req.method])}>{req.method}</span>
                <span className="flex-1 truncate font-mono text-md text-fg">{req.url}</span>
                <span className="flex items-center gap-1 text-xs text-fg-muted">curl <CopyButton text={toCurl(req, status?.port ?? Number(port))} /></span>
              </div>

              <section className="flex flex-col gap-2">
                <SectionTitle>{w.headers} ({Object.keys(req.headers).length})</SectionTitle>
                <div className="overflow-hidden rounded-xl border border-line-subtle">
                  {Object.entries(req.headers).map(([k, v]) => (
                    <div key={k} className="flex gap-4 border-b border-line-subtle px-3 py-1.5 font-mono text-xs last:border-0">
                      <span className="w-56 shrink-0 text-fg-muted">{k}</span>
                      <span className="break-all text-fg-secondary">{v}</span>
                    </div>
                  ))}
                </div>
              </section>

              <section className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <SectionTitle>{w.body}</SectionTitle>
                  {req.truncated && <Badge color="warning">{w.truncated}</Badge>}
                  {req.body && <CopyButton text={req.body} />}
                </div>
                <pre className="max-h-96 overflow-auto rounded-xl bg-console p-3 font-mono text-xs whitespace-pre-wrap break-all text-fg-secondary">
                  {req.body ? pretty(req.body) : <span className="text-fg-muted">{w.noBody}</span>}
                </pre>
              </section>

              <section className="flex flex-col gap-2">
                <SectionTitle>{w.replay}</SectionTitle>
                <div className="flex gap-2">
                  <Input value={replayUrl} onChange={e => setReplayUrl(e.target.value)} className="font-mono" />
                  <Button variant="secondary" onClick={() => doReplay(req.id)}><Repeat size={13} /> {w.send}</Button>
                </div>
                <p className="text-xs text-fg-muted">{w.replayHint}</p>
                {replayResult && <pre tabIndex={0} className="max-h-64 overflow-auto rounded-xl bg-console p-3 font-mono text-xs whitespace-pre-wrap break-all text-fg-secondary">{replayResult}</pre>}
              </section>
            </>
          )}
        </section>
      </div>

      {editingResponse && status && (
        <ResponseEditor
          initial={status.response}
          onClose={() => setEditingResponse(false)}
          onSave={async r => {
            try { await window.devforge.webhooks.setResponse(r); await load(); setEditingResponse(false) }
            catch (err) { toast.show({ tone: 'error', title: String(err) }) }
          }}
        />
      )}
    </div>
  )
}

function ResponseEditor({ initial, onSave, onClose }: {
  initial: WebhookStatus['response']
  onSave: (r: WebhookStatus['response']) => void
  onClose: () => void
}) {
  const { t } = useI18n()
  const w = t.webhooks
  const [r, setR] = useState(initial)
  return (
    <Modal title={w.responseTitle} onClose={onClose}
      footer={<><Button variant="ghost" onClick={onClose}>{t.common.cancel}</Button><Button onClick={() => onSave(r)}><Send size={13} /> {t.common.save}</Button></>}>
      <div className="flex gap-3">
        <Field label="Status" className="w-28"><Input type="number" value={r.status} onChange={e => setR({ ...r, status: Number(e.target.value) })} /></Field>
        <Field label="Content-Type" className="flex-1"><Input value={r.contentType} onChange={e => setR({ ...r, contentType: e.target.value })} className="font-mono" /></Field>
      </div>
      <Field label={w.body}><Textarea value={r.body} onChange={e => setR({ ...r, body: e.target.value })} rows={6} /></Field>
    </Modal>
  )
}
