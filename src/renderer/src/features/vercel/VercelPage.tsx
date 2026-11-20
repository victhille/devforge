import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { RefreshCw } from 'lucide-react'
import type { VercelAccount, VercelAccountDeployment, VercelAccountDomain, VercelAccountProject, VercelScope, VercelScopes } from '@shared/types'
import { useI18n } from '@renderer/i18n/I18nContext'
import { useToast } from '@renderer/app/ToastContext'
import { confirmDialog } from '@renderer/app/ConfirmContext'
import { errorText } from '@renderer/lib/errors'
import LogBox from '@renderer/components/ui/LogBox'
import { visibleInterval } from '@renderer/lib/visibleInterval'
import { Page, PageHeader } from '@renderer/components/ui/Page'
import Button from '@renderer/components/ui/Button'
import Card from '@renderer/components/ui/Card'
import Tabs from '@renderer/components/ui/Tabs'
import EmptyState from '@renderer/components/ui/EmptyState'
import ErrorState from '@renderer/components/ui/ErrorState'
import { CardSkeleton, LinesSkeleton } from '@renderer/components/ui/Skeleton'
import { Select } from '@renderer/components/ui/Input'
import { useProjects } from '@renderer/features/projects/hooks/useProjects'
import VercelConnect from './VercelConnect'
import { DeploymentActions, DeploymentLine, DomainCard, LinkDialog, ProjectCard } from './parts'
import { isBuilding } from './states'

type Tab = 'projects' | 'deployments' | 'domains'
type Filter = 'all' | 'production' | 'preview' | 'failed'

interface Data {
  projects: VercelAccountProject[]
  deployments: VercelAccountDeployment[]
  domains: VercelAccountDomain[] | 'failed'
}

const Logo = () => (
  <svg aria-hidden width="20" height="20" viewBox="0 0 24 24" className="fill-fg">
    <path d="M12 3l10 18H2z" />
  </svg>
)

