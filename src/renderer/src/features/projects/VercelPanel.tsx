import { useCallback, useEffect, useState } from 'react'
import { ExternalLink, GitBranch, KeyRound, RotateCcw, ScrollText, Upload } from 'lucide-react'
import type { VercelAccount, VercelDeployment, VercelDomain, VercelEnvDiff, VercelProjectInfo } from '@shared/types'
import { useI18n } from '@renderer/i18n/I18nContext'
import { useToast } from '@renderer/app/ToastContext'
import { cn } from '@renderer/lib/cn'
import { formatRelative } from '@renderer/lib/format'
import Button from '@renderer/components/ui/Button'
import Card from '@renderer/components/ui/Card'
import { Input } from '@renderer/components/ui/Input'
import Spinner from '@renderer/components/ui/Spinner'

const errorText = (err: unknown) => String(err instanceof Error ? err.message : err).replace(/^Error invoking remote method '[^']+': (Error: )?/, '')

const STATE_TONE: Record<string, string> = {
  READY: 'bg-success-soft text-success', ERROR: 'bg-danger-soft text-danger', BUILDING: 'bg-warning-soft text-warning',
  QUEUED: 'bg-active text-fg-secondary', INITIALIZING: 'bg-warning-soft text-warning', CANCELED: 'bg-active text-fg-muted'
}

