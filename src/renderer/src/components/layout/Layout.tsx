import { useEffect, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import Sidebar from './Sidebar'
import TitleBar from './TitleBar'
import BottomPanel from './BottomPanel'
import TerminalDock from '@renderer/features/terminal/TerminalDock'
import { setPendingDraft } from '@renderer/features/projects/symfony/draft'
import CommandPalette from '@renderer/components/command-palette/CommandPalette'
import { useAssistant } from '@renderer/features/assistant/AssistantContext'
import AssistantPanel from '@renderer/features/assistant/AssistantPanel'
import ForgyWalker from '@renderer/features/assistant/ForgyWalker'
import { useI18n } from '@renderer/i18n/I18nContext'
import { useConsole } from '@renderer/app/ConsoleContext'

export default function Layout({ children }: { children: ReactNode }) {
  const { open, ask } = useAssistant()
  const { runScript } = useConsole()
  const { t } = useI18n()
  const navigate = useNavigate()
  // Forgy created a VPN client: the VPN page opens on its QR code
  useEffect(() => window.devforge.vpn.onShowQr(e => {
    try {
      localStorage.setItem('devforge:vps-server', e.connectionId)
      sessionStorage.setItem('devforge:vpn-qr', JSON.stringify(e))
    } catch { /* not kept */ }
    navigate('/vpn')
    window.dispatchEvent(new Event('devforge:vpn-qr'))
  }), [navigate])
  // Forgy prepared a model: the project's workshop opens on the filled form
  useEffect(() => window.devforge.symfony.onDraft(e => {
    setPendingDraft(e.projectPath, e.draft)
    navigate(`/project/${e.projectId}?tab=${e.tab ?? 'symfony'}`)
  }), [navigate])
  // The global launcher hands over: a page, a script in the console, a question for Forgy
  useEffect(() => window.devforge.launcher.onToMain(m => {
    if (m.kind === 'navigate') navigate(m.path)
    else if (m.kind === 'script') runScript(m.projectPath, m.script, m.pm, m.name)
    else ask(m.text)
  }), [navigate, runScript, ask])
  return (
    <div className="flex h-screen flex-col overflow-hidden bg-canvas">
      {/* First Tab stop: jumps over the title bar and the menu (a button: links are routes here) */}
      <button onClick={() => document.getElementById('main')?.focus()}
        className="fixed top-2 left-2 z-[70] -translate-y-16 rounded-lg bg-accent px-3 py-2 text-sm font-medium text-accent-fg shadow-lg focus:translate-y-0">
        {t.common.skipToContent}
      </button>
      <TitleBar />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <div className="flex flex-1 flex-col overflow-hidden">
          <div className="relative flex min-h-0 flex-1 flex-col">
            <main id="main" tabIndex={-1} className="flex-1 overflow-y-auto outline-none">{children}</main>
            <ForgyWalker />
          </div>
          <TerminalDock />
          <BottomPanel />
        </div>
        {open && <AssistantPanel />}
      </div>
      <CommandPalette />
    </div>
  )
}
