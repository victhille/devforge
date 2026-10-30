import { useNavigate } from 'react-router-dom'
import { useConsole } from '@renderer/app/ConsoleContext'
import { useI18n } from '@renderer/i18n/I18nContext'
import { cn } from '@renderer/lib/cn'
import { useCreationProgress } from './CreationProgress'

const R = 9
const LENGTH = 2 * Math.PI * R

/** Title bar: a ring with the creation's progress, from any page; a click goes back to it, with the console */
export default function CreationBadge() {
  const { t } = useI18n()
  const p = useCreationProgress()
  const { setMinimized } = useConsole()
  const navigate = useNavigate()
  if (!p?.shown) return null
  const label = (p.failed ? t.newProject.setup.badgeFailed : t.newProject.setup.badge)
    .replace('{name}', p.creation.name).replace('{at}', String(p.done)).replace('{n}', String(p.total))
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={() => { navigate('/new-project'); setMinimized(false) }}
      className="app-no-drag flex size-[30px] shrink-0 items-center justify-center rounded-full border border-line transition-colors hover:border-fg-disabled"
    >
      <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden className="-rotate-90">
        <circle cx="11" cy="11" r={R} fill="none" strokeWidth="2.5" className="stroke-line" />
        <circle cx="11" cy="11" r={R} fill="none" strokeWidth="2.5" strokeLinecap="round"
          strokeDasharray={LENGTH} strokeDashoffset={LENGTH * (1 - Math.max(0.06, p.ratio))}
          className={cn('transition-[stroke-dashoffset] duration-500', p.failed ? 'stroke-danger' : 'stroke-accent')} />
      </svg>
    </button>
  )
}
