import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowDown, ArrowUp, RefreshCw } from 'lucide-react'
import type { ActivityData } from '@shared/types'
import { asleep, commitsByWeek, mostActive, toFollow, WEEKS } from '@shared/lib/activity'
import { folderName, folderOf, projectFolders } from '@shared/lib/projectFolders'
import { useI18n } from '@renderer/i18n/I18nContext'
import { cn } from '@renderer/lib/cn'
import Button from '@renderer/components/ui/Button'
import Card from '@renderer/components/ui/Card'
import Spinner from '@renderer/components/ui/Spinner'
import { Page } from '@renderer/components/ui/Page'

/** The bars' colours: the most active projects, then "others" */
const COLORS = ['var(--color-accent)', 'var(--color-success)', 'var(--color-warning)', 'var(--syntax-keyword)']
const OTHERS = 'var(--color-fg-muted)'

/**
 * v3.8 lot 3 (piste A): commits across all projects over 12 weeks, the most
 * active, those asleep, the branches to push or pull. Read from Git on this PC.
 */
export default function ActivityPage() {
  const { t, lang } = useI18n()
  const k = t.activity
  const navigate = useNavigate()
  const [data, setData] = useState<ActivityData | null>(null)
  const [loading, setLoading] = useState(false)
  const [mine, setMine] = useState(true)
  const [folders, setFolders] = useState<string[]>([])
  const [place, setPlace] = useState('all')

  const load = (fresh = false) => {
    setLoading(true)
    window.devforge.activity.get(fresh).then(setData).catch(() => {}).finally(() => setLoading(false))
  }
  useEffect(() => { load(); window.devforge.getSettings().then(s => setFolders(projectFolders(s))).catch(() => {}) }, [])

  const now = Math.floor(Date.now() / 1000)
  const projects = useMemo(() => (data?.projects ?? []).filter(p => place === 'all' || folderOf(p.path, folders) === place), [data, place, folders])
  const keep = (c: { email: string }) => !mine || !data?.me || c.email === data.me
  const weeks = useMemo(() => commitsByWeek(projects, now, keep), [projects, mine, data]) // eslint-disable-line react-hooks/exhaustive-deps
  const active = useMemo(() => mostActive(projects, now, 30, keep), [projects, mine, data]) // eslint-disable-line react-hooks/exhaustive-deps
  const total = weeks.reduce((n, w) => n + w.total, 0)
  // The colours go to the most active over the 12 weeks
  const top = useMemo(() => {
    const sums = new Map<string, number>()
    for (const w of weeks) for (const [id, n] of Object.entries(w.byProject)) sums.set(id, (sums.get(id) ?? 0) + n)
    return [...sums].sort((a, b) => b[1] - a[1]).slice(0, COLORS.length).map(([id]) => id)
  }, [weeks])
  const nameOf = (id: string) => data?.projects.find(p => p.id === id)?.name ?? id
  const max = Math.max(1, ...weeks.map(w => w.total))
  const dateOf = (s: number) => new Date(s * 1000).toLocaleDateString(lang, { day: '2-digit', month: '2-digit' })

  return (
    <Page className="gap-5">
      <header className="flex flex-wrap items-end gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="text-[26px] font-semibold tracking-tight text-fg">{k.title}</h1>
          <p className="mt-1 text-[13px] text-fg-secondary">{k.subtitle}</p>
        </div>
        <Button variant="secondary" size="sm" loading={loading} onClick={() => load(true)}>{!loading && <RefreshCw size={13} />} {t.common.refresh}</Button>
      </header>

      <div className="flex flex-wrap items-center gap-1.5">
        {folders.length > 1 && ['all', ...folders].map(dir => (
          <button key={dir} aria-pressed={place === dir} onClick={() => setPlace(dir)} title={dir === 'all' ? undefined : dir}
            className={cn('h-[30px] rounded-full border px-3 text-[12.5px] font-medium', place === dir ? 'border-accent/40 bg-active text-fg' : 'border-line bg-surface text-fg-secondary hover:text-fg')}>
            {dir === 'all' ? t.projects.allFolders : folderName(dir)}
          </button>
        ))}
        {data?.me && (
          <span role="group" aria-label={k.author} className="ml-auto flex rounded-full border border-line p-0.5 text-xs">
            {[true, false].map(v => (
              <button key={String(v)} aria-pressed={mine === v} onClick={() => setMine(v)} title={v ? data.me ?? undefined : undefined}
                className={cn('rounded-full px-3 py-1', mine === v ? 'bg-active text-fg' : 'text-fg-secondary hover:text-fg')}>{v ? k.mine : k.everyone}</button>
            ))}
          </span>
        )}
      </div>

      {!data ? <Spinner className="m-6" /> : (
        <>
          <Card className="flex flex-col gap-3 p-[18px]">
            <div className="flex items-baseline gap-2.5">
              <h2 className="text-md font-semibold text-fg">{k.perWeek}</h2>
              <span className="text-xs text-fg-muted">{k.perWeekTotal.replace('{weeks}', String(WEEKS)).replace('{n}', String(total))}</span>
            </div>
            <div className="flex h-[200px] items-end gap-2" role="img" aria-label={k.chartLabel.replace('{n}', String(total))} data-testid="activity-chart">
              {weeks.map(w => {
                const others = w.total - top.reduce((n, id) => n + (w.byProject[id] ?? 0), 0)
                const parts = [...top.map((id, i) => ({ n: w.byProject[id] ?? 0, color: COLORS[i] })), { n: others, color: OTHERS }].filter(x => x.n > 0)
                const tip = `${k.weekOf.replace('{date}', dateOf(w.start))} · ${w.total}${w.total ? ` — ${Object.entries(w.byProject).map(([id, n]) => `${nameOf(id)} ${n}`).join(', ')}` : ''}`
                return (
                  <div key={w.start} className="flex h-full flex-1 flex-col items-center justify-end gap-1" title={tip}>
                    <div className="flex w-full max-w-[56px] flex-col-reverse gap-[2px]" style={{ height: `${(w.total / max) * 170}px` }}>
                      {parts.map((part, j) => <div key={j} className="w-full rounded-[4px]" style={{ flex: part.n, background: part.color }} />)}
                    </div>
                    <span className="font-mono text-[10.5px] text-fg-muted">{dateOf(w.start)}</span>
                  </div>
                )
              })}
            </div>
            {top.length > 0 && (
              <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-fg-secondary" aria-label={k.legend}>
                {top.map((id, i) => <li key={id} className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm" style={{ background: COLORS[i] }} />{nameOf(id)}</li>)}
                <li className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm" style={{ background: OTHERS }} />{k.others}</li>
              </ul>
            )}
          </Card>

          <div className="flex flex-wrap gap-4">
            <Card className="min-w-[280px] flex-1 p-[18px]" data-testid="most-active">
              <h2 className="mb-2 text-md font-semibold text-fg">{k.mostActive}</h2>
              {active.length === 0 ? <p className="text-sm text-fg-muted">{k.noneActive}</p> : (
                <ul className="flex flex-col gap-1.5 text-sm">
                  {active.slice(0, 6).map(p => (
                    <li key={p.id} className="flex items-center gap-3">
                      <button onClick={() => navigate(`/project/${p.id}`)} className="min-w-0 flex-1 truncate text-left text-fg hover:text-accent">{p.name}</button>
                      <span className="font-mono text-xs text-fg-muted">{k.commits.replace('{n}', String(p.commits))}</span>
                      <span className="w-16 text-right font-mono text-xs text-success">+{p.added.toLocaleString(lang)}</span>
                      <span className="w-14 text-right font-mono text-xs text-danger">−{p.removed.toLocaleString(lang)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
            <Card className="min-w-[240px] flex-1 p-[18px]" data-testid="asleep">
              <h2 className="mb-2 text-md font-semibold text-fg">{k.asleep}</h2>
              {asleep(projects, now).length === 0 ? <p className="text-sm text-fg-muted">{k.noneAsleep}</p> : (
                <ul className="flex flex-col gap-1.5 text-sm">
                  {asleep(projects, now).slice(0, 8).map(p => (
                    <li key={p.id} className="flex items-center gap-3">
                      <button onClick={() => navigate(`/project/${p.id}`)} className="min-w-0 flex-1 truncate text-left text-fg hover:text-accent">{p.name}</button>
                      <span className="text-xs text-fg-muted">{k.since.replace('{date}', new Date(p.lastCommitAt! * 1000).toLocaleDateString(lang))}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
            <Card className="min-w-[260px] flex-1 p-[18px]" data-testid="to-follow">
              <h2 className="mb-2 text-md font-semibold text-fg">{k.branches}</h2>
              {toFollow(projects).length === 0 ? <p className="text-sm text-fg-muted">{k.noneToFollow}</p> : (
                <ul className="flex flex-col gap-1.5 text-sm">
                  {toFollow(projects).map(p => (
                    <li key={p.id} className="flex items-center gap-3">
                      <button onClick={() => navigate(`/project/${p.id}?tab=git`)} className="min-w-0 flex-1 truncate text-left text-fg hover:text-accent">
                        {p.name} · <span className="font-mono text-xs text-fg-secondary">{p.branch}</span>
                      </button>
                      {p.ahead > 0 && <span className="flex items-center gap-0.5 font-mono text-xs text-accent"><ArrowUp size={11} />{k.toPush.replace('{n}', String(p.ahead))}</span>}
                      {p.behind > 0 && <span className="flex items-center gap-0.5 font-mono text-xs text-warning"><ArrowDown size={11} />{k.toPull.replace('{n}', String(p.behind))}</span>}
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
        </>
      )}
    </Page>
  )
}
