import { useCallback, useEffect, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { ChevronRight, PanelLeftClose, PanelLeftOpen, RotateCcw, Star, type LucideIcon } from 'lucide-react'
import { useI18n } from '@renderer/i18n/I18nContext'
import { cn } from '@renderer/lib/cn'
import { usePersistentState } from '@renderer/hooks/usePersistentState'
import { DEFAULT_FAVORITES, HOME, LISTED_PAGES, MENU_GROUPS, groupOf, isListed, type GroupKey, type NavKey } from '@renderer/app/navigation'
import { useHasServer } from '@renderer/hooks/useHasServer'
import { MAX_FAVORITES } from '@shared/lib/favorites'

const ENTRIES = [HOME, ...LISTED_PAGES]
const entry = (path: string) => ENTRIES.find(p => p.path === path)!
const known = (path: string) => path !== '/' && ENTRIES.some(p => p.path === path)

/** The pinned pages, saved in the settings */
function useFavorites() {
  const [favorites, setLocal] = useState<string[]>(DEFAULT_FAVORITES)
  useEffect(() => { window.devforge.getSettings().then(s => setLocal(s.favorites ?? DEFAULT_FAVORITES)).catch(() => {}) }, [])
  const save = useCallback((next: string[]) => {
    setLocal(next)
    window.devforge.setFavorites(next).then(setLocal).catch(() => {})
  }, [])
  return [favorites, save] as const
}

/** ☆ shown on hover / focus: pins or unpins a page */
function PinButton({ pinned, full, onToggle }: { pinned: boolean; full: boolean; onToggle: () => void }) {
  const { t } = useI18n()
  const label = pinned ? t.nav.unpin : full ? t.nav.favoritesFull.replace('{max}', String(MAX_FAVORITES)) : t.nav.pin
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={pinned}
      disabled={!pinned && full}
      onClick={e => { e.preventDefault(); e.stopPropagation(); onToggle() }}
      className={cn(
        'absolute top-1/2 right-1.5 flex size-6 -translate-y-1/2 items-center justify-center rounded-md text-fg-muted opacity-0 transition-opacity',
        'group-hover/row:opacity-100 focus-visible:opacity-100 hover:bg-hover hover:text-fg disabled:cursor-not-allowed disabled:opacity-40',
        pinned && 'text-warning hover:text-warning'
      )}
    >
      <Star size={13} strokeWidth={2} fill={pinned ? 'currentColor' : 'none'} />
    </button>
  )
}

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
function NavGroup({ group, open, collapsed, onToggle, favorites, onPin, hasServer }: {
  group: (typeof MENU_GROUPS)[number]
  open: boolean
  collapsed: boolean
  onToggle: () => void
  favorites: string[]
  onPin: (path: string) => void
  hasServer: boolean
}) {
  const { t } = useI18n()
  const { pathname } = useLocation()
  const paths = group.paths.filter(p => isListed(p, hasServer))
  const waiting = group.paths.length - paths.length
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
            <span className="font-mono text-2xs text-fg-muted">{paths.length}</span>
            <ChevronRight size={13} strokeWidth={2.2} className={cn('shrink-0 text-fg-muted transition-transform duration-200', open && 'rotate-90')} />
          </>
        )}
      </button>

      {!collapsed && open && (
        <div className="df-pop mb-1.5 ml-[18px] flex flex-col gap-px border-l border-line pl-2.5">
          {paths.map(path => {
            const page = entry(path)
            const pinned = favorites.includes(path)
            return (
              <div key={path} className="group/row relative">
                <NavLink
                  to={path}
                  className={({ isActive }) => cn(
                    'flex h-[30px] items-center truncate rounded-lg pr-8 pl-2.5 text-[12.5px] font-medium transition-colors',
                    isActive ? 'bg-active text-fg' : 'text-fg-secondary hover:bg-hover hover:text-fg'
                  )}
                >
                  {t.nav[page.labelKey as NavKey]}
                </NavLink>
                <PinButton pinned={pinned} full={favorites.length >= MAX_FAVORITES} onToggle={() => onPin(path)} />
              </div>
            )
          })}
          {/* The server pages exist: say where they come from */}
          {waiting > 0 && (
            <NavLink to="/settings?section=connections"
              className="flex h-[26px] items-center truncate rounded-lg px-2.5 text-xs text-fg-muted transition-colors hover:bg-hover hover:text-fg">
              {t.nav.moreWithServer.replace('{n}', String(waiting))}
            </NavLink>
          )}
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
  const [favorites, saveFavorites] = useFavorites()
  const [dragged, setDragged] = useState<number | null>(null)
  const hasServer = useHasServer()
  const shown = favorites.filter(p => known(p) && isListed(p, hasServer))
  const isDefault = favorites.join() === DEFAULT_FAVORITES.join()

  const togglePin = (path: string) => saveFavorites(favorites.includes(path) ? favorites.filter(p => p !== path) : [...favorites, path])
  const move = (from: number, to: number) => {
    if (to < 0 || to >= shown.length || from === to) return
    const next = [...shown]
    next.splice(to, 0, ...next.splice(from, 1))
    // Favorites waiting for a server are kept
    saveFavorites([...next, ...favorites.filter(p => !next.includes(p))])
  }
  const onFavKey = (i: number) => (e: ReactKeyboardEvent) => {
    if (!e.altKey || (e.key !== 'ArrowUp' && e.key !== 'ArrowDown')) return
    e.preventDefault()
    const to = i + (e.key === 'ArrowUp' ? -1 : 1)
    move(i, to)
    // Focus follows the moved page
    requestAnimationFrame(() => document.querySelectorAll<HTMLElement>('[data-fav] a')[Math.max(0, Math.min(to, shown.length - 1))]?.focus())
  }

  // Going to a page opens its group, so the current page is always visible (a favorite already is)
  useEffect(() => {
    const g = groupOf(pathname)
    if (g && !favorites.some(p => pathname === p || pathname.startsWith(p + '/'))) setOpenGroup(g)
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
          <div className="group/head flex items-center justify-between px-2.5 pb-1.5">
            <span className="truncate font-mono text-2xs font-medium uppercase tracking-widest text-fg-muted">{t.nav.favorites}</span>
            {!isDefault && (
              <button type="button" title={t.nav.favoritesReset} aria-label={t.nav.favoritesReset} onClick={() => saveFavorites([...DEFAULT_FAVORITES])}
                className="flex size-5 items-center justify-center rounded text-fg-muted opacity-0 transition-opacity group-hover/head:opacity-100 focus-visible:opacity-100 hover:text-fg">
                <RotateCcw size={12} />
              </button>
            )}
          </div>
        )}
        <NavEntry to="/" label={t.nav[HOME.labelKey]} Icon={HOME.icon} collapsed={collapsed} />
        {!collapsed && shown.length === 0 && <p className="px-2.5 py-1 text-xs text-fg-muted">{t.nav.favoritesEmpty}</p>}
        {shown.map((path, i) => {
          const page = entry(path)
          return (
            <div key={path} data-fav className={cn('group/row relative', dragged === i && 'opacity-40')}
              title={collapsed ? undefined : t.nav.favoritesMove}
              draggable={!collapsed}
              onDragStart={e => { setDragged(i); e.dataTransfer.effectAllowed = 'move' }}
              onDragOver={e => { if (dragged !== null) e.preventDefault() }}
              onDrop={e => { e.preventDefault(); if (dragged !== null) move(dragged, i); setDragged(null) }}
              onDragEnd={() => setDragged(null)}
              onKeyDown={onFavKey(i)}>
              <NavEntry to={path} label={t.nav[page.labelKey]} Icon={page.icon} collapsed={collapsed} />
              {!collapsed && <PinButton pinned full={false} onToggle={() => togglePin(path)} />}
            </div>
          )
        })}

        <span className="mx-1 my-3 shrink-0 border-t border-line-subtle" />

        {MENU_GROUPS.map(group => (
          <NavGroup key={group.key} group={group} open={openGroup === group.key} collapsed={collapsed} onToggle={() => toggleGroup(group.key)} favorites={favorites} onPin={togglePin} hasServer={hasServer} />
        ))}
      </nav>

      {/* Settings and the collapse toggle stay pinned at the bottom */}
      <div className="flex shrink-0 flex-col gap-0.5 border-t border-line-subtle px-2.5 py-2.5 shadow-[0_-12px_16px_-12px_var(--shadow-color)]">
        <NavEntry to={settings.path} label={t.nav.settings} Icon={settings.icon} collapsed={collapsed} />
        {!collapsed && <span className="px-2.5 pt-1.5 font-mono text-[11px] text-fg-muted">v{__APP_VERSION__}</span>}
        <button
          onClick={() => setCollapsed(c => !c)}
          title={`${collapsed ? t.nav.expand : t.nav.collapse} (Ctrl+B)`}
          aria-label={collapsed ? t.nav.expand : t.nav.collapse}
          className={cn(
            'flex h-[34px] items-center rounded-[9px] text-[13px] text-fg-muted transition-colors hover:bg-hover hover:text-fg',
            collapsed ? 'justify-center' : 'gap-2.5 px-2.5'
          )}
        >
          {collapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
          {!collapsed && <span>{t.nav.collapse}</span>}
        </button>
      </div>
    </aside>
  )
}
