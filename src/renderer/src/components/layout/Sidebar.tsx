import { useCallback, useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import { Link, NavLink, useLocation, useSearchParams } from 'react-router-dom'
import { PanelLeftClose, PanelLeftOpen, RotateCcw, Star, type LucideIcon } from 'lucide-react'
import { useI18n } from '@renderer/i18n/I18nContext'
import { cn } from '@renderer/lib/cn'
import { usePersistentState } from '@renderer/hooks/usePersistentState'
import type { Project } from '@shared/types'
import { DEFAULT_FAVORITES, HOME, LISTED_PAGES, MENU_GROUPS, RAIL, isListed, isOn, panelFor, railCurrent, railOf, type NavKey, type RailKey } from '@renderer/app/navigation'
import { useProjects } from '@renderer/features/projects/hooks/useProjects'
import { SETTINGS_SECTIONS } from '@renderer/features/settings/sections'
import { useHasServer, useServerName } from '@renderer/hooks/useHasServer'
import { PANEL_ICON, PanelLabel, ProjectList, onProject, panelRow } from './PanelProjects'
import { MAX_FAVORITES } from '@shared/lib/favorites'

const ENTRIES = [HOME, ...LISTED_PAGES]
const entry = (path: string) => ENTRIES.find(p => p.path === path)!
const known = (path: string) => path !== '/' && ENTRIES.some(p => p.path === path)
const SettingsIcon = entry('/settings').icon

/** Ctrl+B stays a key of the field being typed in (bold in a note, a shell shortcut…) */
const isTyping = (t: EventTarget | null) => t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement || t instanceof HTMLSelectElement || (t instanceof HTMLElement && t.isContentEditable)

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
        'absolute top-1/2 right-2 flex size-8 -translate-y-1/2 items-center justify-center rounded-md text-fg-muted opacity-0 transition-opacity',
        'group-hover/row:opacity-100 focus-visible:opacity-100 hover:bg-elevated hover:text-fg disabled:cursor-not-allowed disabled:opacity-40',
        pinned && 'text-accent hover:text-accent'
      )}
    >
      <Star size={14} strokeWidth={2} fill={pinned ? 'currentColor' : 'none'} />
    </button>
  )
}

/**
 * A page of the panel: icon and name, the one on screen in bold with an orange icon.
 * `yields`: a more precise link of the panel holds the page (a project listed below Projects)
 */
function PanelLink({ to, label, Icon, pin, yields }: { to: string; label: string; Icon: LucideIcon; pin?: boolean; yields?: boolean }) {
  const { pathname } = useLocation()
  const on = isOn(pathname, to) && !yields
  return (
    <Link
      to={to}
      aria-current={on ? 'page' : undefined}
      className={panelRow(on, pin ? 'pr-11' : undefined)}
    >
      <Icon size={PANEL_ICON} strokeWidth={1.8} className={cn('shrink-0 transition-colors', on ? 'text-accent' : 'text-fg-muted group-hover/link:text-fg-secondary')} />
      <span className="truncate">{label}</span>
    </Link>
  )
}

/** How many projects the panel lists: the last opened under Home, the first by name under Development */
const RECENT_PROJECTS = 3
const GROUP_PROJECTS = 6

/** A square of the rail: a group (button) or Settings (link); orange when it holds the page on screen */
const railItem = (current: boolean, shown: boolean) => cn(
  'relative flex size-[42px] shrink-0 items-center justify-center rounded-lg transition-colors',
  current ? 'bg-accent-soft text-accent' : shown ? 'bg-active text-fg' : 'text-fg-muted hover:bg-elevated hover:text-fg'
)
/** The orange bar on the left edge of the window, beside the group of the page on screen */
const RailMark = () => <span aria-hidden className="absolute top-2.5 bottom-2.5 -left-[11px] w-[3px] rounded-r-full bg-accent" />

