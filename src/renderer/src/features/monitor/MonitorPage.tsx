import { Fragment, useCallback, useEffect, useState } from 'react'
import { Activity, ChevronDown, ExternalLink, Pause, Pencil, Play, Plus, RefreshCw, Trash2 } from 'lucide-react'
import type { Monitor, MonitorCheck, MonitorState, UrlSuggestion } from '@shared/types'
import { useI18n } from '@renderer/i18n/I18nContext'
import { cn } from '@renderer/lib/cn'
import { formatRelative } from '@renderer/lib/format'
import Badge from '@renderer/components/ui/Badge'
import Button from '@renderer/components/ui/Button'
import Card from '@renderer/components/ui/Card'
import { Table, Td, Th } from '@renderer/components/ui/Table'
import { useHistory } from '@renderer/hooks/useWatch'
import EmptyState from '@renderer/components/ui/EmptyState'
import IconButton from '@renderer/components/ui/IconButton'
import Modal from '@renderer/components/ui/Modal'
import { Field, Input, Select } from '@renderer/components/ui/Input'
import { Page, PageHeader } from '@renderer/components/ui/Page'
import Suggestions from '@renderer/components/ui/Suggestions'
import ServersSection, { SiteHistory } from './ServersSection'
import Stat, { StatRow } from '@renderer/components/ui/Stat'
import { formatDowntime, incidentSummary } from '@shared/lib/incidents'

const DAY30 = 30 * 86_400_000

const INTERVALS = [30, 60, 300, 900, 3600]

/**
 * The last 24 hours, one bar an hour as in the mock-up: green when every check
 * answered, amber when some failed, red when none did, grey before the first.
 * Without a day of history yet, the latest checks.
 */