/** Online › Vercel: every project of the account or of a team, the deployments and the domains */
export default function VercelPage() {
  const { t } = useI18n()
  const v = t.vercel
  const p = t.vercelPage
  const toast = useToast()
  const navigate = useNavigate()
  const { projects: local } = useProjects()
  const [acc, setAcc] = useState<VercelAccount | null>(null)
  const [scopes, setScopes] = useState<VercelScopes | null>(null)
  const [scope, setScope] = useState<VercelScope>(null)
  const [data, setData] = useState<Data | null>(null)
  const [error, setError] = useState('')
  const [round, setRound] = useState(0)
  const [tab, setTab] = useState<Tab>('projects')
  const [filter, setFilter] = useState<Filter>('all')
  const [busy, setBusy] = useState<string | null>(null)
  const [logs, setLogs] = useState<{ id: string; text: string | null } | null>(null)
  const [linking, setLinking] = useState<VercelAccountProject | null>(null)

  const say = useCallback(
    (err: unknown) => {
      const e = errorText(err)
      return e === 'BAD_TOKEN' ? v.badToken : e === 'ALREADY_LINKED' ? p.alreadyLinked : e
    },
    [v, p]
  )

  useEffect(() => {
    window.devforge.vercel
      .account()
      .then(setAcc)
      .catch(err => setError(say(err)))
  }, [say])

  useEffect(() => {
    if (!acc?.connected) return
    window.devforge.vercel
      .scopes()
      .then(setScopes)
      .catch(err => setError(say(err)))
  }, [acc?.connected, say])

  const load = useCallback(async () => {
    setError('')
    try {
      const [projects, deployments, domains] = await Promise.all([
        window.devforge.vercel.accountProjects(scope),
        window.devforge.vercel.accountDeployments(scope),
        window.devforge.vercel.accountDomains(scope).catch(() => 'failed' as const)
      ])
      setData({ projects, deployments, domains })
    } catch (err) {
      setError(say(err))
    }
  }, [scope, say])

  useEffect(() => {
    if (!acc?.connected) return
    setData(null)
    load()
  }, [acc?.connected, load, round])

  // A build in progress is followed every 5 s, while the window is visible
  const building = data?.deployments.some(d => isBuilding(d.state))
  useEffect(() => {
    if (!building) return
    return visibleInterval(() => {
      window.devforge.vercel
        .accountDeployments(scope)
        .then(deployments => setData(d => (d ? { ...d, deployments } : d)))
        .catch(() => {})
    }, 5000)
  }, [building, scope])

  /** `row`: the deployment whose button goes away once done; the focus moves to its first button */
  async function act(key: string, confirmText: string, fn: () => Promise<unknown>, done: string, row?: string) {
    if (!(await confirmDialog(confirmText))) return
    setBusy(key)
    try {
      await fn()
      toast.show({ tone: 'success', title: done })
      await load()
      if (row) document.querySelector<HTMLButtonElement>(`[data-deployment="${CSS.escape(row)}"] button`)?.focus()
    } catch (err) {
      toast.show({ tone: 'error', title: say(err) })
    } finally {
      setBusy(null)
    }
  }

  async function showLogs(id: string) {
    if (logs?.id === id) return setLogs(null)
    setLogs({ id, text: null })
    try {
      setLogs({ id, text: await window.devforge.vercel.accountBuildLogs(scope, id) })
    } catch (err) {
      setLogs({ id, text: say(err) })
    }
  }

  async function link(target: VercelAccountProject, localId: string) {
    setBusy('link')
    try {
      await window.devforge.vercel.link(localId, scope, target.id)
      const name = local.find(x => x.id === localId)?.name ?? ''
      toast.show({ tone: 'success', title: p.linked.replace('{name}', target.name).replace('{local}', name) })
      setLinking(null)
      load()
    } catch (err) {
      toast.show({ tone: 'error', title: say(err) })
    } finally {
      setBusy(null)
    }
  }

  const deployments = useMemo(() => {
    const all = data?.deployments ?? []
    if (filter === 'production') return all.filter(d => d.target === 'production')
    if (filter === 'preview') return all.filter(d => d.target !== 'production')
    if (filter === 'failed') return all.filter(d => d.state === 'ERROR')
    return all
  }, [data, filter])

  // DevForge projects whose folder is not linked to a Vercel project yet
  const linkedIds = new Set((data?.projects ?? []).map(x => x.local?.id).filter(Boolean))
  const free = local.filter(x => !linkedIds.has(x.id) && x.framework !== 'group')

  const actions = (d: VercelAccountDeployment) => (
    <>
      <DeploymentActions
        d={d}
        busy={busy}
        onLogs={() => showLogs(d.id)}
        onCancel={() => act(`cancel-${d.id}`, p.cancelConfirm, () => window.devforge.vercel.cancel(scope, d.id), p.cancelled, d.id)}
        onPromote={() => act(`promote-${d.id}`, v.promoteConfirm, () => window.devforge.vercel.promoteIn(scope, d.projectId, d.id), v.promoted, d.id)}
        readLogs={() => window.devforge.vercel.accountBuildLogs(scope, d.id)}
      />
      {logs?.id === d.id && (
        <LogBox text={logs.text ?? ''} placeholder={logs.text === null ? '…' : v.noLogs} follow={false} label={v.buildLogs} className="mt-1.5" />
      )}
    </>
  )

  const header = (
    <PageHeader
      crumb={t.nav.groupOnline}
      title={
        <span className="flex items-center gap-2.5">
          <Logo /> Vercel
        </span>
      }
      subtitle={p.subtitle}
      actions={
        acc?.connected && (
          <>
            {scopes && (
              <Select aria-label={p.scope} value={scope ?? ''} onChange={e => setScope(e.target.value || null)} className="w-auto min-w-[180px]">
                <option value="">{p.personal.replace('{user}', scopes.username)}</option>
                {scopes.teams.map(x => (
                  <option key={x.id} value={x.id}>
                    {x.name}
                  </option>
                ))}
              </Select>
            )}
            <Button variant="secondary" onClick={() => setRound(r => r + 1)}>
              <RefreshCw size={14} /> {p.refresh}
            </Button>
          </>
        )
      }
    />
  )

  if (!acc && !error)
    return (
      <Page>
        {header}
        <CardSkeleton rows={2} />
      </Page>
    )
  if (acc && !acc.connected)
    return (
      <Page>
        {header}
        <VercelConnect onConnected={setAcc} />
      </Page>
    )

  const domains = data?.domains
  const count = (n: number | undefined) => (n === undefined ? undefined : <span className="ml-1.5 font-mono text-xs text-fg-muted">{n}</span>)

  return (
    <Page>
      {header}
      {error ? (
        <ErrorState error={error} onRetry={() => setRound(r => r + 1)} />
      ) : (
        <>
          <Tabs
            variant="underline"
            label={p.tabs}
            value={tab}
            onChange={setTab}
            items={[
              {
                value: 'projects',
                label: (
                  <>
                    {p.projects}
                    {count(data?.projects.length)}
                  </>
                )
              },
              {
                value: 'deployments',
                label: (
                  <>
                    {p.deployments}
                    {count(data?.deployments.length)}
                  </>
                )
              },
              {
                value: 'domains',
                label: (
                  <>
                    {p.domains}
                    {count(Array.isArray(domains) ? domains.length : undefined)}
                  </>
                )
              }
            ]}
          />

          {!data ? (
            <CardSkeleton rows={3} />
          ) : tab === 'projects' ? (
            <div className="flex flex-wrap items-start gap-5">
              <section aria-label={p.projects} className="grid min-w-0 flex-[999_1_520px] grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-3.5">
                {/* The cards' own titles are h3: the section is named for the outline too */}
                <h2 className="sr-only">{p.projects}</h2>
                {data.projects.length === 0 ? (
                  <EmptyState title={p.noProjects} className="col-span-full" />
                ) : (
                  data.projects.map(x => <ProjectCard key={x.id} project={x} onLink={() => setLinking(x)} onOpenLocal={id => navigate(`/project/${id}`)} />)
                )}
              </section>
              <Card className="flex min-w-0 flex-[1_1_340px] flex-col p-4">
                <h2 className="mb-1.5 font-display text-md font-bold tracking-[-.01em] text-fg">{p.recent}</h2>
                {data.deployments.length === 0 ? (
                  <EmptyState title={p.noDeployments} />
                ) : (
                  data.deployments.slice(0, 8).map(d => (
                    <DeploymentLine key={d.id} d={d}>
                      {actions(d)}
                    </DeploymentLine>
                  ))
                )}
              </Card>
            </div>
          ) : tab === 'deployments' ? (
            <Card className="flex flex-col p-4">
              <Tabs
                label={p.filters}
                value={filter}
                onChange={setFilter}
                className="mb-2 self-start"
                items={[
                  { value: 'all', label: p.all },
                  { value: 'production', label: p.productionOnly },
                  { value: 'preview', label: p.previews },
                  { value: 'failed', label: p.failed }
                ]}
              />
              {deployments.length === 0 ? (
                <EmptyState title={filter === 'failed' ? p.noFailed : p.noDeployments} />
              ) : (
                deployments.map(d => (
                  <DeploymentLine key={d.id} d={d}>
                    {actions(d)}
                  </DeploymentLine>
                ))
              )}
            </Card>
          ) : domains === 'failed' ? (
            <ErrorState onRetry={() => setRound(r => r + 1)} />
          ) : !domains ? (
            <LinesSkeleton lines={3} />
          ) : domains.length === 0 ? (
            <EmptyState title={p.noDomains} />
          ) : (
            <section aria-label={p.domains} className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-3.5">
              {domains.map(d => (
                <DomainCard key={d.name} d={d} />
              ))}
            </section>
          )}
        </>
      )}
      {linking && <LinkDialog project={linking} free={free} busy={busy === 'link'} onLink={id => link(linking, id)} onClose={() => setLinking(null)} />}
    </Page>
  )
}