/**
 * Forge: an icon rail (Home, the six groups, Settings at the bottom)
 * and the panel of one group beside it. A group's button shows its pages in
 * the panel without leaving the page; pressed again, it folds the panel
 * (Ctrl+B too). Everything comes from app/navigation.ts.
 */
export default function Sidebar() {
  const { t } = useI18n()
  const { pathname } = useLocation()
  const [collapsed, setCollapsed] = usePersistentState('devforge:sidebar-collapsed', false)
  const [favorites, saveFavorites] = useFavorites()
  const hasServer = useHasServer()
  const shownFavorites = favorites.filter(p => known(p) && isListed(p, hasServer))
  const [shown, setShown] = useState<RailKey>(() => railOf(pathname) ?? 'home')
  // The rail lights the panel shown when it lists the page (a favorite stays under Home), else the page's group
  const current = railCurrent(shown, pathname, shownFavorites)
  const [params] = useSearchParams()
  const { projects } = useProjects()
  const server = useServerName()
  // The rail is one Tab stop; the arrows move inside it
  const [stop, setStop] = useState<RailKey | null>(null)
  const rail = useRef<HTMLDivElement>(null)
  const [dragged, setDragged] = useState<number | null>(null)
  const isDefault = favorites.join() === DEFAULT_FAVORITES.join()

  // The panel follows the page: one opened from elsewhere (palette, a link, back) shows its group,
  // one picked in the panel keeps it (a favorite stays under Home)
  // (the favorites are read, not followed: unpinning the page on screen leaves the panel where it is)
  const favoritesRef = useRef(shownFavorites)
  useEffect(() => { favoritesRef.current = shownFavorites })
  useEffect(() => { setShown(s => panelFor(s, pathname, favoritesRef.current)) }, [pathname])
  // On Settings the panel holds their sections, until a group is picked on the rail (until the next page)
  const onSettings = pathname.startsWith('/settings')
  const [browsing, setBrowsing] = useState(false)
  useEffect(() => { setBrowsing(false) }, [pathname])
  const settingsShown = onSettings && !browsing
  // The rail's Tab stop goes back to the group shown
  useEffect(() => { setStop(null) }, [shown])

  // Ctrl+B folds the panel, like in most editors
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b' && !isTyping(e.target)) {
        e.preventDefault()
        setCollapsed(c => !c)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [setCollapsed])

  const pick = (key: RailKey) => {
    setBrowsing(true)
    if (collapsed) { setShown(key); setCollapsed(false) }
    else if (key === shown && !settingsShown) setCollapsed(true)
    else setShown(key)
  }

  // Up / Down (and Home / End) move between the groups of the rail
  const onRailKey = (e: ReactKeyboardEvent) => {
    const buttons = [...(rail.current?.querySelectorAll<HTMLButtonElement>('button') ?? [])]
    const i = buttons.indexOf(document.activeElement as HTMLButtonElement)
    const to = e.key === 'ArrowDown' ? i + 1 : e.key === 'ArrowUp' ? i - 1 : e.key === 'Home' ? 0 : e.key === 'End' ? buttons.length - 1 : null
    if (to === null || i < 0) return
    e.preventDefault()
    buttons[(to + buttons.length) % buttons.length]?.focus()
  }

  const togglePin = (path: string) => saveFavorites(favorites.includes(path) ? favorites.filter(p => p !== path) : [...favorites, path])
  const move = (from: number, to: number) => {
    if (to < 0 || to >= shownFavorites.length || from === to) return
    const next = [...shownFavorites]
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
    requestAnimationFrame(() => document.querySelectorAll<HTMLElement>('[data-fav] a')[Math.max(0, Math.min(to, shownFavorites.length - 1))]?.focus())
  }

  const label = (key: RailKey) => (key === 'home' ? t.nav.home : t.nav[key])
  const group = MENU_GROUPS.find(g => g.key === shown)
  // The projects the panel lists: the last opened under Home, by name under Development
  const when = (p: Project) => p.lastOpenedAt ?? p.createdAt
  const listed = settingsShown || collapsed ? [] : shown === 'home'
    ? projects.slice().sort((a, b) => when(b).localeCompare(when(a))).slice(0, RECENT_PROJECTS)
    : shown === 'groupDev' ? projects.slice().sort((a, b) => a.name.localeCompare(b.name)).slice(0, GROUP_PROJECTS) : []
  // A listed project on screen is the panel's current page, not Projects as well
  const projectListed = listed.some(p => onProject(pathname, p.id))
  const note = settingsShown ? null
    : shown === 'home' ? t.nav.noteHome
    : (shown === 'groupServers' || shown === 'groupOnline') && server ? t.nav.noteServer.replace('{name}', server) : null
  const paths = group ? group.paths.filter(p => isListed(p, hasServer)) : []
  const waiting = group ? group.paths.length - paths.length : 0
  const toggleLabel = collapsed ? t.nav.expand : t.nav.collapse

  return (
    <aside className="flex shrink-0">
      <nav aria-label={t.nav.mainMenu} className="relative flex min-h-0">
        {/* The rail: always there, 64 px */}
        <div className="flex w-[64px] shrink-0 flex-col items-center gap-1.5 border-r border-line-subtle bg-chrome py-3">
          <div ref={rail} role="toolbar" aria-orientation="vertical" aria-label={t.nav.railLabel} onKeyDown={onRailKey} className="flex flex-col items-center gap-1.5">
            {RAIL.map(({ key, icon: Icon }) => {
              const isShown = !collapsed && !settingsShown && shown === key
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => pick(key)}
                  onFocus={() => setStop(key)}
                  tabIndex={(stop ?? shown) === key ? 0 : -1}
                  aria-label={label(key)}
                  aria-pressed={isShown}
                  aria-controls="nav-panel"
                  title={label(key)}
                  className={railItem(current === key, isShown)}
                >
                  {current === key && <RailMark />}
                  <Icon size={18} strokeWidth={1.8} />
                </button>
              )
            })}
          </div>
        </div>

        {/* The panel of the group: 220 px, folds to nothing */}
        <div id="nav-panel" className={cn('shrink-0 overflow-hidden bg-sidebar transition-[width] duration-200', collapsed ? 'w-0' : 'w-[220px] border-r border-line-subtle')}>
          {!collapsed && (
            <div className="flex h-full w-[219px] flex-col gap-7 overflow-y-auto px-3 pt-6 pb-3">
              <p className="truncate px-3 font-display text-xl font-bold tracking-tight text-fg">{settingsShown ? t.nav.settings : label(shown)}</p>

              {settingsShown ? (
                <div className="flex flex-col gap-1">
                  {SETTINGS_SECTIONS.map(x => {
                    const on = (params.get('notes') ? 'updates' : params.get('section') ?? 'general') === x.id
                    return (
                      <Link key={x.id} to={`/settings?section=${x.id}`} aria-current={on ? 'page' : undefined}
                        className={panelRow(on)}>
                        <x.icon size={PANEL_ICON} strokeWidth={1.8} className={cn('shrink-0', on ? 'text-accent' : 'text-fg-muted group-hover/link:text-fg-secondary')} />
                        <span className="truncate">{t.settings.nav[x.id]}</span>
                      </Link>
                    )
                  })}
                </div>
              ) : shown === 'home' ? (
                <>
                  <PanelLink to="/" label={t.nav.home} Icon={HOME.icon} />
                  <div className="flex flex-col gap-1">
                    <div className="group/head flex h-8 items-center justify-between px-3 pb-1">
                      <PanelLabel>{t.nav.favorites}</PanelLabel>
                      {!isDefault && (
                        <button type="button" title={t.nav.favoritesReset} aria-label={t.nav.favoritesReset} onClick={() => saveFavorites([...DEFAULT_FAVORITES])}
                          className="flex size-7 items-center justify-center rounded-md text-fg-muted opacity-0 transition-opacity group-hover/head:opacity-100 focus-visible:opacity-100 hover:text-fg">
                          <RotateCcw size={14} />
                        </button>
                      )}
                    </div>
                    {shownFavorites.length === 0 && <p className="px-3 py-1 text-sm text-fg-muted">{t.nav.favoritesEmpty}</p>}
                    {shownFavorites.map((path, i) => {
                      const page = entry(path)
                      return (
                        <div key={path} data-fav className={cn('group/row relative', dragged === i && 'opacity-40')}
                          title={t.nav.favoritesMove}
                          draggable
                          onDragStart={e => { setDragged(i); e.dataTransfer.effectAllowed = 'move' }}
                          onDragOver={e => { if (dragged !== null) e.preventDefault() }}
                          onDrop={e => { e.preventDefault(); if (dragged !== null) move(dragged, i); setDragged(null) }}
                          onDragEnd={() => setDragged(null)}
                          onKeyDown={onFavKey(i)}>
                          <PanelLink to={path} label={t.nav[page.labelKey]} Icon={page.icon} pin yields={path === '/projects' && projectListed} />
                          <PinButton pinned full={false} onToggle={() => togglePin(path)} />
                        </div>
                      )
                    })}
                  </div>
                  <ProjectList label={t.nav.recentProjects} projects={listed} more={0} />
                </>
              ) : (
                <>
                <div className="flex flex-col gap-1">
                  {paths.map(path => {
                    const page = entry(path)
                    return (
                      <div key={path} className="group/row relative">
                        <PanelLink to={path} label={t.nav[page.labelKey as NavKey]} Icon={page.icon} pin yields={path === '/projects' && projectListed} />
                        <PinButton pinned={favorites.includes(path)} full={favorites.length >= MAX_FAVORITES} onToggle={() => togglePin(path)} />
                      </div>
                    )
                  })}
                  {/* The server pages exist: say where they come from */}
                  {waiting > 0 && (
                    <Link to="/settings?section=connections"
                      className="mt-0.5 flex h-9 items-center truncate rounded-control px-3 text-sm text-fg-muted transition-colors hover:bg-hover hover:text-fg">
                      {t.nav.moreWithServer.replace('{n}', String(waiting))}
                    </Link>
                  )}
                </div>
                {shown === 'groupDev' && <ProjectList label={t.nav.projects} projects={listed} more={Math.max(0, projects.length - GROUP_PROJECTS)} />}
                </>
              )}

              <div className="mt-auto flex shrink-0 flex-col gap-2 px-2">
                {note && <p className="-mx-2 rounded-control border border-line-subtle bg-surface p-3.5 text-sm text-fg-secondary">{note}</p>}
                <span className="font-mono text-xs text-fg-muted">v{__APP_VERSION__}</span>
              </div>
            </div>
          )}
        </div>

        {/* At the foot of the rail, but after the panel for Tab: a group's button, then its pages */}
        <div className="absolute bottom-3 left-0 flex w-[64px] flex-col items-center gap-1.5">
          <button
            type="button"
            onClick={() => setCollapsed(c => !c)}
            aria-label={toggleLabel}
            aria-expanded={!collapsed}
            aria-controls="nav-panel"
            title={`${toggleLabel} (Ctrl+B)`}
            className={railItem(false, false)}
          >
            {collapsed ? <PanelLeftOpen size={18} strokeWidth={1.8} /> : <PanelLeftClose size={18} strokeWidth={1.8} />}
          </button>
          <NavLink to="/settings" onClick={() => setBrowsing(false)} aria-label={t.nav.settings} title={t.nav.settings} className={railItem(onSettings, false)}>
            {onSettings && <RailMark />}
            <SettingsIcon size={18} strokeWidth={1.8} />
          </NavLink>
        </div>
      </nav>
    </aside>
  )
}
