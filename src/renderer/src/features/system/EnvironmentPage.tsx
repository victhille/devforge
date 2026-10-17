import { useState, useEffect } from 'react'
import { RefreshCw, CheckCircle2, XCircle, ExternalLink } from 'lucide-react'
import type { EnvironmentTool } from '@shared/types'
import { useI18n } from '@renderer/i18n/I18nContext'
import Button from '@renderer/components/ui/Button'
import Card from '@renderer/components/ui/Card'
import { Page, PageHeader, SectionTitle } from '@renderer/components/ui/Page'

// ─── Install info per tool ────────────────────────────────────────────────────

interface InstallInfo {
  label: string
  url: string
  note?: string
}

const INSTALL_INFO: Record<string, InstallInfo> = {
  node:        { label: 'Install Node.js',     url: 'https://nodejs.org',                          note: 'npm is included with Node.js' },
  npm:         { label: 'Install Node.js',     url: 'https://nodejs.org',                          note: 'npm is bundled with Node.js' },
  pnpm:        { label: 'Install pnpm',        url: 'https://pnpm.io/installation',                note: 'npm install -g pnpm' },
  yarn:        { label: 'Install Yarn',        url: 'https://yarnpkg.com/getting-started/install', note: 'npm install -g yarn' },
  git:         { label: 'Install Git',         url: 'https://git-scm.com/downloads' },
  php:         { label: 'Install PHP',         url: 'https://www.php.net/downloads',               note: 'Required for Symfony projects' },
  composer:    { label: 'Install Composer',    url: 'https://getcomposer.org/download/',           note: 'PHP dependency manager — required for Symfony' },
  symfony_cli: { label: 'Install Symfony CLI', url: 'https://symfony.com/download',                note: 'Optional — enables symfony new & symfony server:start' },
  docker:      { label: 'Install Docker',      url: 'https://docs.docker.com/get-docker/' }
}

// ─── Tool row ─────────────────────────────────────────────────────────────────

function ToolRow({ tool, t }: { tool: EnvironmentTool; t: { notDetected: string; install: string } }) {
  const detected = tool.status === 'detected'
  const install  = !detected ? INSTALL_INFO[tool.id] : undefined

  return (
    <div className="flex min-h-14 items-center justify-between gap-4 border-b border-line-subtle px-5 py-3 transition-colors last:border-0 hover:bg-elevated">
      <div className="flex items-center gap-3">
        {detected
          ? <CheckCircle2 size={16} className="shrink-0 text-success" />
          : <XCircle      size={16} className="shrink-0 text-danger" />}
        <div className="flex flex-col gap-0.5">
          <span className="font-medium text-fg">{tool.name}</span>
          <span className="font-mono text-xs text-fg-muted">{tool.command}</span>
        </div>
      </div>

      <div className="flex shrink-0 items-center justify-end">
        {detected ? (
          <span className="rounded bg-success-soft px-2 py-0.5 font-mono text-sm text-success">{tool.version}</span>
        ) : install ? (
          <div className="flex flex-col items-end gap-1">
            {install.note && <span className="text-right text-xs italic text-fg-muted">{install.note}</span>}
            <Button
              size="sm"
              variant="secondary"
              className="border-accent bg-accent-soft text-accent hover:bg-accent hover:text-white"
              onClick={() => window.devforge.openExternal(install.url)}
            >
              {t.install.replace('{name}', install.label)}
              <ExternalLink size={11} />
            </Button>
          </div>
        ) : (
          <span className="text-sm italic text-fg-muted">{t.notDetected}</span>
        )}
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function EnvironmentPage() {
  const { t } = useI18n()
  const [tools, setTools]     = useState<EnvironmentTool[]>([])
  const [loading, setLoading] = useState(false)

  async function refresh() {
    setLoading(true)
    try { setTools(await window.devforge.detectEnvironment()) }
    finally { setLoading(false) }
  }

  useEffect(() => { refresh() }, [])

  function getTools(ids: string[]) {
    return ids.map(id => tools.find(tool => tool.id === id)).filter(Boolean) as EnvironmentTool[]
  }

  const totalDetected = tools.filter(tool => tool.status === 'detected').length

  const categories = [
    { label: t.environment.catJS,    ids: ['node', 'npm', 'pnpm', 'yarn'] },
    { label: t.environment.catVCS,   ids: ['git'] },
    { label: t.environment.catPHP,   ids: ['php', 'composer', 'symfony_cli'] },
    { label: t.environment.catInfra, ids: ['docker'] }
  ]

  return (
    <Page>
      <PageHeader
        title={t.environment.title}
        subtitle={tools.length > 0
          ? t.environment.subtitle.replace('{n}', String(totalDetected)).replace('{total}', String(tools.length))
          : t.environment.subtitleLoading}
        actions={
          <Button variant="secondary" size="sm" onClick={refresh} loading={loading}>
            <RefreshCw size={13} /> {t.environment.refresh}
          </Button>
        }
      />

      {loading && tools.length === 0 ? (
        <p className="py-5 text-fg-muted">{t.environment.detecting}</p>
      ) : (
        <div className="flex flex-col gap-6">
          {categories.map(cat => {
            const catTools = getTools(cat.ids)
            if (catTools.length === 0) return null
            return (
              <section key={cat.label} className="flex flex-col gap-2">
                <SectionTitle>{cat.label}</SectionTitle>
                <Card className="overflow-hidden">
                  {catTools.map(tool => <ToolRow key={tool.id} tool={tool} t={t.environment} />)}
                </Card>
              </section>
            )
          })}
        </div>
      )}
    </Page>
  )
}
