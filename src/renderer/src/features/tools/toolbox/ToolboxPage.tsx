import { useState, type ComponentType, type KeyboardEvent } from 'react'
import { useI18n } from '@renderer/i18n/I18nContext'
import { cn } from '@renderer/lib/cn'
import SearchInput from '@renderer/components/ui/SearchInput'
import { Page, PageHeader } from '@renderer/components/ui/Page'
import type { ToolboxT } from './IoPanel'
import JsonTool from './tools/JsonTool'
import Base64Tool from './tools/Base64Tool'
import JwtTool from './tools/JwtTool'
import RegexTool from './tools/RegexTool'
import UuidTool from './tools/UuidTool'
import HashTool from './tools/HashTool'
import CronTool from './tools/CronTool'
import TimestampTool from './tools/TimestampTool'
import UrlTool from './tools/UrlTool'

type Tab = 'json' | 'base64' | 'jwt' | 'regex' | 'uuid' | 'hash' | 'cron' | 'timestamp' | 'url'

const TOOLS: { id: Tab; labelKey: keyof ToolboxT; Component: ComponentType<{ t: ToolboxT }> }[] = [
  { id: 'json',   labelKey: 'tabJson',   Component: JsonTool },
  { id: 'base64', labelKey: 'tabBase64', Component: Base64Tool },
  { id: 'jwt',    labelKey: 'tabJwt',    Component: JwtTool },
  { id: 'regex',  labelKey: 'tabRegex',  Component: RegexTool },
  { id: 'uuid',   labelKey: 'tabUuid',   Component: UuidTool },
  { id: 'hash',   labelKey: 'tabHash',   Component: HashTool },
  { id: 'cron',      labelKey: 'tabCron',      Component: CronTool },
  { id: 'timestamp', labelKey: 'tabTimestamp', Component: TimestampTool },
  { id: 'url',       labelKey: 'tabUrl',       Component: UrlTool }
]

/**
 * As in the mock-up: the tools in a row of cards (their name and what they
 * do), then the chosen one's input and result. The arrows move from one tool
 * to the next; the search keeps the tools that match, Enter opens the first.
 */
export default function ToolboxPage() {
  const { t } = useI18n()
  const tb = t.toolbox
  const [active, setActive] = useState<Tab>('json')
  const [query, setQuery] = useState('')
  const Tool = TOOLS.find(tool => tool.id === active)!.Component
  const label = (tool: (typeof TOOLS)[number]) => tb[tool.labelKey] as string
  const q = query.trim().toLowerCase()
  const shown = q ? TOOLS.filter(tool => `${label(tool)} ${tb.hints[tool.id]}`.toLowerCase().includes(q)) : TOOLS
  const list = shown.length ? shown : TOOLS

  function pick(id: Tab) {
    setActive(id)
    setQuery('')
  }

  // The tool Tab reaches: the open one, else the first shown (a search that hides the open one must not leave the row unreachable)
  const reachable = list.some(x => x.id === active) ? active : list[0].id

  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const step = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0
    const edge = e.key === 'Home' ? 0 : e.key === 'End' ? list.length - 1 : -1
    if (!step && edge < 0) return
    e.preventDefault()
    const at = list.findIndex(x => x.id === reachable)
    const next = edge >= 0 ? list[edge] : list[(at + step + list.length) % list.length]
    pick(next.id)
    e.currentTarget.querySelector<HTMLButtonElement>(`[data-tool="${next.id}"]`)?.focus()
  }

  return (
    <Page className="df-mockup min-h-full max-w-none gap-5">
      <PageHeader
        crumb={t.nav.groupTools}
        title={tb.title}
        subtitle={tb.subtitle}
        actions={
          <div className="w-[280px]" onKeyDown={e => { if (e.key === 'Enter' && shown[0]) pick(shown[0].id) }}>
            <SearchInput value={query} onChange={setQuery} placeholder={tb.search} />
          </div>
        }
      />
      <div role="tablist" aria-label={tb.tools} onKeyDown={onKey} className="grid grid-cols-[repeat(auto-fit,minmax(88px,1fr))] gap-2">
        {list.map(tool => {
          const on = tool.id === active
          return (
            <button key={tool.id} type="button" role="tab" id={`tool-${tool.id}`} aria-controls="tool-panel" data-tool={tool.id} aria-selected={on} tabIndex={tool.id === reachable ? 0 : -1} onClick={() => pick(tool.id)} title={`${label(tool)} · ${tb.hints[tool.id]}`}
              className={cn('flex min-w-0 flex-col items-start gap-1 rounded-card border px-3 py-3 text-left transition-colors',
                on ? 'border-accent bg-accent-soft' : 'border-line-subtle bg-surface hover:border-line hover:bg-elevated')}>
              <span className="max-w-full truncate font-display text-sm font-bold text-fg">{label(tool)}</span>
              <span className="max-w-full truncate text-xs text-fg-muted">{tb.hints[tool.id]}</span>
            </button>
          )
        })}
      </div>
      <div role="tabpanel" id="tool-panel" aria-labelledby={`tool-${active}`} className="flex min-h-0 flex-1 flex-col gap-3">
        <Tool key={active} t={tb} />
      </div>
    </Page>
  )
}
