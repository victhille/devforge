import { useState, useEffect, type ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
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
        danger ? 'hover:bg-danger hover:text-white' : 'hover:bg-hover hover:text-fg'
      )}
    >
      {children}
    </button>
  )
}

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
    <div className="app-drag flex h-[42px] shrink-0 select-none items-center gap-3 border-b border-line-subtle bg-chrome pl-3.5">
      <div className="flex w-[200px] shrink-0 items-center gap-2 text-base font-semibold text-fg">
        <img src={logo} alt="" className="size-5 object-contain" />
        <span>DevForge</span>
      </div>

      {/* Opens the command palette (same as Ctrl+K) */}
      <button
        onClick={() => window.dispatchEvent(new Event('devforge:open-palette'))}
        className="app-no-drag mx-auto flex h-[30px] w-full max-w-[440px] items-center gap-2 rounded-lg border border-line bg-canvas px-2.5 text-sm text-fg-muted transition-colors hover:border-fg-disabled hover:text-fg-secondary"
      >
        <Search size={13} />
        <span className="flex-1 text-left">{t.palette.search}…</span>
        <kbd className="rounded border border-line bg-elevated px-1.5 font-mono text-2xs">Ctrl K</kbd>
      </button>

      {/* v3.9: a project being created, from any page */}
      <CreationBadge />

      {/* The documentation of this page, on the site (F1) */}
      {docsUrl(docsOf(pathname, search), lang) && (
        <button onClick={help} title={t.nav.help + ' (F1)'} aria-label={t.nav.help}
          className="app-no-drag flex h-[30px] items-center rounded-lg border border-line px-2.5 text-fg-secondary transition-colors hover:border-fg-disabled hover:text-fg">
          <CircleHelp size={14} />
        </button>
      )}

      {/* Terminal in blocks, docked at the bottom (Ctrl+`) */}
      <button onClick={() => window.dispatchEvent(new Event(TOGGLE_TERMINAL))} title={t.terminal.dockLabel + ' (Ctrl+`)'} aria-label={t.terminal.dockLabel}
        className="app-no-drag flex h-[30px] items-center gap-1.5 rounded-lg border border-line px-2.5 text-sm text-fg-secondary transition-colors hover:border-fg-disabled hover:text-fg">
        <SquareTerminal size={14} />
      </button>

      {/* A new version on its way: progress, then restart to update */}
      <UpdateButton />

      {/* AI assistant (Ctrl+J) */}
      <button
        onClick={() => setOpen(o => !o)}
        title={`${t.assistant.mascotName} — ${t.assistant.moods[mood]} (Ctrl+J)`}
        className={cn('app-no-drag flex h-[30px] items-center gap-1.5 rounded-full border pr-3 pl-1 text-sm font-medium transition-colors',
          open ? 'border-forgy/50 bg-forgy-soft text-forgy' : 'border-forgy/25 bg-forgy-soft/50 text-forgy hover:border-forgy/50')}
      >
        <Mascot mood={mood} size={22} followCursor={false} /> {t.assistant.mascotName}
        <kbd className="font-mono text-2xs text-fg-secondary">Ctrl J</kbd>
      </button>

      <div className="app-no-drag flex h-full items-stretch">
        <WindowButton title="Minimize" onClick={() => window.devforge.windowMinimize()}>
          <Minus size={12} />
        </WindowButton>
        <WindowButton title={maximized ? 'Restore' : 'Maximize'} onClick={() => window.devforge.windowMaximize()}>
          {maximized ? <Square size={11} /> : <Maximize2 size={11} />}
        </WindowButton>
        <WindowButton title="Close" danger onClick={() => window.devforge.windowClose()}>
          <X size={12} />
        </WindowButton>
      </div>
    </div>
  )
}
