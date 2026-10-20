import type { ReactNode } from 'react'
import Sidebar from './Sidebar'
import TitleBar from './TitleBar'
import BottomPanel from './BottomPanel'
import CommandPalette from '@renderer/components/command-palette/CommandPalette'
import { useAssistant } from '@renderer/features/assistant/AssistantContext'
import AssistantPanel from '@renderer/features/assistant/AssistantPanel'
import ForgyWalker from '@renderer/features/assistant/ForgyWalker'
import { useI18n } from '@renderer/i18n/I18nContext'

export default function Layout({ children }: { children: ReactNode }) {
  const { open } = useAssistant()
  const { t } = useI18n()
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
          <BottomPanel />
        </div>
        {open && <AssistantPanel />}
      </div>
      <CommandPalette />
    </div>
  )
}
