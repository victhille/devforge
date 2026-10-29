import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
import { AlertTriangle, CheckCircle2, CircleHelp, Copy, RefreshCw, ShieldAlert, Wrench } from 'lucide-react'
import type { HealthCheck, HealthFixId, HealthLevel, SSHConnection, VpsHealth } from '@shared/types'
import { useI18n } from '@renderer/i18n/I18nContext'
import { useToast } from '@renderer/app/ToastContext'
import { cn } from '@renderer/lib/cn'
import { formatRelative, formatSize } from '@renderer/lib/format'
import Button from '@renderer/components/ui/Button'
import Card from '@renderer/components/ui/Card'
import Modal from '@renderer/components/ui/Modal'
import Spinner from '@renderer/components/ui/Spinner'
import { Page, PageHeader } from '@renderer/components/ui/Page'
import { ServerSelect, useServerPicker } from './ServerPicker'
import NeedsSetup from '@renderer/components/NeedsSetup'
import { errorText } from '@renderer/lib/errors'

const ORDER: Record<HealthLevel, number> = { bad: 0, warn: 1, unknown: 2, ok: 3 }
/** `uptime -p` answers in English: "up 2 weeks, 2 days" → "en marche depuis 2 semaines, 2 jours" */
const UNITS_FR: Record<string, string> = { year: 'an', years: 'ans', month: 'mois', months: 'mois', week: 'semaine', weeks: 'semaines', day: 'jour', days: 'jours', hour: 'heure', hours: 'heures', minute: 'minute', minutes: 'minutes' }
export const uptimeText = (up: string, lang: string) =>
  lang === 'fr' ? up.replace(/^up /, 'en marche depuis ').replace(/\b(years?|months?|weeks?|days?|hours?|minutes?)\b/g, u => UNITS_FR[u] ?? u) : up

/** Values shown as sizes */
const SIZES = new Set(['free', 'total', 'size'])

export const LEVEL_STYLE: Record<HealthLevel, { icon: typeof CheckCircle2; text: string; soft: string }> = {
  ok: { icon: CheckCircle2, text: 'text-success', soft: 'bg-success-soft' },
  warn: { icon: AlertTriangle, text: 'text-warning', soft: 'bg-warning-soft' },
  bad: { icon: ShieldAlert, text: 'text-danger', soft: 'bg-danger-soft' },
  unknown: { icon: CircleHelp, text: 'text-fg-muted', soft: 'bg-active' }
}

/** Summary on the server's page: the overall level and what needs attention */
export function HealthCard({ connectionId, onOpen }: { connectionId: string; onOpen: () => void }) {
  const { t } = useI18n()
  const o = t.vpsOps
  const [health, setHealth] = useState<VpsHealth | null>(null)
  const [failed, setFailed] = useState(false)
  useEffect(() => { window.devforge.vpsOps.health(connectionId).then(setHealth).catch(() => setFailed(true)) }, [connectionId])
  if (failed) return null
  const issues = (health?.checks ?? []).filter(c => c.level === 'bad' || c.level === 'warn').sort((a, b) => ORDER[a.level] - ORDER[b.level])
  const level: HealthLevel = health ? issues[0]?.level ?? 'ok' : 'unknown'
  const L = LEVEL_STYLE[level]
  return (
    <Card className="flex flex-wrap items-center gap-3 p-4">
      <div className={cn('flex size-9 items-center justify-center rounded-xl', L.soft, L.text)}>{health ? <L.icon size={18} /> : <Spinner />}</div>
      <div className="min-w-[200px] flex-1">
        <div className="text-sm font-semibold text-fg">{t.nav.health} · {health ? o.summary[level] : o.checking}</div>
        {issues.length > 0 && <div className="truncate text-xs text-fg-secondary">{issues.slice(0, 3).map(c => (o.checks as Record<string, { title: string }>)[c.id]?.title ?? c.id).join(' · ')}</div>}
      </div>
      <Button size="sm" variant="secondary" onClick={onOpen}>{t.nav.health}</Button>
    </Card>
  )
}

export default function HealthPage() {
  const { t } = useI18n()
  const { connections, conn, serverId, setServerId } = useServerPicker()
  return (
    <Page>
      <PageHeader title={t.nav.health} subtitle={t.vpsOps.healthSubtitle} actions={<ServerSelect connections={connections} value={serverId} onChange={setServerId} />} />
      {!connections ? <Spinner /> : !conn ? <NeedsSetup service="server" /> : <Health key={conn.id} conn={conn} />}
    </Page>
  )
}

