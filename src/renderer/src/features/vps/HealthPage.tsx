import { useCallback, useEffect, useState, type CSSProperties } from 'react'
import { CardSkeleton } from '@renderer/components/ui/Skeleton'
import { Link } from 'react-router-dom'
import { AlertTriangle, CheckCircle2, CircleHelp, Copy, RefreshCw, ShieldAlert, Wrench } from 'lucide-react'
import type { HealthCheck, HealthFixId, HealthLevel, SSHConnection, VpsHealth } from '@shared/types'
import { useI18n } from '@renderer/i18n/I18nContext'
import { useToast } from '@renderer/app/ToastContext'
import { cn } from '@renderer/lib/cn'
import { formatRelative, formatSize } from '@renderer/lib/format'
import Badge from '@renderer/components/ui/Badge'
import Button from '@renderer/components/ui/Button'
import Card from '@renderer/components/ui/Card'
import Modal from '@renderer/components/ui/Modal'
import Spinner from '@renderer/components/ui/Spinner'
import { Page, PageHeader } from '@renderer/components/ui/Page'
import { ServerSelect, useServerPicker } from './ServerPicker'
import NeedsSetup from '@renderer/components/NeedsSetup'
import { errorText } from '@renderer/lib/errors'
import LogBox from '@renderer/components/ui/LogBox'
import Stat, { StatRow } from '@renderer/components/ui/Stat'

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

/** Summary on the server's page, as the mock-up's alert: the overall level and what needs attention, the way to the page */
export function HealthCard({ health, onOpen }: { health: VpsHealth | null; onOpen: () => void }) {
  const { t } = useI18n()
  const o = t.vpsOps
  const issues = (health?.checks ?? []).filter(c => c.level === 'bad' || c.level === 'warn').sort((a, b) => ORDER[a.level] - ORDER[b.level])
  const level: HealthLevel = health ? issues[0]?.level ?? 'ok' : 'unknown'
  const L = LEVEL_STYLE[level]
  // Amber as in the mock-up, whatever the level: each check keeps its own color on the page
  const alert = level === 'bad' || level === 'warn'
  return (
    <div className={cn('flex items-center gap-3 rounded-card border px-4 py-3.5', alert ? 'border-warning/30 bg-warning-soft' : 'border-line-subtle bg-surface')}>
      <span className={cn('shrink-0', alert ? 'text-warning' : L.text)}>{health ? <L.icon size={16} aria-hidden /> : <Spinner />}</span>
      <p className="min-w-0 flex-1 text-sm text-fg">
        <span className="font-semibold">{health ? o.summary[level] : o.checking}</span>
        {issues.length > 0 && <span className="text-fg-secondary"> · {issues.slice(0, 3).map(c => (o.checks as Record<string, { title: string }>)[c.id]?.title ?? c.id).join(', ')}</span>}
      </p>
      <Link to="/health" onClick={onOpen} className={cn('shrink-0 text-sm font-semibold hover:underline', level === 'ok' ? 'text-fg-secondary' : 'text-accent')}>{t.nav.health}</Link>
    </div>
  )
}

export default function HealthPage() {
  const { t } = useI18n()
  const picker = useServerPicker()
  const { connections, conn } = picker
  // The page's header comes with the check (« vérifié il y a 3 min », Revérifier)
  if (connections && conn) return <Page className="df-mockup"><Health key={conn.id} conn={conn} picker={picker} /></Page>
  return (
    <Page className="df-mockup">
      <PageHeader crumb={t.nav.groupServers} title={t.nav.health} subtitle={t.vpsOps.healthSubtitle} />
      {!connections ? <CardSkeleton rows={3} /> : <NeedsSetup service="server" />}
    </Page>
  )
}

