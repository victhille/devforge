import { useCallback, useEffect, useState } from 'react'
import { Activity, ExternalLink, Pause, Pencil, Play, Plus, RefreshCw, Trash2 } from 'lucide-react'
import type { Monitor, MonitorCheck, MonitorState } from '@shared/types'
import { useI18n } from '@renderer/i18n/I18nContext'
import { cn } from '@renderer/lib/cn'
import { formatRelative } from '@renderer/lib/format'
import Badge from '@renderer/components/ui/Badge'
import Button from '@renderer/components/ui/Button'
import Card from '@renderer/components/ui/Card'
import EmptyState from '@renderer/components/ui/EmptyState'
import IconButton from '@renderer/components/ui/IconButton'
import Modal from '@renderer/components/ui/Modal'
import { Field, Input, Select } from '@renderer/components/ui/Input'
import { Page, PageHeader } from '@renderer/components/ui/Page'

const INTERVALS = [30, 60, 300, 900, 3600]

/** One bar per check, oldest on the left; height = latency, red = down */
function History({ checks }: { checks: MonitorCheck[] }) {
  const list = [...checks].reverse()
  const max = Math.max(200, ...list.map(c => c.latency ?? 0))
  return (
    <div className="flex h-8 items-end gap-px">
      {list.map((c, i) => (
        <span
          key={i}
          title={`${new Date(c.at).toLocaleTimeString()} — ${c.ok ? `${c.latency} ms` : c.error}`}
          className={cn('w-1.5 rounded-sm', c.ok ? 'bg-success/70' : 'bg-danger')}
          style={{ height: c.ok ? `${Math.max(15, ((c.latency ?? 0) / max) * 100)}%` : '100%' }}
        />
      ))}
    </div>
  )
}

function Editor({ initial, onSave, onClose }: { initial?: Monitor; onSave: (m: Monitor) => Promise<void>; onClose: () => void }) {
  const { t } = useI18n()
  const m = t.monitor
  const [form, setForm] = useState<Monitor>(initial ?? { id: crypto.randomUUID(), name: '', url: 'https://', intervalSec: 60, enabled: true })
  const [error, setError] = useState('')
  const set = <K extends keyof Monitor>(k: K, v: Monitor[K]) => setForm(f => ({ ...f, [k]: v }))

  async function save() {
    try { await onSave({ ...form, name: form.name.trim() || new URL(form.url).host }) }
    catch (err) { setError(String(err instanceof Error ? err.message : err)) }
  }

  return (
    <Modal title={initial ? m.editTitle : m.newTitle} onClose={onClose}
      footer={<><Button variant="ghost" onClick={onClose}>{t.common.cancel}</Button><Button onClick={save} disabled={!/^https?:\/\/.+/.test(form.url)}>{t.common.save}</Button></>}>
      <Field label="URL" error={error}>
        <Input value={form.url} onChange={e => set('url', e.target.value)} className="font-mono" autoFocus />
      </Field>
      <Field label={m.name}>
        <Input value={form.name} onChange={e => set('name', e.target.value)} placeholder={m.namePlaceholder} />
      </Field>
      <div className="flex gap-3">
        <Field label={m.interval} className="flex-1">
          <Select value={form.intervalSec} onChange={e => set('intervalSec', Number(e.target.value))}>
            {INTERVALS.map(s => <option key={s} value={s}>{s < 60 ? `${s} s` : s < 3600 ? `${s / 60} min` : '1 h'}</option>)}
          </Select>
        </Field>
        <Field label={m.keyword} hint={m.keywordHint} className="flex-1">
          <Input value={form.keyword ?? ''} onChange={e => set('keyword', e.target.value || undefined)} />
        </Field>
      </div>
    </Modal>
  )
}

