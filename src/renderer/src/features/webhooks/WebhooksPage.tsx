import { useCallback, useEffect, useMemo, useState } from 'react'
import { Power, Repeat, Send, Webhook } from 'lucide-react'
import type { CapturedRequest, WebhookStatus } from '@shared/types'
import { useI18n } from '@renderer/i18n/I18nContext'
import { useToast } from '@renderer/app/ToastContext'
import { cn } from '@renderer/lib/cn'
import { formatSize } from '@renderer/lib/format'
import Badge from '@renderer/components/ui/Badge'
import Button from '@renderer/components/ui/Button'
import Card from '@renderer/components/ui/Card'
import CopyButton from '@renderer/components/ui/CopyButton'
import EmptyState from '@renderer/components/ui/EmptyState'
import Modal from '@renderer/components/ui/Modal'
import Tabs from '@renderer/components/ui/Tabs'
import { Field, Input, Textarea } from '@renderer/components/ui/Input'
import { Page, PageHeader } from '@renderer/components/ui/Page'
import ToolHelp from '@renderer/components/ui/ToolHelp'
import { WEBHOOK_EXAMPLE, WEBHOOK_EXAMPLE_TARGET } from '@renderer/features/tools/examples'
import { describeCall } from './describeCall'
import Notice from '@renderer/components/ui/Notice'

type DetailTab = 'body' | 'headers' | 'reply'

function pretty(body: string): string {
  try { return JSON.stringify(JSON.parse(body), null, 2) } catch { return body }
}

/** One-line curl reproducing the request against the local server */
function toCurl(r: Pick<CapturedRequest, 'method' | 'url' | 'headers' | 'body'>, port: number): string {
  const skip = new Set(['host', 'content-length', 'connection'])
  const headers = Object.entries(r.headers).filter(([k]) => !skip.has(k)).map(([k, v]) => `-H '${k}: ${v.replace(/'/g, "'\\''")}'`)
  const body = r.body ? ` --data-raw '${r.body.replace(/'/g, "'\\''")}'` : ''
  return `curl -X ${r.method} 'http://localhost:${port}${r.url}' ${headers.join(' ')}${body}`
}

