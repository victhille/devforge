import { useCallback, useEffect, useState, type CSSProperties } from 'react'
import { CheckCircle2, CircleDashed, CircleSlash, ExternalLink, GitPullRequest, KeyRound, Loader2, RefreshCw, RotateCcw, Tag, XCircle } from 'lucide-react'
import type { GithubRepo, GithubRun, GithubStatus } from '@shared/types'
import { useI18n } from '@renderer/i18n/I18nContext'
import { useToast } from '@renderer/app/ToastContext'
import { cn } from '@renderer/lib/cn'
import { formatRelative } from '@renderer/lib/format'
import Button from '@renderer/components/ui/Button'
import Card from '@renderer/components/ui/Card'
import IconButton from '@renderer/components/ui/IconButton'
import { Input } from '@renderer/components/ui/Input'
import Spinner from '@renderer/components/ui/Spinner'

const errorText = (err: unknown) => String(err instanceof Error ? err.message : err).replace(/^Error invoking remote method '[^']+': (Error: )?/, '')
/** While a run is going, the panel looks again this often */
const LIVE_MS = 20_000

function RunIcon({ run }: { run: GithubRun }) {
  if (run.status !== 'completed') return <Loader2 size={16} className="shrink-0 animate-spin text-warning" />
  if (run.conclusion === 'success') return <CheckCircle2 size={16} className="shrink-0 text-success" />
  if (run.conclusion === 'failure' || run.conclusion === 'timed_out') return <XCircle size={16} className="shrink-0 text-danger" />
  if (run.conclusion === 'cancelled' || run.conclusion === 'skipped') return <CircleSlash size={16} className="shrink-0 text-fg-muted" />
  return <CircleDashed size={16} className="shrink-0 text-fg-muted" />
}

