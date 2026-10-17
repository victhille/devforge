import { useEffect } from 'react'
import { NavLink } from 'react-router-dom'
import { PanelLeftClose, PanelLeftOpen, type LucideIcon } from 'lucide-react'
import { useI18n } from '@renderer/i18n/I18nContext'
import { cn } from '@renderer/lib/cn'
import { usePersistentState } from '@renderer/hooks/usePersistentState'
import { HOME, LISTED_PAGES, SECTIONS } from '@renderer/app/navigation'

function NavEntry({ to, label, Icon, collapsed }: { to: string; label: string; Icon: LucideIcon; collapsed: boolean }) {
  return (
    <NavLink
      to={to}
      end={to === '/'}
      title={collapsed ? label : undefined}
      aria-label={label}
      className={({ isActive }) => cn(
        'group relative flex h-9 items-center rounded-lg text-base transition-colors',
        collapsed ? 'justify-center px-0' : 'gap-3 px-3',
        isActive ? 'bg-active font-medium text-fg' : 'text-fg-secondary hover:bg-hover hover:text-fg'
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
          {!collapsed && <span className="truncate">{label}</span>}
        </>
      )}
    </NavLink>
  )
}

export default function Sidebar() {
  const { t } = useI18n()
  const [collapsed, setCollapsed] = usePersistentState('devforge:sidebar-collapsed', false)
  const settings = LISTED_PAGES.find(p => p.path === '/settings')!

  // Ctrl+B toggles the sidebar, like in most editors
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b' && !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)) {
        e.preventDefault()
        setCollapsed(c => !c)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [setCollapsed])

  return (
    <aside
      className={cn(
        'flex shrink-0 flex-col overflow-hidden border-r border-line-subtle bg-surface transition-[width] duration-200',
        collapsed ? 'w-[60px]' : 'w-[232px]'
      )}
    >
      <nav className={cn('flex flex-1 flex-col overflow-x-hidden overflow-y-auto py-4', collapsed ? 'gap-3 px-2' : 'gap-5 px-2.5')}>
        {SECTIONS.map((section, i) => (
          <div key={section} className="flex flex-col gap-0.5">
            {collapsed
              ? i > 0 && <span className="mx-2 mb-2 border-t border-line-subtle" />
              : (
                <span className="truncate px-3 pb-1.5 text-2xs font-semibold uppercase tracking-widest text-fg-muted">
                  {t.nav[section]}
                </span>
              )}
            {section === 'sectionMain' && <NavEntry to={HOME.path} label={t.nav.home} Icon={HOME.icon} collapsed={collapsed} />}
            {LISTED_PAGES.filter(p => p.section === section).map(p => (
              <NavEntry key={p.path} to={p.path} label={t.nav[p.labelKey]} Icon={p.icon} collapsed={collapsed} />
            ))}
          </div>
        ))}
      </nav>

      {/* Settings pinned at the bottom, version and collapse toggle */}
      <div className={cn('flex flex-col gap-1.5 border-t border-line-subtle py-2.5', collapsed ? 'px-2' : 'px-2.5')}>
        <NavEntry to={settings.path} label={t.nav.settings} Icon={settings.icon} collapsed={collapsed} />
        <div className={cn('flex items-center', collapsed ? 'justify-center' : 'justify-between pl-3')}>
          {!collapsed && <span className="text-2xs text-fg-muted">v{__APP_VERSION__}</span>}
          <button
            onClick={() => setCollapsed(c => !c)}
            title={`${collapsed ? t.nav.expand : t.nav.collapse} (Ctrl+B)`}
            aria-label={collapsed ? t.nav.expand : t.nav.collapse}
            className="flex size-8 items-center justify-center rounded-lg text-fg-muted transition-colors hover:bg-hover hover:text-fg"
          >
            {collapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
          </button>
        </div>
      </div>
    </aside>
  )
}
