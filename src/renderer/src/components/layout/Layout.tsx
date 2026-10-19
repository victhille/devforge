import type { ReactNode } from 'react'
import Sidebar from './Sidebar'
import TitleBar from './TitleBar'
import BottomPanel from './BottomPanel'
import CommandPalette from '@renderer/components/command-palette/CommandPalette'
import { useAssistant } from '@renderer/features/assistant/AssistantContext'
import AssistantPanel from '@renderer/features/assistant/AssistantPanel'
import ForgyWalker from '@renderer/features/assistant/ForgyWalker'

export default function Layout({ children }: { children: ReactNode }) {
  const { open } = useAssistant()
  return (
    <div className="flex h-screen flex-col overflow-hidden bg-canvas">
      <TitleBar />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <div className="flex flex-1 flex-col overflow-hidden">
          <div className="relative flex min-h-0 flex-1 flex-col">
            <main className="flex-1 overflow-y-auto">{children}</main>
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