/** Project page → GitHub: Actions runs (re-run the failed ones), open pull requests, releases */
export default function GithubPanel({ projectPath, repo }: { projectPath: string; repo: GithubRepo }) {
  const { t, lang } = useI18n()
  const g = t.hub.github
  const toast = useToast()
  const [st, setSt] = useState<GithubStatus | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [token, setToken] = useState('')
  const [busy, setBusy] = useState<number | 'token' | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try { setSt(await window.devforge.github.status(projectPath)); setError('') } catch (err) { setError(errorText(err)) } finally { setLoading(false) }
  }, [projectPath])
  useEffect(() => { load() }, [load])
  // A run in progress: follow it
  const live = !!st?.runs.some(r => r.status !== 'completed')
  useEffect(() => {
    if (!live) return
    const id = setInterval(() => { if (document.visibilityState === 'visible') load() }, LIVE_MS)
    return () => clearInterval(id)
  }, [live, load])

  async function saveToken() {
    setBusy('token')
    try { const r = await window.devforge.github.saveToken(token); setToken(''); toast.show({ tone: 'success', title: g.tokenSaved.replace('{login}', r.login ?? '') }); load() }
    catch (err) { toast.show({ tone: 'error', title: errorText(err) === 'BAD_TOKEN' ? g.badToken : errorText(err) }) }
    finally { setBusy(null) }
  }

  if (error === 'NO_TOKEN' || error === 'BAD_TOKEN') {
    return (
      <Card className="flex max-w-2xl flex-col gap-3 p-5">
        <h3 className="text-md font-semibold text-fg">{g.connectTitle}</h3>
        <p className="text-[13px] text-fg-secondary">{error === 'BAD_TOKEN' ? g.badToken : g.connectHint}</p>
        <code className="self-start rounded-md border border-line-subtle bg-console px-2 py-1 font-mono text-xs text-fg">gh auth login</code>
        <p className="text-[13px] text-fg-secondary">{g.tokenHint}</p>
        <form className="flex gap-2" onSubmit={e => { e.preventDefault(); if (token.trim()) saveToken() }}>
          <Input type="password" value={token} onChange={e => setToken(e.target.value)} placeholder={g.tokenPlaceholder} aria-label={g.tokenPlaceholder} className="font-mono" autoComplete="off" />
          <Button type="submit" disabled={!token.trim()} loading={busy === 'token'}>{busy !== 'token' && <KeyRound size={14} />} {g.saveToken}</Button>
        </form>
        <Button variant="ghost" className="self-start" onClick={load}><RefreshCw size={14} /> {g.retry}</Button>
      </Card>
    )
  }
  if (error) return <Card className="flex items-center gap-3 p-[18px] text-sm text-danger"><span className="flex-1">{error === 'NOT_FOUND' ? g.notFound : error}</span><Button size="sm" variant="ghost" onClick={load}>{g.retry}</Button></Card>
  if (!st) return <Spinner />

  const base = `https://github.com/${repo.owner}/${repo.repo}`
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <span className="font-mono text-sm text-fg">{repo.owner}/{repo.repo}</span>
        <span className="text-xs text-fg-muted">{st.auth === 'gh' ? g.viaGh : g.viaToken}</span>
        <div className="ml-auto flex gap-2">
          <Button variant="ghost" onClick={() => window.devforge.openExternal(base)}><ExternalLink size={14} /> {g.openRepo}</Button>
          <Button variant="secondary" loading={loading} onClick={load}>{!loading && <RefreshCw size={14} />} {g.refresh}</Button>
        </div>
      </div>

      <Card className="df-rise overflow-hidden">
        <h3 className="px-[18px] pt-4 pb-2 text-md font-semibold text-fg">{g.actions}</h3>
        {st.runs.length === 0 ? <p className="px-[18px] pb-4 text-sm text-fg-muted">{g.noRuns}</p> : st.runs.map(r => (
          <div key={r.id} className="flex items-center gap-3 border-t border-line-subtle px-[18px] py-2.5">
            <RunIcon run={r} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium text-fg">{r.title}</div>
              <div className="truncate text-xs text-fg-muted">{r.name} #{r.number} · {r.branch} · {formatRelative(r.createdAt, lang)}</div>
            </div>
            <span className={cn('shrink-0 rounded-full px-2 py-0.5 font-mono text-[11px]',
              r.status !== 'completed' ? 'bg-warning-soft text-warning' : r.conclusion === 'success' ? 'bg-success-soft text-success' : r.conclusion === 'failure' ? 'bg-danger-soft text-danger' : 'bg-active text-fg-secondary')}>
              {r.status !== 'completed' ? g.running : g.conclusion[r.conclusion as keyof typeof g.conclusion] ?? r.conclusion ?? '—'}
            </span>
            {r.status === 'completed' && r.conclusion === 'failure' && (
              <Button size="sm" variant="secondary" loading={busy === r.id} onClick={async () => {
                setBusy(r.id)
                try { await window.devforge.github.rerun(projectPath, r.id); toast.show({ tone: 'success', title: g.rerunStarted }); load() } catch (err) { toast.show({ tone: 'error', title: errorText(err) }) } finally { setBusy(null) }
              }}>{busy !== r.id && <RotateCcw size={13} />} {g.rerun}</Button>
            )}
            <IconButton title={g.openRun} onClick={() => window.devforge.openExternal(r.url)}><ExternalLink size={14} /></IconButton>
          </div>
        ))}
      </Card>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card className="df-rise self-start overflow-hidden" style={{ '--i': 1 } as CSSProperties}>
          <h3 className="px-[18px] pt-4 pb-2 text-md font-semibold text-fg">{g.pulls}{st.pulls.length > 0 && <span className="ml-2 font-mono text-xs text-fg-muted">{st.pulls.length}</span>}</h3>
          {st.pulls.length === 0 ? <p className="px-[18px] pb-4 text-sm text-fg-muted">{g.noPulls}</p> : st.pulls.map(p => (
            <button key={p.number} onClick={() => window.devforge.openExternal(p.url)} className="flex w-full items-center gap-3 border-t border-line-subtle px-[18px] py-2.5 text-left hover:bg-hover">
              <GitPullRequest size={15} className={cn('shrink-0', p.draft ? 'text-fg-muted' : 'text-success')} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm text-fg">#{p.number} {p.title}</div>
                <div className="truncate text-xs text-fg-muted">{p.author} · {p.branch} · {formatRelative(p.createdAt, lang)}{p.draft ? ` · ${g.draft}` : ''}</div>
              </div>
            </button>
          ))}
        </Card>
        <Card className="df-rise self-start overflow-hidden" style={{ '--i': 2 } as CSSProperties}>
          <h3 className="px-[18px] pt-4 pb-2 text-md font-semibold text-fg">{g.releases}</h3>
          {st.releases.length === 0 ? <p className="px-[18px] pb-4 text-sm text-fg-muted">{g.noReleases}</p> : st.releases.map(r => (
            <button key={r.tag} onClick={() => window.devforge.openExternal(r.url)} className="flex w-full items-center gap-3 border-t border-line-subtle px-[18px] py-2.5 text-left hover:bg-hover">
              <Tag size={15} className="shrink-0 text-fg-muted" />
              <span className="min-w-0 flex-1 truncate text-sm text-fg">{r.name}</span>
              {(r.prerelease || r.draft) && <span className="rounded-md bg-active px-1.5 py-0.5 text-2xs text-fg-secondary">{r.draft ? g.draft : g.prerelease}</span>}
              <span className="shrink-0 font-mono text-xs text-fg-muted">{r.publishedAt ? formatRelative(r.publishedAt, lang) : '—'}</span>
            </button>
          ))}
        </Card>
      </div>
    </div>
  )
}