/**
 * As in the mock-up: the state in the title, Start / Stop in the header; the
 * address, where calls are replayed and the answer given, in one card; the
 * calls received on the left, the one picked on the right (body, headers,
 * the app's answer to the replay).
 */
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
  const [replaying, setReplaying] = useState(false)
  const [tab, setTab] = useState<DetailTab>('body')
  const [editingResponse, setEditingResponse] = useState(false)
  /** The example request shown in place of a real one (never sent, never stored) */
  const [example, setExample] = useState(false)

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
    setReplaying(true)
    setTab('reply')
    try {
      const r = await window.devforge.webhooks.replay(id, replayUrl)
      setReplayResult(r.error ? `✗ ${r.error}` : `HTTP ${r.status}\n\n${pretty(r.body)}`)
    } finally { setReplaying(false) }
  }

  const pick = (id: string) => { setSelected(id); setExample(false); setReplayResult(null); setTab('body') }
  const req = useMemo(() => requests.find(r => r.id === selected) ?? null, [requests, selected])
  const today = new Date().toDateString()
  const receivedToday = requests.filter(r => new Date(r.at).toDateString() === today).length
  const url = status?.port ? `http://localhost:${status.port}` : null
  const listening = !!status?.port

  const title = (
    <span className="flex min-w-0 items-center gap-3">
      {t.nav.webhooks}
      <Badge dot color={listening ? 'success' : 'default'}>{listening ? w.listening : w.stopped}</Badge>
    </span>
  )
  const shown = req ?? (example ? { ...WEBHOOK_EXAMPLE, id: 'example', at: '', truncated: false } : null)
  const call = shown ? describeCall(shown) : null

  return (
    <Page className="df-mockup">
      <PageHeader crumb={t.nav.groupData} title={title} subtitle={w.subtitle}
        actions={listening
          ? <Button variant="danger" onClick={toggle}><Power size={14} aria-hidden /> {w.stop}</Button>
          : <>
              <label className="flex items-center gap-2 text-sm text-fg-muted">{w.portShort}
                <Input type="number" value={port} onChange={e => setPort(e.target.value)} aria-label={w.port} className="w-24 font-mono" />
              </label>
              <Button onClick={toggle}><Power size={14} aria-hidden /> {w.start}</Button>
            </>} />

      <ToolHelp id="webhooks" what={t.toolHelp.webhooks.what} how={t.toolHelp.webhooks.how}
        examples={[{ label: t.toolHelp.webhooks.sample, onPick: () => { setSelected(null); setExample(true); setTab('body') } }]} />

      {/* Where calls arrive, where they are replayed, what they are answered */}
      <Card className="flex flex-col gap-2 px-4 py-3.5">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm">
          <span className="text-fg-muted">{w.localAddress}</span>
          {url
            ? <span className="flex items-center gap-1.5 font-mono font-semibold text-fg">{url} <CopyButton text={url} title={w.copyAddress} /></span>
            : <span className="font-mono text-fg-muted" title={w.notStarted}>http://localhost:{port || '…'}</span>}
          <span className="text-fg-muted">→ {w.replayTo}</span>
          <Input value={replayUrl} onChange={e => setReplayUrl(e.target.value)} aria-label={w.replayTarget} className="h-8 w-[300px] max-w-full font-mono text-sm" spellCheck={false} />
          <span className="text-fg-muted">· {w.responseShort}</span>
          <Button size="sm" variant="secondary" onClick={() => setEditingResponse(true)} disabled={!status} aria-label={w.editResponse}>
            <span className="font-mono">{status?.response.status ?? '—'}</span>
          </Button>
        </div>
        {url && (
          <p className="text-xs text-fg-muted">
            {w.tunnelHint} <code className="rounded bg-elevated px-1.5 py-0.5 text-fg-secondary">cloudflared tunnel --url {url}</code>{' '}
            <CopyButton text={`cloudflared tunnel --url ${url}`} />
          </p>
        )}
      </Card>

      <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)]">
        {/* Calls received */}
        <Card className="flex flex-col p-3.5">
          <div className="flex items-center gap-3 px-1 pb-2.5">
            <h2 className="min-w-0 flex-1 font-display text-md font-bold tracking-[-.01em] text-fg">{w.received}</h2>
            {requests.length > 0 && <span className="text-xs text-fg-muted">{w.today.replace('{n}', String(receivedToday))}</span>}
            {requests.length > 0 && (
              <button onClick={async () => { await window.devforge.webhooks.clear(); setRequests([]); setSelected(null) }}
                className="text-sm font-semibold text-accent hover:underline">{w.clear}</button>
            )}
          </div>
          {requests.length === 0 ? (
            <p className="px-1 py-6 text-center text-sm text-fg-muted">{listening ? w.waiting : w.notStarted}</p>
          ) : (
            <ul aria-label={w.received} className="flex flex-col gap-1">
              {requests.map(r => {
                const { name } = describeCall(r)
                return (
                  <li key={r.id}>
                    <button onClick={() => pick(r.id)} aria-current={selected === r.id ? 'true' : undefined}
                      className={cn('flex h-10 w-full items-center gap-3 rounded-control px-2.5 text-left transition-colors', selected === r.id ? 'bg-accent-soft' : 'hover:bg-hover')}>
                      <span className="w-12 shrink-0 font-mono text-xs font-bold text-accent">{r.method}</span>
                      <span className="min-w-0 flex-1 truncate font-mono text-sm text-fg" title={r.url}>{name}</span>
                      <span className="shrink-0 text-xs text-fg-muted">{new Date(r.at).toLocaleTimeString(lang, { hour: '2-digit', minute: '2-digit' })}</span>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </Card>

        {/* The call picked */}
        {!shown || !call ? (
          <EmptyState icon={<Webhook size={32} />} title={w.emptyTitle} description={w.emptyHint} />
        ) : (
          <Card className="flex min-w-0 flex-col gap-3 p-4.5">
            <div className="flex flex-wrap items-center gap-3">
              {example && !req && <Badge color="warning">{t.toolHelp.example}</Badge>}
              <h2 className="min-w-0 flex-1 truncate font-display text-md font-bold tracking-[-.01em] text-fg" title={`${shown.method} ${shown.url}`}>{call.name}</h2>
              <span className="text-xs text-fg-muted">{[call.source, formatSize(new Blob([shown.body]).size)].filter(Boolean).join(' · ')}</span>
              <span className="flex items-center gap-1 text-xs text-fg-muted">curl <CopyButton text={toCurl(shown, status?.port ?? Number(port))} title={w.copyCurl} /></span>
              {req
                ? <Button size="sm" variant="secondary" loading={replaying} onClick={() => doReplay(req.id)}>{!replaying && <Repeat size={13} aria-hidden />} {w.replay}</Button>
                : <Button size="sm" variant="ghost" onClick={() => setExample(false)}>{t.common.close}</Button>}
            </div>
            {example && !req && (
              <Notice tone="warning" role="note" className="text-sm">
                {t.toolHelp.webhooks.exampleNote} <span className="font-mono text-xs">→ {WEBHOOK_EXAMPLE_TARGET}</span>
              </Notice>
            )}
            <Tabs<DetailTab> variant="underline" value={tab} onChange={setTab} label={w.detail} items={[
              { value: 'body', label: w.body },
              { value: 'headers', label: <>{w.headers} <span className="ml-1 font-mono text-xs text-fg-muted">{Object.keys(shown.headers).length}</span></> },
              { value: 'reply', label: w.reply, disabled: !req }
            ]} />
            {tab === 'headers' ? (
              <div className="overflow-hidden rounded-control border border-line-subtle">
                {Object.entries(shown.headers).map(([k, v]) => (
                  <div key={k} className="flex gap-4 border-b border-line-subtle px-3 py-2 font-mono text-xs last:border-0">
                    <span className="w-56 shrink-0 text-fg-muted">{k}</span>
                    <span className="break-all text-fg-secondary">{v}</span>
                  </div>
                ))}
              </div>
            ) : tab === 'reply' ? (
              <>
                <p className="text-xs text-fg-muted">{w.replayHint}</p>
                <pre tabIndex={0} className="max-h-96 min-h-24 overflow-auto rounded-control bg-console p-4 font-mono text-xs whitespace-pre-wrap break-all text-fg">
                  {replayResult ?? <span className="text-fg-muted">{w.replayNone}</span>}
                </pre>
              </>
            ) : (
              <>
                {'truncated' in shown && shown.truncated && <Badge color="warning" className="self-start">{w.truncated}</Badge>}
                <pre tabIndex={0} className="max-h-[420px] overflow-auto rounded-control bg-console p-4 font-mono text-xs whitespace-pre-wrap break-all text-fg">
                  {shown.body ? pretty(shown.body) : <span className="text-fg-muted">{w.noBody}</span>}
                </pre>
              </>
            )}
          </Card>
        )}
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
    </Page>
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
      footer={<><Button variant="ghost" onClick={onClose}>{t.common.cancel}</Button><Button onClick={() => onSave(r)}><Send size={13} aria-hidden /> {t.common.save}</Button></>}>
      <div className="flex gap-3">
        <Field label="Status" className="w-28"><Input type="number" value={r.status} onChange={e => setR({ ...r, status: Number(e.target.value) })} /></Field>
        <Field label="Content-Type" className="flex-1"><Input value={r.contentType} onChange={e => setR({ ...r, contentType: e.target.value })} className="font-mono" /></Field>
      </div>
      <Field label={w.body}><Textarea value={r.body} onChange={e => setR({ ...r, body: e.target.value })} rows={6} /></Field>
    </Modal>
  )
}
