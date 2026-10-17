import { NavLink } from 'react-router-dom'
import type { LucideIcon } from 'lucide-react'
import { useI18n } from '@renderer/i18n/I18nContext'
import { cn } from '@renderer/lib/cn'
import { HOME, LISTED_PAGES, SECTIONS } from '@renderer/app/navigation'

function NavEntry({ to, label, Icon }: { to: string; label: string; Icon: LucideIcon }) {
  return (
    <NavLink
      to={to}
      end={to === '/'}
      className={({ isActive }) => cn(
        'group relative flex h-9 items-center gap-3 rounded-lg px-3 text-base transition-colors',
        isActive
          ? 'bg-active font-medium text-fg'
          : 'text-fg-secondary hover:bg-hover hover:text-fg'
      )}
    >
      {({ isActive }) => (
        <>
          {/* Active indicator bar */}
          <span
            className={cn(
              'absolute top-2 bottom-2 -left-2.5 w-[3px] rounded-r-full bg-accent transition-opacity',
              isActive ? 'opacity-100' : 'opacity-0'
            )}
          />
          <Icon
            size={17}
            strokeWidth={isActive ? 2.2 : 1.8}
            className={cn('shrink-0 transition-colors', isActive ? 'text-accent' : 'text-fg-muted group-hover:text-fg-secondary')}
          />
          <span className="truncate">{label}</span>
        </>
      )}
    </NavLink>
  )
}

export default function Sidebar() {
  const { t } = useI18n()
  const settings = LISTED_PAGES.find(p => p.path === '/settings')!

  return (
    <aside className="flex w-[232px] shrink-0 flex-col overflow-hidden border-r border-line-subtle bg-surface">
      <nav className="flex flex-1 flex-col gap-5 overflow-y-auto px-2.5 py-4">
        {SECTIONS.map(section => (
          <div key={section} className="flex flex-col gap-0.5">
            <span className="px-3 pb-1.5 text-2xs font-semibold uppercase tracking-widest text-fg-muted">
              {t.nav[section]}
            </span>
            {section === 'sectionMain' && <NavEntry to={HOME.path} label={t.nav.home} Icon={HOME.icon} />}
            {LISTED_PAGES.filter(p => p.section === section).map(p => (
              <NavEntry key={p.path} to={p.path} label={t.nav[p.labelKey]} Icon={p.icon} />
            ))}
          </div>
        ))}
      </nav>

      {/* Settings pinned at the bottom, with the version */}
      <div className="flex flex-col gap-1.5 border-t border-line-subtle px-2.5 py-2.5">
        <NavEntry to={settings.path} label={t.nav.settings} Icon={settings.icon} />
        <span className="px-3 text-2xs text-fg-muted">v{__APP_VERSION__}</span>
      </div>
    </aside>
  )
}
