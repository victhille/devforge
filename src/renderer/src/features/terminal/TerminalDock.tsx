import { useEffect, useRef, useState } from 'react'
import { useI18n } from '@renderer/i18n/I18nContext'
import { useActiveProject } from '@renderer/hooks/useActiveProject'
import { cn } from '@renderer/lib/cn'
import TerminalTabs from './TerminalTabs'

export const TOGGLE_TERMINAL = 'devforge:toggle-terminal'
const HEIGHT_KEY = 'devforge:terminal-height'

const readHeight = () => { try { return Number(localStorage.getItem(HEIGHT_KEY)) || 360 } catch { return 360 } }

/**
 * The terminal docked at the bottom of the window (Ctrl+`). Opened in the
 * active project's folder; its shells live on while it is closed.
 */
export default function TerminalDock() {
  const { t } = useI18n()
  const { active } = useActiveProject()
  const [open, setOpen] = useState(false)
  const [opened, setOpened] = useState(false)
  const [height, setHeight] = useState(readHeight)
  const [home, setHome] = useState('')
  const drag = useRef<{ y: number; h: number } | null>(null)

  useEffect(() => { window.devforge.getSettings().then(s => setHome(s.defaultProjectsDir)).catch(() => {}) }, [])

  useEffect(() => {
    const toggle = () => setOpen(o => { if (!o) setOpened(true); return !o })
    const onKey = (e: KeyboardEvent) => { if (e.ctrlKey && (e.key === '`' || e.code === 'Backquote')) { e.preventDefault(); toggle() } }
    window.addEventListener('keydown', onKey)
    window.addEventListener(TOGGLE_TERMINAL, toggle)
    return () => { window.removeEventListener('keydown', onKey); window.removeEventListener(TOGGLE_TERMINAL, toggle) }
  }, [])

  useEffect(() => {
    const move = (e: MouseEvent) => {
      if (!drag.current) return
      setHeight(Math.min(window.innerHeight - 160, Math.max(160, drag.current.h + drag.current.y - e.clientY)))
    }
    const up = () => {
      if (!drag.current) return
      drag.current = null
      try { localStorage.setItem(HEIGHT_KEY, String(height)) } catch { /* not kept */ }
    }
    window.addEventListener('mousemove', move)
    window.addEventListener('mouseup', up)
    return () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up) }
  }, [height])

  const cwd = active?.path || home
  // Nothing starts before the first opening
  if (!opened || !cwd) return null
  return (
    <section aria-label={t.terminal.dockLabel} className={cn('relative flex shrink-0 flex-col border-t border-line bg-[#090B10]', !open && 'hidden')} style={{ height }}>
      <div role="separator" aria-orientation="horizontal" aria-label={t.terminal.resize}
        onMouseDown={e => { drag.current = { y: e.clientY, h: height }; e.preventDefault() }}
        className="absolute -top-1 right-0 left-0 z-10 h-2 cursor-row-resize" />
      {/* The shells already open stay where they are; new tabs open in the active project */}
      <TerminalTabs cwd={cwd} className="h-full" />
    </section>
  )
}
