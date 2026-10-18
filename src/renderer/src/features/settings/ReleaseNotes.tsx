import type { ReactNode } from 'react'
import { useI18n } from '@renderer/i18n/I18nContext'
import Badge from '@renderer/components/ui/Badge'

/** **bold** and [text](url) inside a changelog line */
function inline(text: string): ReactNode[] {
  const out: ReactNode[] = []
  const re = /\*\*(.+?)\*\*|\[([^\]]+)\]\((https?:\/\/[^)]+)\)|_(.+?)_/g
  let last = 0
  for (const m of text.matchAll(re)) {
    if (m.index > last) out.push(text.slice(last, m.index))
    if (m[1]) out.push(<strong key={m.index} className="font-semibold text-fg">{m[1]}</strong>)
    else if (m[2]) {
      const url = m[3]
      out.push(
        <button key={m.index} onClick={() => window.devforge.openExternal(url)} className="font-mono text-xs text-accent hover:underline">{m[2]}</button>
      )
    } else if (m[4]) out.push(<em key={m.index} className="text-fg-muted">{m[4]}</em>)
    last = m.index + m[0].length
  }
  if (last < text.length) out.push(text.slice(last))
  return out
}

/** One version of CHANGELOG.md, or all of them */
export default function ReleaseNotes({ markdown, only }: { markdown: string; only?: string }) {
  const { t } = useI18n()
  const versions = markdown.split(/\n(?=## )/).filter(s => s.startsWith('## '))
  const shown = only ? versions.filter(v => v.match(/^## \[?([^\] ]+)/)?.[1] === only) : versions

  if (!shown.length) return <p className="text-sm text-fg-muted">{t.settings.noReleaseNotes}</p>

  return (
    <div className="flex flex-col gap-6">
      {shown.map(block => {
        const [title, ...lines] = block.split('\n')
        const version = title.match(/^## \[?([^\] ]+)/)?.[1] ?? ''
        const date = title.match(/— (\d{4}-\d{2}-\d{2})/)?.[1]
        return (
          <section key={version} className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <h3 className="text-md font-semibold text-fg">v{version}</h3>
              {version.includes('-') && <Badge color="warning">{version.split('-')[1].split('.')[0]}</Badge>}
              {version === __APP_VERSION__ && <Badge color="accent">{t.settings.installed}</Badge>}
              {date && <span className="ml-auto text-xs text-fg-muted">{new Date(date).toLocaleDateString()}</span>}
            </div>
            {lines.map((line, i) => {
              if (line.startsWith('### ')) return <h4 key={i} className="mt-1 text-xs font-semibold uppercase tracking-wider text-fg-muted">{line.slice(4)}</h4>
              if (line.startsWith('- ')) return <p key={i} className="flex gap-2 pl-1 text-sm text-fg-secondary"><span className="text-fg-muted">•</span><span>{inline(line.slice(2))}</span></p>
              if (line.trim()) return <p key={i} className="text-sm text-fg-secondary">{inline(line)}</p>
              return null
            })}
          </section>
        )
      })}
    </div>
  )
}
