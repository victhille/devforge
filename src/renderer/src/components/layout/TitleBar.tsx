import { useState, useEffect, type ReactNode } from 'react'
import { Minus, Square, X, Maximize2 } from 'lucide-react'
import logo from '@renderer/assets/icon.png'
import { cn } from '@renderer/lib/cn'

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
  const [maximized, setMaximized] = useState(false)

  useEffect(() => {
    window.devforge.windowIsMaximized().then(setMaximized)
    return window.devforge.onWindowMaximizedChange(setMaximized)
  }, [])

  return (
    <div className="app-drag flex h-[38px] shrink-0 select-none items-center border-b border-line-subtle bg-surface pl-4">
      <div className="flex flex-1 items-center gap-2 text-sm font-semibold uppercase tracking-[0.08em] text-fg-muted">
        <img src={logo} alt="" className="size-6 object-contain" />
        <span>DevForge</span>
      </div>

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
