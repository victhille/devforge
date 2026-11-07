import { useState, useEffect, type ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Minus, Square, X, Maximize2, Search, SquareTerminal, CircleHelp } from 'lucide-react'
import logo from '@renderer/assets/icon-64.png'
import { cn } from '@renderer/lib/cn'
import { useI18n } from '@renderer/i18n/I18nContext'
import { useAssistant } from '@renderer/features/assistant/AssistantContext'
import Mascot from '@renderer/features/assistant/Mascot'
import { TOGGLE_TERMINAL } from '@renderer/features/terminal/TerminalDock'
import UpdateButton from './UpdateButton'
import CreationBadge from '@renderer/features/projects/new/CreationBadge'
import { docsOf } from '@renderer/app/navigation'
import { docsUrl, openDocs } from '@renderer/lib/docs'
import Kbd from '@renderer/components/ui/Kbd'

/** A round button of the bar, icon only (help, terminal) */
const TOOL = 'app-no-drag flex size-[30px] shrink-0 items-center justify-center rounded-lg text-fg-secondary transition-colors hover:bg-elevated hover:text-fg'

function WindowButton({ title, onClick, danger, children }: {
  title: string
  onClick: () => void
  danger?: boolean
  children: ReactNode
}) {
  return (
    <button
      title={title}
      aria-label={title}
      onClick={onClick}
      className={cn(
        'flex h-full w-[46px] items-center justify-center text-fg-muted transition-colors',
        danger ? 'hover:bg-danger hover:text-danger-fg' : 'hover:bg-elevated hover:text-fg'
      )}
    >
      {children}
    </button>
  )
}

/** Forge: 44 px, the brand above the menu, the search in the middle, Forgy on the right */
export default function TitleBar() {
  const { t, lang } = useI18n()
  const { open, setOpen, mood } = useAssistant()
  const [maximized, setMaximized] = useState(false)
  const { pathname, search } = useLocation()
  const help = () => openDocs(docsOf(pathname, search), lang)

  // F1: the documentation of the page on screen, like in most apps
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'F1') { e.preventDefault(); openDocs(docsOf(pathname, search), lang) } }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [pathname, search, lang])

  useEffect(() => {
    window.devforge.windowIsMaximized().then(setMaximized)
    return window.devforge.onWindowMaximizedChange(setMaximized)
  }, [])

  return (
    // The frame keeps its sizes in compact density (44 px high, the brand as wide as the menu); its text follows it
    <div className="app-drag flex h-[44px] shrink-0 select-none items-center gap-3 border-b border-line-subtle bg-chrome pl-[16px]">
      {/* As wide as the menu below it (rail and panel), so the search lines up with the page */}
      <div className="flex w-[268px] shrink-0 items-center">
        <Link to="/" aria-label={t.nav.brandHome}
          className="app-no-drag flex items-center gap-2 rounded-lg pr-1.5 font-display text-md font-bold tracking-tight text-fg">
          <img src={logo} alt="" className="size-[22px] object-contain" />
          <span>DevForge</span>
        </Link>
      </div>

      {/* Opens the command palette (same as Ctrl+K) */}
      <button
        onClick={() => window.dispatchEvent(new Event('devforge:open-palette'))}
        className="app-no-drag mx-auto flex h-[30px] min-w-0 flex-1 basis-0 items-center gap-2 rounded-lg border border-line bg-surface px-3 text-sm text-fg-muted transition-colors hover:border-fg-muted hover:text-fg-secondary max-w-[520px]"
      >
        <Search size={14} className="shrink-0" />
        <span className="min-w-0 flex-1 truncate text-left">{t.palette.search}…</span>
        <Kbd>Ctrl K</Kbd>
      </button>

      {/* v3.9: a project being created, from any page */}
      <CreationBadge />

      {/* The documentation of this page, on the site (F1) */}
      {docsUrl(docsOf(pathname, search), lang) && (
        <button onClick={help} title={t.nav.help + ' (F1)'} aria-label={t.nav.help} className={TOOL}>
          <CircleHelp size={16} />
        </button>
      )}

      {/* Terminal in blocks, docked at the bottom (Ctrl+`) */}
      <button onClick={() => window.dispatchEvent(new Event(TOGGLE_TERMINAL))} title={t.terminal.dockLabel + ' (Ctrl+`)'} aria-label={t.terminal.dockLabel} className={TOOL}>
        <SquareTerminal size={16} />
      </button>

      {/* A new version on its way: progress, then restart to update */}
      <UpdateButton />

      {/* AI assistant (Ctrl+J) */}
      <button
        onClick={() => setOpen(o => !o)}
        aria-pressed={open}
        title={`${t.assistant.mascotName} — ${t.assistant.moods[mood]} (Ctrl+J)`}
        className={cn('app-no-drag flex h-[30px] shrink-0 items-center gap-1.5 rounded-full border pr-3 pl-1 text-sm font-semibold text-forgy transition-colors',
          open ? 'border-forgy/60 bg-forgy-soft' : 'border-forgy/30 bg-forgy-soft hover:border-forgy/60')}
      >
        <Mascot mood={mood} size={22} followCursor={false} /> {t.assistant.mascotName}
        <Kbd>Ctrl J</Kbd>
      </button>

      <div className="app-no-drag flex h-full items-stretch">
        <WindowButton title={t.nav.windowMinimize} onClick={() => window.devforge.windowMinimize()}>
          <Minus size={13} />
        </WindowButton>
        <WindowButton title={maximized ? t.nav.windowRestore : t.nav.windowMaximize} onClick={() => window.devforge.windowMaximize()}>
          {maximized ? <Square size={11} /> : <Maximize2 size={12} />}
        </WindowButton>
        <WindowButton title={t.nav.windowClose} danger onClick={() => window.devforge.windowClose()}>
          <X size={13} />
        </WindowButton>
      </div>
    </div>
  )
}
