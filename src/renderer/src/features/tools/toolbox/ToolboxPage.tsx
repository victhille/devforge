import { useState, type ComponentType } from 'react'
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

type Tab = 'json' | 'base64' | 'jwt' | 'regex' | 'uuid' | 'hash'

const TOOLS: { id: Tab; labelKey: keyof ToolboxT; Component: ComponentType<{ t: ToolboxT }> }[] = [
  { id: 'json',   labelKey: 'tabJson',   Component: JsonTool },
  { id: 'base64', labelKey: 'tabBase64', Component: Base64Tool },
  { id: 'jwt',    labelKey: 'tabJwt',    Component: JwtTool },
  { id: 'regex',  labelKey: 'tabRegex',  Component: RegexTool },
  { id: 'uuid',   labelKey: 'tabUuid',   Component: UuidTool },
  { id: 'hash',   labelKey: 'tabHash',   Component: HashTool }
]

export default function ToolboxPage() {
  const { t } = useI18n()
  const [active, setActive] = useState<Tab>('json')
  const Tool = TOOLS.find(tool => tool.id === active)!.Component

  return (
    <Page className="min-h-full max-w-none gap-4">
      <PageHeader title={t.toolbox.title} subtitle={t.toolbox.subtitle} />
      <Tabs<Tab>
        value={active}
        onChange={setActive}
        items={TOOLS.map(tool => ({ value: tool.id, label: t.toolbox[tool.labelKey] as string }))}
      />
      <div className="flex min-h-0 flex-1 flex-col gap-3">
        <Tool key={active} t={t.toolbox} />
      </div>
    </Page>
  )
}