function Health({ conn }: { conn: SSHConnection }) {
  const { t, lang } = useI18n()
  const o = t.vpsOps
  const toast = useToast()
  const [health, setHealth] = useState<VpsHealth | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [fix, setFix] = useState<{ id: HealthFixId; command: string } | null>(null)
  const [running, setRunning] = useState(false)
  const [log, setLog] = useState('')
  const logRef = useRef<HTMLPreElement>(null)

  const load = useCallback(() => {
    setLoading(true); setError('')
    window.devforge.vpsOps.health(conn.id).then(setHealth).catch(err => setError(errorText(err))).finally(() => setLoading(false))
  }, [conn.id])
  useEffect(() => { load() }, [load])
  useEffect(() => window.devforge.vpsOps.onFixLog(e => { if (e.connectionId === conn.id) setLog(l => (l + e.text).slice(-40_000)) }), [conn.id])
  useEffect(() => { logRef.current?.scrollTo({ top: logRef.current.scrollHeight }) }, [log])

  const text = (c: HealthCheck) => {
    const entry = (o.checks as Record<string, Record<string, string>>)[c.id]
    const raw = c.level === 'unknown' ? o.unknownText : entry?.[c.level] || ''
    return raw.replace(/\{(\w+)\}/g, (_, k: string) => {
      const v = c.values[k]
      return v === undefined ? '' : SIZES.has(k) ? formatSize(Number(v)) : String(v)
    })
  }

  async function askFix(id: HealthFixId) {
    try { setFix({ id, command: await window.devforge.vpsOps.fixCommand(conn.id, id) }) } catch (err) { toast.show({ tone: 'error', title: errorText(err) }) }
  }

  async function runFix() {
    if (!fix) return
    const id = fix.id
    setFix(null); setRunning(true); setLog('')
    try {
      const r = await window.devforge.vpsOps.runFix(conn.id, id)
      toast.show({ tone: r.ok ? 'success' : 'error', title: r.ok ? o.fixOk : o.fixFailed })
    } catch (err) {
      const e = errorText(err)
      toast.show({ tone: 'error', title: e === 'NEEDS_KEY' ? o.needsKey : e })
    } finally {
      setRunning(false)
      // After a restart the server needs a moment before it answers again
      if (id === 'reboot') setTimeout(load, 60_000)
      else load()
    }
  }

  if (error) return <Card className="p-[18px] text-sm text-danger">{error}</Card>
  if (!health) return <p className="flex items-center gap-2 text-sm text-fg-muted"><Spinner /> {o.checking}</p>

  const sorted = [...health.checks].sort((a, b) => ORDER[a.level] - ORDER[b.level])
  const level: HealthLevel = sorted.find(c => c.level !== 'unknown')?.level ?? 'unknown'
  const Top = LEVEL_STYLE[level]

  return (
    <div className="flex flex-col gap-4">
      <Card className="df-rise flex flex-wrap items-center gap-4 p-5">
        <div className={cn('flex size-12 items-center justify-center rounded-[14px]', Top.soft, Top.text)}><Top.icon size={24} /></div>
        <div className="min-w-[220px] flex-1">
          <h2 className="text-lg font-semibold text-fg">{o.summary[level]}</h2>
          <div className="mt-1 text-xs text-fg-muted">
            {[health.os, health.uptime && uptimeText(health.uptime, lang), o.checkedAt.replace('{when}', formatRelative(health.checkedAt, lang))].filter(Boolean).join(' · ')}
          </div>
        </div>
        <Button variant="secondary" loading={loading} onClick={load}>{!loading && <RefreshCw size={14} />} {o.refresh}</Button>
      </Card>

      <Card className="df-rise overflow-hidden" style={{ '--i': 1 } as CSSProperties}>
        {sorted.map((c, i) => {
          const L = LEVEL_STYLE[c.level]
          const title = (o.checks as Record<string, { title: string }>)[c.id]?.title ?? c.id
          return (
            <div key={c.id} className={cn('flex flex-wrap items-center gap-3 px-[18px] py-3', i > 0 && 'border-t border-line-subtle')}>
              <L.icon size={17} className={cn('shrink-0', L.text)} aria-label={o.summary[c.level]} />
              <div className="min-w-[240px] flex-1">
                <div className="text-sm font-medium text-fg">{title}</div>
                <div className="text-[12.5px] text-fg-secondary">{text(c)}</div>
              </div>
              {c.fix && (
                <Button size="sm" variant={c.level === 'bad' ? 'primary' : 'secondary'} disabled={running} onClick={() => askFix(c.fix!)}>
                  <Wrench size={13} /> {o.fixes[c.fix]}
                </Button>
              )}
            </div>
          )
        })}
      </Card>

      {(running || log) && (
        <div className="overflow-hidden rounded-[14px] border border-line-subtle bg-console">
          <div className="flex items-center gap-2 border-b border-line-subtle px-4 py-2.5 text-[12.5px] font-semibold text-fg">{running && <Spinner />} {o.journal}</div>
          <pre ref={logRef} className="max-h-80 overflow-auto px-4 py-3 font-mono text-xs leading-relaxed whitespace-pre-wrap break-all text-fg-secondary">{log || '…'}</pre>
        </div>
      )}

      {fix && (
        <Modal title={o.fixTitle.replace('{name}', conn.name)} onClose={() => setFix(null)} className="max-w-xl"
          footer={<>
            <Button variant="ghost" onClick={() => setFix(null)}>{o.fixCancel}</Button>
            <Button variant="secondary" onClick={() => { navigator.clipboard.writeText(fix.command).then(() => toast.show({ tone: 'success', title: o.copied })).catch(() => {}) }}><Copy size={14} /> {o.fixCopy}</Button>
            {health.sudo && <Button variant={fix.id === 'reboot' ? 'danger' : 'primary'} onClick={runFix}>{o.fixRun}</Button>}
          </>}>
          <pre className="overflow-x-auto rounded-lg border border-line-subtle bg-console px-3 py-2.5 font-mono text-xs whitespace-pre-wrap break-all text-fg">{fix.command}</pre>
          {fix.id === 'reboot' && <p className="text-[13px] text-fg-secondary">{o.fixRebootHint}</p>}
          {fix.id === 'ssh-harden' && <p className="text-[13px] text-fg-secondary">{o.fixSshHint}</p>}
          {fix.id === 'apt-upgrade' && <p className="text-[13px] text-fg-secondary">{o.fixAptHint}</p>}
          {!health.sudo && <p className="text-[13px] text-warning">{o.noSudo}</p>}
        </Modal>
      )}
    </div>
  )
}
