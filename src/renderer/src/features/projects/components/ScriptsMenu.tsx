import { useCallback, useRef, useState } from 'react'
import { Play } from 'lucide-react'
import { useI18n } from '@renderer/i18n/I18nContext'
import { useClickOutside } from '@renderer/hooks/useClickOutside'
import IconButton from '@renderer/components/ui/IconButton'

/** Play button opening a dropdown of package.json scripts. */
export default function ScriptsMenu({ scripts, onRun }: { scripts: Record<string, string>; onRun: (s: string) => void }) {
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const close = useCallback(() => setOpen(false), [])
  useClickOutside(ref, open, close)

  const entries = Object.entries(scripts)
  if (entries.length === 0) return null

  return (
    <div ref={ref} className="relative">
      <IconButton title={t.projects.scripts} active={open} onClick={() => setOpen(v => !v)}>
        <Play size={12} />
      </IconButton>
      {open && (
        <div className="absolute top-full right-0 z-20 mt-1 max-h-72 w-72 overflow-y-auto rounded-lg border border-line bg-elevated p-1 shadow-pop">
          {entries.map(([name, cmd]) => (
            <button
              key={name}
              onClick={() => { onRun(name); setOpen(false) }}
              className="flex w-full flex-col items-start gap-0.5 rounded-md px-2.5 py-1.5 text-left transition-colors hover:bg-hover"
            >
              <span className="font-medium text-fg">{name}</span>
              <span className="w-full truncate font-mono text-2xs text-fg-muted">{cmd}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
