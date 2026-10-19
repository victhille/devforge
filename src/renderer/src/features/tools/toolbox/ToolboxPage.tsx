import { useState, type ComponentType } from 'react'
import { Search } from 'lucide-react'
import { useI18n } from '@renderer/i18n/I18nContext'
import Tabs from '@renderer/components/ui/Tabs'
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

export default function ToolboxPage() {
  const { t } = useI18n()
  const [active, setActive] = useState<Tab>('json')
  const [query, setQuery] = useState('')
  const Tool = TOOLS.find(tool => tool.id === active)!.Component
  // Instant search over the tool names
  const label = (tool: (typeof TOOLS)[number]) => t.toolbox[tool.labelKey] as string
  const shown = TOOLS.filter(tool => label(tool).toLowerCase().includes(query.trim().toLowerCase()))

  return (
    <Page className="min-h-full max-w-none gap-4">
      <PageHeader
        title={t.toolbox.title}
        subtitle={t.toolbox.subtitle}
        actions={
          <label className="flex h-9 w-[240px] items-center gap-2 rounded-[9px] border border-line bg-canvas px-3 text-fg-muted focus-within:border-accent/60">
            <Search size={14} />
            <span className="sr-only">{t.toolbox.search}</span>
            <input value={query} onChange={e => setQuery(e.target.value)} placeholder={t.toolbox.search}
              onKeyDown={e => { if (e.key === 'Enter' && shown[0]) { setActive(shown[0].id); setQuery('') } }}
              className="min-w-0 flex-1 bg-transparent text-base text-fg outline-none placeholder:text-fg-muted" />
          </label>
        }
      />
      <Tabs<Tab>
        value={active}
        onChange={id => { setActive(id); setQuery('') }}
        items={(shown.length ? shown : TOOLS).map(tool => ({ value: tool.id, label: label(tool) }))}
      />
      <div className="flex min-h-0 flex-1 flex-col gap-3">
        <Tool key={active} t={t.toolbox} />
      </div>
    </Page>
  )
}