export default function MonitorPage() {
  const { t, lang } = useI18n()
  const m = t.monitor
  const [monitors, setMonitors] = useState<Monitor[]>([])
  const [states, setStates] = useState<Record<string, MonitorState>>({})
  const [editing, setEditing] = useState<{ monitor?: Monitor } | null>(null)
  const [checking, setChecking] = useState<Set<string>>(new Set())

  const reload = useCallback(async () => {
    const [list, st] = await Promise.all([window.devforge.monitor.list(), window.devforge.monitor.states()])
    setMonitors(list)
    setStates(Object.fromEntries(st.map(s => [s.id, s])))
  }, [])

  useEffect(() => {
    reload()
    return window.devforge.monitor.onState(s => setStates(prev => ({ ...prev, [s.id]: s })))
  }, [reload])

  async function checkNow(id: string) {
    setChecking(prev => new Set(prev).add(id))
    try { await window.devforge.monitor.checkNow(id) }
    finally { setChecking(prev => { const n = new Set(prev); n.delete(id); return n }) }
  }

  const save = async (mon: Monitor) => { await window.devforge.monitor.save(mon); await reload(); setEditing(null) }

  const down = monitors.filter(x => x.enabled && states[x.id]?.status === 'down').length

  return (
    <Page>
      <PageHeader
        icon={<Activity size={18} />}
        title={m.title}
        subtitle={monitors.length ? (down ? m.subtitleDown.replace('{n}', String(down)) : m.subtitleOk) : m.subtitle}
        actions={<Button onClick={() => setEditing({})}><Plus size={14} /> {m.add}</Button>}
      />

      {monitors.length === 0 ? (
        <EmptyState icon={<Activity size={32} />} title={m.emptyTitle} description={m.emptyHint}
          action={<Button onClick={() => setEditing({})}><Plus size={14} /> {m.add}</Button>} />
      ) : (
        <Card className="divide-y divide-line-subtle">
          {monitors.map(mon => {
            const s = states[mon.id]
            const last = s?.checks[0]
            const okCount = s?.checks.filter(c => c.ok).length ?? 0
            const uptime = s?.checks.length ? Math.round((okCount / s.checks.length) * 1000) / 10 : null
            const status = !mon.enabled ? 'paused' : s?.status ?? 'unknown'
            return (
              <div key={mon.id} className="flex items-center gap-4 px-4 py-3">
                <span className={cn('size-2.5 shrink-0 rounded-full', {
                  up: 'bg-success', down: 'bg-danger animate-pulse', unknown: 'bg-fg-muted', paused: 'bg-fg-disabled'
                }[status])} />
                <div className="flex w-64 min-w-0 flex-col">
                  <span className="truncate font-medium text-fg">{mon.name}</span>
                  <button onClick={() => window.devforge.openExternal(mon.url)} className="flex items-center gap-1 truncate text-left font-mono text-2xs text-fg-muted hover:text-accent">
                    {mon.url} <ExternalLink size={9} className="shrink-0" />
                  </button>
                </div>
                <div className="min-w-0 flex-1">{s && s.checks.length > 0 && <History checks={s.checks} />}</div>
                <div className="flex w-36 shrink-0 flex-col items-end gap-0.5 text-xs">
                  {last ? (
                    last.ok
                      ? <span className="font-mono text-fg">{last.latency} ms · {last.statusCode}</span>
                      : <span className="truncate text-danger" title={last.error}>{last.error}</span>
                  ) : <span className="text-fg-muted">—</span>}
                  {s?.since && <span className="text-fg-muted">{m.since} {formatRelative(s.since, lang)}</span>}
                </div>
                <Badge color={uptime === null ? 'default' : uptime >= 99 ? 'success' : uptime >= 90 ? 'warning' : 'danger'} className="w-16 justify-center font-mono">
                  {uptime === null ? '—' : `${uptime}%`}
                </Badge>
                <div className="flex shrink-0 items-center gap-1">
                  <IconButton title={m.checkNow} onClick={() => checkNow(mon.id)} disabled={checking.has(mon.id)}>
                    <RefreshCw size={13} className={cn(checking.has(mon.id) && 'animate-spin')} />
                  </IconButton>
                  <IconButton title={mon.enabled ? m.pause : m.resume} onClick={() => save({ ...mon, enabled: !mon.enabled })}>
                    {mon.enabled ? <Pause size={13} /> : <Play size={13} />}
                  </IconButton>
                  <IconButton title={m.edit} onClick={() => setEditing({ monitor: mon })}><Pencil size={13} /></IconButton>
                  <IconButton title={t.common.delete} tone="danger" onClick={async () => { await window.devforge.monitor.remove(mon.id); reload() }}><Trash2 size={13} /></IconButton>
                </div>
              </div>
            )
          })}
        </Card>
      )}

      {monitors.length > 0 && <p className="text-xs text-fg-muted">{m.backgroundHint}</p>}

      {editing && <Editor initial={editing.monitor} onSave={save} onClose={() => setEditing(null)} />}
    </Page>
  )
}
