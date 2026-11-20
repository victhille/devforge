import { useEffect, useState } from 'react'
import { Play, Smartphone, Square } from 'lucide-react'
import type { ExpoLog, ExpoProject, ExpoStartOptions, ExpoStatus } from '@shared/types'
import { useI18n } from '@renderer/i18n/I18nContext'
import { useToast } from '@renderer/app/ToastContext'
import { errorText } from '@renderer/lib/errors'
import { cn } from '@renderer/lib/cn'
import { Page, PageHeader, SectionTitle } from '@renderer/components/ui/Page'
import Button from '@renderer/components/ui/Button'
import Card, { CardTitle } from '@renderer/components/ui/Card'
import EmptyState from '@renderer/components/ui/EmptyState'
import ErrorState from '@renderer/components/ui/ErrorState'
import StatusDot from '@renderer/components/ui/StatusDot'
import { CardSkeleton } from '@renderer/components/ui/Skeleton'
import { useProjectList } from '@renderer/hooks/useLiveData'
import { NgrokNotice, RunningPanel, StartOptions, VersionsCard } from './parts'

const DEFAULT: ExpoStartOptions = { target: 'go', connection: 'lan', port: 8081, clear: false }

/** Development › Expo: the React Native apps, one Metro server, the QR code to scan */
export default function ExpoPage() {
  const { t } = useI18n()
  const e = t.expoPage
  const toast = useToast()
  const [apps, setApps] = useState<ExpoProject[] | null>(null)
  const [error, setError] = useState('')
  const [round, setRound] = useState(0)
  const [status, setStatus] = useState<ExpoStatus | null>(null)
  const [logs, setLogs] = useState<ExpoLog[]>([])
  const [picked, setPicked] = useState<string | null>(null)
  const [options, setOptions] = useState<ExpoStartOptions>(DEFAULT)
  const [busy, setBusy] = useState(false)
  // The apps are read again when a project is added, moved or removed (here, Forgy, another window)
  const projectList = useProjectList()
  const which = (projectList.data ?? []).map(p => `${p.id}=${p.path}`).join('|')

  useEffect(() => {
    let alive = true
    Promise.all([window.devforge.expo.projects(), window.devforge.expo.status(), window.devforge.expo.logs()])
      .then(([a, s, l]) => {
        if (!alive) return
        setApps(a)
        setStatus(s)
        setLogs(l)
        if (s.options) setOptions(s.options)
        setPicked(p => (p && a.some(x => x.id === p) ? p : (s.id ?? a[0]?.id ?? null)))
      })
      .catch(err => alive && setError(errorText(err)))
    return () => {
      alive = false
    }
  }, [round, which])

  // The server talks on its own: its lines and its state come as events
  useEffect(() => {
    const offLog = window.devforge.expo.onLog(l => setLogs(list => [...list, l].slice(-500)))
    const offStatus = window.devforge.expo.onStatus(setStatus)
    return () => {
      offLog()
      offStatus()
    }
  }, [])

  const app = apps?.find(a => a.id === picked) ?? null
  const live = status && status.state !== 'stopped' && status.state !== 'failed'
  const serving = live && status.id === picked

  async function toggle() {
    if (!app) return
    setBusy(true)
    try {
      if (serving) setStatus(await window.devforge.expo.stop())
      else {
        setLogs([])
        setStatus(await window.devforge.expo.start(app.id, options))
      }
    } catch (err) {
      toast.show({ tone: 'error', title: errorText(err) })
    } finally {
      setBusy(false)
    }
  }

  const header = <PageHeader crumb={t.nav.groupDev} title="Expo" subtitle={e.subtitle} />
  if (error)
    return (
      <Page>
        {header}
        <ErrorState error={error} onRetry={() => setRound(r => r + 1)} />
      </Page>
    )
  if (!apps || !status)
    return (
      <Page>
        {header}
        <CardSkeleton rows={3} />
      </Page>
    )
  if (!apps.length)
    return (
      <Page>
        {header}
        <EmptyState icon={<Smartphone size={28} />} title={e.noProjects} description={e.noProjectsHint} />
      </Page>
    )

  const stateText = !serving
    ? null
    : status.state === 'starting' && !status.url
      ? e.starting
      : status.state === 'failed'
        ? e.failed
        : e.running.replace('{port}', String(status.port ?? ''))

  return (
    <Page>
      {header}
      <div className="flex flex-wrap items-start gap-5">
        <section aria-labelledby="expo-projects" className="flex max-w-[300px] min-w-[220px] flex-[1_1_240px] flex-col gap-2">
          <SectionTitle id="expo-projects">{e.projects}</SectionTitle>
          {apps.map(a => {
            const on = a.id === picked
            const running = live && status.id === a.id
            return (
              <button
                key={a.id}
                type="button"
                aria-pressed={on}
                onClick={() => setPicked(a.id)}
                className={cn(
                  'flex w-full items-center gap-2.5 rounded-control border px-3 py-2.5 text-left transition-colors',
                  on ? 'border-accent bg-accent-soft' : 'border-line bg-surface hover:border-line-strong'
                )}
              >
                <StatusDot state={running ? 'on' : 'off'} live={!!running} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-fg">{a.name}</span>
                  <span className="block truncate font-mono text-xs text-fg-muted">{a.label}</span>
                </span>
                {a.sdk && <span className="shrink-0 font-mono text-xs text-fg-secondary">{e.sdk.replace('{n}', String(a.sdk))}</span>}
              </button>
            )
          })}
          <p className="mt-1 text-xs leading-relaxed text-fg-muted">{e.projectsHint}</p>
        </section>

        {app && (
          <section aria-label={e.server} className="flex min-w-0 flex-[999_1_560px] flex-col gap-4">
            <Card className="flex flex-col gap-3.5 p-4">
              <div className="flex flex-wrap items-center gap-2.5">
                <div className="min-w-[220px] flex-1">
                  <CardTitle className="text-lg">{app.name}</CardTitle>
                  <p className="truncate font-mono text-xs text-fg-muted">
                    {[app.label, app.sdk && e.sdk.replace('{n}', String(app.sdk)), app.router && e.router].filter(Boolean).join(' · ')}
                  </p>
                </div>
                {/* Always there, so that each change of state is read out */}
                <span
                  role="status"
                  className={cn(
                    'flex items-center gap-1.5 text-sm',
                    status.state === 'failed' ? 'text-danger' : status.url ? 'text-success' : 'text-warning',
                    !stateText && 'sr-only'
                  )}
                >
                  {stateText && (
                    <>
                      <StatusDot state={status.state === 'failed' ? 'error' : status.url ? 'on' : 'warn'} live={!status.url} /> {stateText}
                    </>
                  )}
                </span>
                <Button variant={serving ? 'danger' : 'primary'} loading={busy} onClick={toggle}>
                  {!busy && (serving ? <Square size={13} /> : <Play size={14} />)} {serving ? e.stop : e.start}
                </Button>
              </div>
              <StartOptions key={app.id} app={app} options={options} locked={!!serving} onChange={setOptions} />
            </Card>

            {serving && status.needsNgrok && <NgrokNotice />}
            {serving ? (
              <RunningPanel app={app} status={status} logs={logs} />
            ) : (
              <EmptyState
                icon={<Smartphone size={24} />}
                title={e.stoppedTitle}
                description={e.stopped}
                className="rounded-card border border-dashed border-line"
              />
            )}

            <VersionsCard key={`v-${app.id}`} app={app} />
          </section>
        )}
      </div>
    </Page>
  )
}
