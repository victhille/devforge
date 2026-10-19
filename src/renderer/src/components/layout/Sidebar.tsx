import { useEffect } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { ChevronRight, PanelLeftClose, PanelLeftOpen, type LucideIcon } from 'lucide-react'
import { useI18n } from '@renderer/i18n/I18nContext'
import { cn } from '@renderer/lib/cn'
import { usePersistentState } from '@renderer/hooks/usePersistentState'
import { FAVORITES, HOME, LISTED_PAGES, MENU_GROUPS, groupOf, type GroupKey, type NavKey } from '@renderer/app/navigation'

const ENTRIES = [HOME, ...LISTED_PAGES]
const entry = (path: string) => ENTRIES.find(p => p.path === path)!

/** Top-level link: favorites and Settings, with an icon */
function NavEntry({ to, label, Icon, collapsed }: { to: string; label: string; Icon: LucideIcon; collapsed: boolean }) {
  return (
    <NavLink
      to={to}
      end={to === '/'}
      title={collapsed ? label : undefined}
      aria-label={label}
      className={({ isActive }) => cn(
        'group relative flex h-[34px] shrink-0 items-center rounded-[9px] text-base transition-colors',
        collapsed ? 'justify-center px-0' : 'gap-2.5 px-2.5',
        isActive ? 'bg-active font-medium text-fg' : 'text-fg-secondary hover:bg-hover hover:text-fg'
      )}
    >
      {({ isActive }) => (
        <>
          <span className={cn('absolute top-2 bottom-2 -left-2.5 w-[3px] rounded-r-full bg-accent transition-opacity', isActive ? 'opacity-100' : 'opacity-0')} />
          <Icon size={17} strokeWidth={1.8} className={cn('shrink-0 transition-colors', isActive ? 'text-accent' : 'text-fg-muted group-hover:text-fg-secondary')} />
          {!collapsed && <span className="truncate">{label}</span>}
        </>
      )}
    </NavLink>
  )
}

/** A folding group: header, then its pages without icons */
function NavGroup({ group, open, collapsed, onToggle }: {
  group: (typeof MENU_GROUPS)[number]
  open: boolean
  collapsed: boolean
  onToggle: () => void
}) {
  const { t } = useI18n()
  const { pathname } = useLocation()
  const holdsActive = groupOf(pathname) === group.key
  const label = t.nav[group.key]
  const Icon = group.icon
  // The group shows it holds the current page when its list is hidden
  const marked = holdsActive && (collapsed || !open)

  return (
    <div className="flex flex-col gap-0.5">
      <button
        onClick={onToggle}
        aria-expanded={!collapsed && open}
        title={collapsed ? label : undefined}
        aria-label={label}
        className={cn(
          'group relative flex h-[34px] shrink-0 items-center rounded-[9px] text-base transition-colors',
          collapsed ? 'justify-center px-0' : 'gap-2.5 px-2.5',
          marked ? 'bg-active text-fg' : open || holdsActive ? 'text-fg hover:bg-hover' : 'text-fg-secondary hover:bg-hover hover:text-fg'
        )}
      >
        <span className={cn('absolute top-2 bottom-2 -left-2.5 w-[3px] rounded-r-full bg-accent transition-opacity', marked ? 'opacity-100' : 'opacity-0')} />
        <Icon size={17} strokeWidth={1.8} className={cn('shrink-0', marked ? 'text-accent' : 'text-fg-muted group-hover:text-fg-secondary')} />
        {!collapsed && (
          <>
            <span className="flex-1 truncate text-left">{label}</span>
            <span className="font-mono text-2xs text-fg-muted">{group.paths.length}</span>
            <ChevronRight size={13} strokeWidth={2.2} className={cn('shrink-0 text-fg-muted transition-transform duration-200', open && 'rotate-90')} />
          </>
        )}
      </button>

      {!collapsed && open && (
        <div className="df-pop mb-1.5 ml-[18px] flex flex-col gap-px border-l border-line pl-2.5">
          {group.paths.map(path => {
            const page = entry(path)
            return (
              <NavLink
                key={path}
                to={path}
                className={({ isActive }) => cn(
                  'flex h-[30px] items-center truncate rounded-lg px-2.5 text-[12.5px] font-medium transition-colors',
                  isActive ? 'bg-active text-fg' : 'text-fg-secondary hover:bg-hover hover:text-fg'
                )}
              >
                {t.nav[page.labelKey as NavKey]}
              </NavLink>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default function Sidebar() {
  const { t } = useI18n()
  const { pathname } = useLocation()
  const [collapsed, setCollapsed] = usePersistentState('devforge:sidebar-collapsed', false)
  const [openGroup, setOpenGroup] = usePersistentState<GroupKey | null>('devforge:sidebar-group', null)
  const settings = entry('/settings')

  // Going to a page opens its group, so the current page is always visible
  useEffect(() => {
    const g = groupOf(pathname)
    if (g) setOpenGroup(g)
  }, [pathname, setOpenGroup])

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

  const toggleGroup = (key: GroupKey) => {
    // In the icon rail, a group click unfolds the menu on that group
    if (collapsed) { setCollapsed(false); setOpenGroup(key) }
    else setOpenGroup(g => (g === key ? null : key))
  }

  return (
    <aside
      className={cn(
        'flex shrink-0 flex-col overflow-hidden border-r border-line-subtle bg-sidebar transition-[width] duration-200',
        collapsed ? 'w-[60px]' : 'w-[232px]'
      )}
    >
      <nav className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-x-hidden overflow-y-auto px-2.5 pt-3.5 pb-3">
        {!collapsed && (
          <span className="truncate px-2.5 pb-1.5 font-mono text-2xs font-medium uppercase tracking-widest text-fg-muted">
            {t.nav.favorites}
          </span>
        )}
        {FAVORITES.map(path => {
          const page = entry(path)
          return <NavEntry key={path} to={path} label={t.nav[page.labelKey]} Icon={page.icon} collapsed={collapsed} />
        })}

        <span className="mx-1 my-3 shrink-0 border-t border-line-subtle" />

        {MENU_GROUPS.map(group => (
          <NavGroup key={group.key} group={group} open={openGroup === group.key} collapsed={collapsed} onToggle={() => toggleGroup(group.key)} />
        ))}
      </nav>

      {/* Settings and the collapse toggle stay pinned at the bottom */}
      <div className="flex shrink-0 flex-col gap-0.5 border-t border-line-subtle px-2.5 py-2.5 shadow-[0_-12px_16px_-12px_var(--shadow-color)]">
        <NavEntry to={settings.path} label={t.nav.settings} Icon={settings.icon} collapsed={collapsed} />
        <button
          onClick={() => setCollapsed(c => !c)}
          title={`${collapsed ? t.nav.expand : t.nav.collapse} (Ctrl+B)`}
          aria-label={collapsed ? t.nav.expand : t.nav.collapse}
          className={cn(
            'flex h-[34px] items-center rounded-[9px] font-mono text-xs text-fg-muted transition-colors hover:bg-hover hover:text-fg',
            collapsed ? 'justify-center' : 'gap-2.5 px-2.5'
          )}
        >
          {collapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
          {!collapsed && <span>v{__APP_VERSION__} · {t.nav.collapse.toLowerCase()}</span>}
        </button>
      </div>
    </aside>
  )
}
