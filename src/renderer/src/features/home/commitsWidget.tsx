import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowUp } from 'lucide-react'
import type { ActivityData } from '@shared/types'
import { commitsByWeek, toFollow } from '@shared/lib/activity'
import { useI18n } from '@renderer/i18n/I18nContext'
import Spinner from '@renderer/components/ui/Spinner'
import { SmallButton, Tile } from './parts'

/** v3.8 lot 3: this week's commits (mine) and the branches to push; the Activity page has the rest */
export function CommitsWidget({ i }: { i: number }) {
  const { t } = useI18n()
  const k = t.activity
  const navigate = useNavigate()
  const [data, setData] = useState<ActivityData | null>(null)
  useEffect(() => { window.devforge.activity.get().then(setData).catch(() => {}) }, [])

  const weeks = data ? commitsByWeek(data.projects, Math.floor(Date.now() / 1000), c => !data.me || c.email === data.me) : []
  const week = weeks[weeks.length - 1]
  const max = Math.max(1, ...weeks.map(w => w.total))
  const push = data ? toFollow(data.projects).filter(p => p.ahead > 0) : []
  const nameOf = (id: string) => data?.projects.find(p => p.id === id)?.name ?? id

  return (
    <Tile i={i} title={t.home.widgets.names.commits} aside={<SmallButton onClick={() => navigate('/activity')}>{k.seeAll}</SmallButton>}>
      {!data ? <Spinner /> : (
        <div className="flex flex-col gap-3" data-testid="commits-widget">
          <div className="flex items-end gap-4">
            <div>
              <div className="text-[28px] leading-none font-semibold text-fg">{week.total}</div>
              <div className="mt-1 text-xs text-fg-muted">{k.thisWeek}</div>
            </div>
            <div className="flex h-10 flex-1 items-end gap-[3px]" aria-hidden>
              {weeks.map(w => <div key={w.start} className="flex-1 rounded-t-[2px] bg-accent/70" style={{ height: `${Math.max(2, (w.total / max) * 40)}px`, opacity: w.total ? 1 : 0.25 }} />)}
            </div>
          </div>
          {week.total > 0 && (
            <p className="truncate text-xs text-fg-secondary">
              {Object.entries(week.byProject).sort((a, b) => b[1] - a[1]).map(([id, n]) => `${nameOf(id)} ${n}`).join(' · ')}
            </p>
          )}
          {push.length > 0 && (
            <ul className="flex flex-col gap-1 text-sm">
              {push.slice(0, 3).map(p => (
                <li key={p.id} className="flex items-center gap-2">
                  <span className="min-w-0 flex-1 truncate text-fg">{p.name}</span>
                  <span className="flex items-center gap-0.5 font-mono text-xs text-accent"><ArrowUp size={11} />{k.toPush.replace('{n}', String(p.ahead))}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </Tile>
  )
}