function Health({ conn, picker }: { conn: SSHConnection; picker: ReturnType<typeof useServerPicker> }) {
  const { t, lang } = useI18n()
  const o = t.vpsOps
  const toast = useToast()
  const [health, setHealth] = useState<VpsHealth | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [fix, setFix] = useState<{ id: HealthFixId; command: string } | null>(null)
  const [running, setRunning] = useState(false)
  const [log, setLog] = useState('')

  const load = useCallback(() => {
    setLoading(true); setError('')
    window.devforge.vpsOps.health(conn.id).then(setHealth).catch(err => setError(errorText(err))).finally(() => setLoading(false))
  }, [conn.id])
  useEffect(() => { load() }, [load])
  useEffect(() => window.devforge.vpsOps.onFixLog(e => { if (e.connectionId === conn.id) setLog(l => (l + e.text).slice(-40_000)) }), [conn.id])

  const text = (c: HealthCheck) => {
    const entry = (o.checks as Record<string, Record<string, string>>)[c.id]
    const raw = c.level === 'unknown' ? o.unknownText : entry?.[c.level] || ''
    return raw.replace(/\{(\w+)\}/g, (_, k: string) => {
      const v = c.values[k]
      return v === undefined ? '' : SIZES.has(k) ? formatSize(Number(v), lang) : String(v)
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

  // As in the mock-up: where it is, when it was checked, Check again on the right
  const header = (
    <PageHeader crumb={`${t.nav.groupServers} · ${conn.name}`} title={t.nav.health}
      subtitle={<>
        {o.healthSubtitle} {health && o.checkedAt.replace('{when}', formatRelative(health.checkedAt, lang))}
        {health && (health.os || health.uptime) && <span className="mt-0.5 block text-sm text-fg-muted">{[health.os, health.uptime && uptimeText(health.uptime, lang)].filter(Boolean).join(' · ')}</span>}
      </>}
      actions={<>
        <ServerSelect connections={picker.connections} value={picker.serverId} onChange={picker.setServerId} />
        <Button variant="secondary" loading={loading} onClick={load}>{!loading && <RefreshCw size={14} />} {o.recheck}</Button>
      </>} />
  )

  if (error) return <>{header}<Card className="p-4.5 text-sm text-danger">{error}</Card></>
  if (!health) return <>{header}<CardSkeleton label={o.checking} rows={4} /></>

  const sorted = [...health.checks].sort((a, b) => ORDER[a.level] - ORDER[b.level])
  const count = (...levels: HealthLevel[]) => health.checks.filter(c => levels.includes(c.level)).length
  const known = count('ok', 'warn', 'bad')
  const score = known ? Math.round((10 * (count('ok') + count('warn') / 2)) / known) : null
  const toFix = count('bad', 'warn')

  return (
    <>
      {header}
      <StatRow className="df-rise" style={{ '--i': 1 } as CSSProperties}>
        <Stat label={o.statScore} value={score === null ? '—' : score} unit={score === null ? undefined : '/ 10'} />
        <Stat label={o.statToFix} value={toFix} tone={toFix === 0 ? undefined : 'warning'} />
        <Stat label={o.summary.ok} value={count('ok')} tone={count('ok') ? 'success' : undefined} />
      </StatRow>

      <Card className="df-rise overflow-hidden" style={{ '--i': 2 } as CSSProperties}>
        {sorted.map((c, i) => {
          const L = LEVEL_STYLE[c.level]
          const title = (o.checks as Record<string, { title: string }>)[c.id]?.title ?? c.id
          return (
            <div key={c.id} className={cn('flex flex-wrap items-center gap-3.5 px-4 py-3.5', i > 0 && 'border-t border-line-subtle')}>
              <span className={cn('flex size-6.5 shrink-0 items-center justify-center rounded-lg', L.soft, L.text)}>
                <L.icon size={14} aria-label={o.summary[c.level]} />
              </span>
              <div className="min-w-[240px] flex-1">
                <div className="text-base font-semibold text-fg">{title}</div>
                <div className="text-sm text-fg-secondary">{text(c)}</div>
              </div>
              {c.fix ? (
                <Button size="sm" variant={c.level === 'ok' ? 'secondary' : c.level === 'bad' || c.fix === 'apt-upgrade' ? 'primary' : 'secondary'} disabled={running} onClick={() => askFix(c.fix!)}>
                  <Wrench size={13} aria-hidden /> {o.fixes[c.fix]}
                </Button>
              ) : c.level === 'ok' && <Badge color="success">{o.okBadge}</Badge>}
            </div>
          )
        })}
      </Card>

      {(running || log) && (
        <LogBox title={o.journal} text={log} running={running} />
      )}

      {fix && (
        <Modal title={o.fixTitle.replace('{name}', conn.name)} onClose={() => setFix(null)} className="max-w-xl"
          footer={<>
            <Button variant="ghost" onClick={() => setFix(null)}>{o.fixCancel}</Button>
            <Button variant="secondary" onClick={() => { navigator.clipboard.writeText(fix.command).then(() => toast.show({ tone: 'success', title: o.copied })).catch(() => {}) }}><Copy size={14} /> {o.fixCopy}</Button>
            {health.sudo && <Button variant={fix.id === 'reboot' ? 'danger' : 'primary'} onClick={runFix}>{o.fixRun}</Button>}
          </>}>
          <pre className="overflow-x-auto rounded-lg border border-line-subtle bg-console px-3 py-2.5 font-mono text-xs whitespace-pre-wrap break-all text-fg">{fix.command}</pre>
          {fix.id === 'reboot' && <p className="text-base text-fg-secondary">{o.fixRebootHint}</p>}
          {fix.id === 'ssh-harden' && <p className="text-base text-fg-secondary">{o.fixSshHint}</p>}
          {fix.id === 'apt-upgrade' && <p className="text-base text-fg-secondary">{o.fixAptHint}</p>}
          {!health.sudo && <p className="text-base text-warning">{o.noSudo}</p>}
        </Modal>
      )}
    </>
  )
}
