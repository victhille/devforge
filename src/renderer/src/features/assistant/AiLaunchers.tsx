import { useEffect, useState } from 'react'
import { ExternalLink, SquareTerminal } from 'lucide-react'
import type { AiToolInfo } from '@shared/types'
import { useI18n } from '@renderer/i18n/I18nContext'
import { useToast } from '@renderer/app/ToastContext'
import { cn } from '@renderer/lib/cn'

/** Official web apps: they use the user's own subscriptions */
const WEB_APPS = [
  { name: 'Claude', url: 'https://claude.ai/new' },
  { name: 'ChatGPT', url: 'https://chatgpt.com/' },
  { name: 'Gemini', url: 'https://gemini.google.com/app' }
]

const chip = 'flex items-center gap-1 rounded-md border px-2 py-0.5 text-2xs transition-colors'

/**
 * "Open with": the official AI tools on the PC (in the chosen project) and
 * the web apps. They run on the user's subscriptions, not on the API key.
 */
export default function AiLaunchers({ projectPath }: { projectPath: string | null }) {
  const { t } = useI18n()
  const a = t.assistant
  const toast = useToast()
  const [tools, setTools] = useState<AiToolInfo[]>([])

  useEffect(() => { window.devforge.aiTools.list().then(setTools) }, [])

  async function launch(tool: AiToolInfo) {
    if (!tool.installed) { window.devforge.openExternal(tool.installUrl); return }
    try {
      await window.devforge.aiTools.launch(tool.id, projectPath)
    } catch (err) {
      toast.show({ tone: 'error', title: a.launchFailed.replace('{name}', tool.name), description: String(err instanceof Error ? err.message : err).replace(/^Error invoking remote method '[^']+': (Error: )?/, '') })
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-1">
      <span className="mr-0.5 text-2xs text-fg-muted">{a.openWith}</span>
      {tools.map(tool => (
        <button key={tool.id} onClick={() => launch(tool)}
          title={tool.installed ? a.launchHint.replace('{name}', tool.name) : a.notInstalled.replace('{name}', tool.name)}
          className={cn(chip, tool.installed
            ? 'border-line-subtle text-fg-secondary hover:border-accent/40 hover:text-fg'
            : 'border-dashed border-line-subtle text-fg-muted opacity-60 hover:opacity-100')}>
          <SquareTerminal size={11} /> {tool.name}
        </button>
      ))}
      {WEB_APPS.map(app => (
        <button key={app.name} onClick={() => window.devforge.openExternal(app.url)} title={a.webAppHint.replace('{name}', app.name)}
          className={cn(chip, 'border-line-subtle text-fg-secondary hover:border-accent/40 hover:text-fg')}>
          <ExternalLink size={10} /> {app.name}
        </button>
      ))}
    </div>
  )
}