function Hours({ monitorId, checks }: { monitorId: string; checks: MonitorCheck[] }) {
  const { t } = useI18n()
  const w = t.watch
  const series = useHistory(`site:${monitorId}`, 24, 60)
  const hours = (series?.points ?? []).map(p => p.v[0])
  const known: (number | null)[] = hours.some(v => v !== null) ? hours.slice(-24) : [...checks].reverse().slice(-24).map(c => (c.ok ? 1 : 0))
  // Always 24 places: the hours before the first reading stay grey
  const bars = [...Array<null>(Math.max(0, 24 - known.length)).fill(null), ...known]
  const label = (v: number | null) => (v === null ? w.stateNone : v >= 1 ? w.stateUp : v > 0 ? w.statePartial : w.stateDown)
  return (
    <div className="flex h-5.5 min-w-[160px] items-stretch gap-0.5" role="img" aria-label={`${t.monitor.col24h} : ${bars.filter(v => v !== null && v >= 1).length}/${bars.length}`}>
      {bars.map((v, i) => (
        <span key={i} title={label(v)}
          className={cn('flex-1 rounded-[3px]', v === null ? 'bg-active' : v >= 1 ? 'bg-success' : v > 0 ? 'bg-warning' : 'bg-danger')} />
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
  const [open, setOpen] = useState<Set<string>>(new Set())
  const toggle = (id: string) => setOpen(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n })
  const [suggested, setSuggested] = useState<UrlSuggestion[]>([])

  const reload = useCallback(async () => {
    const [list, st] = await Promise.all([window.devforge.monitor.list(), window.devforge.monitor.states()])
    setMonitors(list)
    setStates(Object.fromEntries(st.map(s => [s.id, s])))
  }, [])

  useEffect(() => {
    reload()
    window.devforge.suggest.monitorUrls().then(setSuggested).catch(() => {})
    return window.devforge.monitor.onState(s => setStates(prev => ({ ...prev, [s.id]: s })))
  }, [reload])

  async function checkNow(id: string) {
    setChecking(prev => new Set(prev).add(id))
    try { await window.devforge.monitor.checkNow(id) }
    finally { setChecking(prev => { const n = new Set(prev); n.delete(id); return n }) }
  }

  const save = async (mon: Monitor) => { await window.devforge.monitor.save(mon); await reload(); setEditing(null) }

  const down = monitors.filter(x => x.enabled && states[x.id]?.status === 'down').length
  // Uptime of the recent checks of the watched URLs, all together
  const recent = monitors.filter(x => x.enabled).flatMap(x => states[x.id]?.checks ?? [])
  const uptime = recent.length ? Math.round((recent.filter(c => c.ok).length / recent.length) * 1000) / 10 : null
  const incidents = incidentSummary(monitors.map(x => states[x.id]?.incidents))

  return (
    <Page className="df-mockup">
      <PageHeader
        crumb={t.nav.groupServers}
        title={m.title}
        subtitle={monitors.length ? (down ? (down === 1 ? m.subtitleDownOne : m.subtitleDown.replace('{n}', String(down))) : m.subtitleOk) : m.subtitle}
        actions={<Button onClick={() => setEditing({})}><Plus size={14} /> {m.add}</Button>}
      />

      <Suggestions
        title={m.suggestions}
        items={suggested.map(s => ({
          key: s.url,
          label: <span className="font-mono">{s.url}</span>,
          hint: s.source,
          onPick: async () => {
            await save({ id: crypto.randomUUID(), name: s.name, url: s.url, intervalSec: 60, enabled: true })
            setSuggested(list => list.filter(x => x.url !== s.url))
          }
        }))}
      />

      {monitors.length > 0 && (
        <StatRow>
          <Stat label={m.statWatched} value={monitors.filter(x => x.enabled).length} unit={monitors.some(x => !x.enabled) ? `/ ${monitors.length}` : undefined} />
          <Stat label={m.statUptime} value={uptime === null ? '—' : `${uptime.toLocaleString(lang)} %`}
            tone={uptime === null ? undefined : uptime >= 99 ? 'success' : uptime >= 90 ? 'warning' : 'danger'} />
          <Stat label={m.statIncidents} value={incidents.count} unit={incidents.downMs > 0 ? formatDowntime(incidents.downMs, t.vpsDash.dayShort) : undefined}
            tone={incidents.count > 0 ? 'warning' : undefined} />
        </StatRow>
      )}

      {monitors.length === 0 ? (
        <EmptyState icon={<Activity size={32} />} title={m.emptyTitle} description={m.emptyHint}
          action={<Button onClick={() => setEditing({})}><Plus size={14} /> {m.add}</Button>} />
      ) : (
        <Card className="overflow-hidden">
          <Table>
            <thead>
              <tr>
                <Th>{m.colTarget}</Th>
                <Th>{m.colState}</Th>
                <Th>{m.colResponse}</Th>
                <Th>{m.col24h}</Th>
                <Th align="right">{m.col30d}</Th>
                <Th align="right"><span className="sr-only">{m.actions}</span></Th>
              </tr>
            </thead>
            <tbody>
              {monitors.map(mon => {
                const s = states[mon.id]
                const last = s?.checks[0]
                const status = !mon.enabled ? 'paused' : s?.status ?? 'unknown'
                // The last 30 days: the time its incidents lasted
                const down = incidentSummary([s?.incidents]).downMs
                // Rounded down (99,99 %, never 100 % with an incident)
                const month = s?.incidents ? Math.floor(Math.max(0, 100 - (down / DAY30) * 100) * 100) / 100 : null
                const scheme = /^(\w+):/.exec(mon.url)?.[1] ?? ''
                const expanded = open.has(mon.id)
                return (
                  <Fragment key={mon.id}>
                    <tr>
                      <Td className="min-w-[220px]">
                        <span className="block truncate font-semibold text-fg">{mon.name}</span>
                        <button onClick={() => window.devforge.openExternal(mon.url)} title={mon.url}
                          className="flex max-w-full items-center gap-1 truncate text-left font-mono text-xs text-fg-muted hover:text-accent">
                          {[scheme, mon.keyword ? m.expected.replace('{kw}', mon.keyword) : /^\w+:\/\/([^/?#]+)/.exec(mon.url)?.[1]].filter(Boolean).join(' · ')}
                          <ExternalLink size={10} aria-hidden className="shrink-0" />
                        </button>
                      </Td>
                      <Td className="whitespace-nowrap">
                        <Badge dot color={status === 'up' ? 'success' : status === 'down' ? 'danger' : 'default'}>
                          {status === 'up' ? m.stateUp : status === 'down' ? m.stateDown : status === 'paused' ? m.statePaused : m.stateUnknown}
                        </Badge>
                        {s?.since && <span className="mt-0.5 block text-xs text-fg-muted">{m.since} {formatRelative(s.since, lang)}</span>}
                      </Td>
                      <Td className="max-w-[160px] whitespace-nowrap">
                        {last ? (last.ok
                          ? <span className="font-mono text-fg">{last.latency} ms</span>
                          : <span className="block truncate text-sm text-danger" title={last.error}>{last.error}</span>)
                          : <span className="text-fg-muted">—</span>}
                      </Td>
                      <Td className="w-full">{s && <Hours monitorId={mon.id} checks={s.checks} />}</Td>
                      <Td align="right" className="font-mono whitespace-nowrap text-fg">{month === null ? '—' : `${month.toLocaleString(lang, { maximumFractionDigits: 2 })} %`}</Td>
                      <Td align="right" className="whitespace-nowrap">
                        <span className="inline-flex items-center gap-0.5">
                          <IconButton size="sm" title={m.checkNow} onClick={() => checkNow(mon.id)} disabled={checking.has(mon.id)}>
                            <RefreshCw size={13} className={cn(checking.has(mon.id) && 'animate-spin')} />
                          </IconButton>
                          <IconButton size="sm" title={mon.enabled ? m.pause : m.resume} onClick={() => save({ ...mon, enabled: !mon.enabled })}>
                            {mon.enabled ? <Pause size={13} /> : <Play size={13} />}
                          </IconButton>
                          <IconButton size="sm" title={m.edit} onClick={() => setEditing({ monitor: mon })}><Pencil size={13} /></IconButton>
                          <IconButton size="sm" title={t.common.delete} tone="danger" onClick={async () => { await window.devforge.monitor.remove(mon.id); reload() }}><Trash2 size={13} /></IconButton>
                          <IconButton size="sm" title={m.details} aria-expanded={expanded} onClick={() => toggle(mon.id)}>
                            <ChevronDown size={14} className={cn('transition-transform', expanded && 'rotate-180')} />
                          </IconButton>
                        </span>
                      </Td>
                    </tr>
                    {/* Its 24 hours in detail: availability per half hour and response time */}
                    {expanded && (
                      <tr><td colSpan={6} className="border-t border-line-subtle bg-canvas/40 pt-3"><SiteHistory monitorId={mon.id} /></td></tr>
                    )}
                  </Fragment>
                )
              })}
            </tbody>
          </Table>
        </Card>
      )}

      {monitors.length > 0 && <p className="text-xs text-fg-muted">{m.backgroundHint}</p>}

      <ServersSection />

      {editing && <Editor initial={editing.monitor} onSave={save} onClose={() => setEditing(null)} />}
    </Page>
  )
}