/** Project page → Vercel: deployments (redeploy, promote, build logs), env keys, domains */
export default function VercelPanel({ projectId }: { projectId: string }) {
  const { t, lang } = useI18n()
  const v = t.vercel
  const toast = useToast()
  const [acc, setAcc] = useState<VercelAccount | null>(null)
  const [token, setToken] = useState('')
  const [info, setInfo] = useState<VercelProjectInfo | null | undefined>(undefined)
  const [deps, setDeps] = useState<VercelDeployment[] | null>(null)
  const [env, setEnv] = useState<VercelEnvDiff | null>(null)
  const [domains, setDomains] = useState<VercelDomain[] | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [logs, setLogs] = useState<{ id: string; text: string | null } | null>(null)

  const say = (err: unknown) => {
    const e = errorText(err)
    return e === 'BAD_TOKEN' ? v.badToken : e === 'NOT_LINKED' ? v.notLinked : e
  }

  useEffect(() => { window.devforge.vercel.account().then(setAcc).catch(() => {}) }, [])

  const load = useCallback(async () => {
    setError('')
    try {
      const p = await window.devforge.vercel.project(projectId)
      setInfo(p)
      if (!p) return
      const [d, e, dm] = await Promise.all([
        window.devforge.vercel.deployments(projectId),
        window.devforge.vercel.env(projectId).catch(() => null),
        window.devforge.vercel.domains(projectId).catch(() => null)
      ])
      setDeps(d); setEnv(e); setDomains(dm)
    } catch (err) { setError(say(err)) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId])
  useEffect(() => { if (acc?.connected) load() }, [acc?.connected, load])

  // A build in progress is followed every 5 s
  const building = deps?.some(d => ['BUILDING', 'QUEUED', 'INITIALIZING'].includes(d.state))
  useEffect(() => {
    if (!building) return
    const id = setInterval(() => window.devforge.vercel.deployments(projectId).then(setDeps).catch(() => {}), 5000)
    return () => clearInterval(id)
  }, [building, projectId])

  async function connect() {
    setBusy('token')
    try { setAcc(await window.devforge.vercel.saveToken(token)); setToken('') }
    catch (err) { toast.show({ tone: 'error', title: say(err) }) }
    finally { setBusy(null) }
  }

  async function act(key: string, confirmText: string, fn: () => Promise<unknown>, done: string) {
    if (!window.confirm(confirmText)) return
    setBusy(key)
    try { await fn(); toast.show({ tone: 'success', title: done }); load() }
    catch (err) { toast.show({ tone: 'error', title: say(err) }) }
    finally { setBusy(null) }
  }

  async function showLogs(id: string) {
    if (logs?.id === id) { setLogs(null); return }
    setLogs({ id, text: null })
    try { setLogs({ id, text: await window.devforge.vercel.buildLogs(projectId, id) }) }
    catch (err) { setLogs({ id, text: say(err) }) }
  }

  if (!acc) return <Spinner />

  if (!acc.connected) {
    return (
      <Card className="flex max-w-xl flex-col gap-3 p-[18px]">
        <h2 className="text-md font-semibold text-fg">{v.connectTitle}</h2>
        <p className="text-sm text-fg-secondary">{v.connectHint}</p>
        <div className="flex gap-2">
          <Input type="password" value={token} onChange={e => setToken(e.target.value)} placeholder={v.tokenPlaceholder} aria-label={v.tokenPlaceholder} className="font-mono" autoComplete="off" />
          <Button disabled={!token.trim()} loading={busy === 'token'} onClick={connect}>{busy !== 'token' && <KeyRound size={14} />} {v.connect}</Button>
        </div>
      </Card>
    )
  }

  if (error) return <Card className="p-[18px] text-sm text-danger">{error}</Card>
  if (info === undefined) return <Spinner />
  if (info === null) return <Card className="p-[18px] text-sm text-fg-secondary">{v.notLinked}</Card>

  const fileLabel = env?.localFile ?? v.noLocalEnv
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <svg aria-hidden width="16" height="16" viewBox="0 0 24 24" className="fill-fg"><path d="M12 3l10 18H2z" /></svg>
            <h2 className="text-md font-semibold text-fg">{info.name}</h2>
            {info.framework && <span className="rounded-full bg-elevated px-2 py-0.5 font-mono text-[11px] text-fg-muted">{info.framework}</span>}
          </div>
          <div className="mt-0.5 text-xs text-fg-muted">{v.connectedAs.replace('{user}', acc.username ?? '?')} · <button className="hover:text-danger" onClick={async () => setAcc(await window.devforge.vercel.saveToken(null))}>{v.disconnect}</button></div>
        </div>
        {info.productionUrl && <Button size="sm" variant="secondary" onClick={() => window.devforge.openExternal(info.productionUrl!)}><ExternalLink size={13} /> {v.openSite}</Button>}
        <Button size="sm" variant="ghost" onClick={() => window.devforge.openExternal(`https://vercel.com/${acc.username ?? ''}/${info.name}`)}>{v.openDashboard}</Button>
      </div>

      <Card className="overflow-hidden">
        <h3 className="px-[18px] pt-4 pb-2 text-md font-semibold text-fg">{v.deployments}</h3>
        {!deps ? <div className="p-[18px]"><Spinner /></div> : deps.length === 0 ? <p className="px-[18px] pb-4 text-sm text-fg-muted">{v.noDeployments}</p> : deps.map(d => (
          <div key={d.id} className="border-t border-line-subtle">
            <div className="group flex flex-wrap items-center gap-3 px-[18px] py-3">
              <span className={cn('rounded-full px-2 py-0.5 font-mono text-[11px] font-medium', STATE_TONE[d.state] ?? 'bg-active text-fg-secondary')}>{v.states[d.state as keyof typeof v.states] ?? d.state.toLowerCase()}</span>
              <span className={cn('rounded-full px-2 py-0.5 font-mono text-[11px]', d.target === 'production' ? 'bg-accent-soft text-accent' : 'bg-elevated text-fg-muted')}>{d.target === 'production' ? v.production : v.preview}</span>
              {d.current && <span className="rounded-full bg-success-soft px-2 py-0.5 font-mono text-[11px] text-success">{v.current}</span>}
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm text-fg">{d.commitMessage ?? d.url.replace('https://', '')}</div>
                <div className="flex items-center gap-1.5 truncate font-mono text-[11.5px] text-fg-muted">
                  {d.branch && <><GitBranch size={11} /> {d.branch} · </>}{formatRelative(new Date(d.createdAt).toISOString(), lang)}{d.creator && ` · ${d.creator}`}
                </div>
              </div>
              <div className="flex gap-1 opacity-70 group-hover:opacity-100">
                <Button size="sm" variant="ghost" onClick={() => showLogs(d.id)}><ScrollText size={13} /> {v.buildLogs}</Button>
                <Button size="sm" variant="ghost" onClick={() => window.devforge.openExternal(d.url)}><ExternalLink size={13} /></Button>
                <Button size="sm" variant="secondary" loading={busy === `re-${d.id}`}
                  onClick={() => act(`re-${d.id}`, v.redeployConfirm, () => window.devforge.vercel.redeploy(projectId, d.id), v.redeployed)}>
                  {busy !== `re-${d.id}` && <RotateCcw size={13} />} {v.redeploy}
                </Button>
                {!d.current && d.state === 'READY' && (
                  <Button size="sm" variant="secondary" loading={busy === `pr-${d.id}`}
                    onClick={() => act(`pr-${d.id}`, v.promoteConfirm, () => window.devforge.vercel.promote(projectId, d.id), v.promoted)}>
                    {busy !== `pr-${d.id}` && <Upload size={13} />} {d.target === 'production' ? v.rollback : v.promote}
                  </Button>
                )}
              </div>
            </div>
            {logs?.id === d.id && (
              <pre className="mx-[18px] mb-3 max-h-80 overflow-auto rounded-[10px] bg-console px-4 py-3 font-mono text-xs leading-relaxed whitespace-pre-wrap break-all text-fg-secondary">
                {logs.text === null ? '…' : logs.text || v.noLogs}
              </pre>
            )}
          </div>
        ))}
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="flex flex-col gap-3 p-[18px]">
          <div>
            <h3 className="text-md font-semibold text-fg">{v.env}</h3>
            <p className="text-xs text-fg-muted">{v.envHint}</p>
          </div>
          {!env ? <Spinner /> : (
            <>
              {!env.missingRemote.length && !env.missingLocal.length && <p className="text-sm text-success">{v.envOk}</p>}
              {[[v.missingRemote, env.missingRemote, 'text-warning'], [v.missingLocal, env.missingLocal, 'text-fg-secondary']].map(([label, keys, tone]) => (keys as string[]).length > 0 && (
                <div key={label as string}>
                  <div className="mb-1.5 text-xs font-medium text-fg-secondary">{(label as string).replace('{file}', fileLabel)}</div>
                  <div className="flex flex-wrap gap-1.5">{(keys as string[]).map(k => <span key={k} className={cn('rounded-md border border-line bg-canvas px-2 py-0.5 font-mono text-[11.5px]', tone as string)}>{k}</span>)}</div>
                </div>
              ))}
              <div className="flex flex-col">
                {env.remote.map(e => (
                  <div key={e.key} className="flex items-center gap-2 border-t border-line-subtle py-1.5 text-[12.5px]">
                    <span className="flex-1 truncate font-mono text-fg">{e.key}</span>
                    {e.targets.map(tg => <span key={tg} className="rounded bg-elevated px-1.5 font-mono text-[10.5px] text-fg-muted">{tg}</span>)}
                  </div>
                ))}
              </div>
            </>
          )}
        </Card>
        <Card className="flex flex-col gap-3 self-start p-[18px]">
          <h3 className="text-md font-semibold text-fg">{v.domains}</h3>
          {!domains ? <Spinner /> : domains.length === 0 ? <p className="text-sm text-fg-muted">{v.noDomains}</p> : domains.map(d => (
            <div key={d.name} className="flex flex-wrap items-center gap-2 border-t border-line-subtle pt-2.5 first:border-t-0 first:pt-0">
              <button onClick={() => window.devforge.openExternal(`https://${d.name}`)} className="min-w-0 flex-1 truncate text-left font-mono text-[13px] text-fg hover:text-accent">{d.name}</button>
              {d.redirect && <span className="text-xs text-fg-muted">{v.redirect.replace('{to}', d.redirect)}</span>}
              <span className={cn('rounded-full px-2 py-0.5 font-mono text-[11px]', d.verified ? 'bg-success-soft text-success' : 'bg-warning-soft text-warning')}>{d.verified ? v.verified : v.notVerified}</span>
              {d.misconfigured !== null && (
                <span className={cn('rounded-full px-2 py-0.5 font-mono text-[11px]', d.misconfigured ? 'bg-danger-soft text-danger' : 'bg-success-soft text-success')}>{d.misconfigured ? v.misconfigured : v.certOk}</span>
              )}
            </div>
          ))}
        </Card>
      </div>
    </div>
  )
}
