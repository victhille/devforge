import { useState, useEffect } from 'react'
import { RefreshCw, CheckCircle2, XCircle, ExternalLink } from 'lucide-react'
import type { EnvironmentTool } from '@shared/types'
import { useI18n } from '@renderer/i18n/I18nContext'
import Badge from '@renderer/components/ui/Badge'
import Button from '@renderer/components/ui/Button'
import Card from '@renderer/components/ui/Card'
import { Page, PageHeader, SectionTitle } from '@renderer/components/ui/Page'
import ProjectCompatibility from './ProjectCompatibility'

// ─── Install info per tool ────────────────────────────────────────────────────

type EnvT = ReturnType<typeof useI18n>['t']['environment']

interface InstallInfo {
  label: string
  url: string
  /** A sentence about the tool (translated) */
  note?: (t: EnvT) => string
  /** The command that installs it */
  command?: string
}

const INSTALL_INFO: Record<string, InstallInfo> = {
  node:        { label: 'Node.js',     url: 'https://nodejs.org',                          note: t => t.noteNpm },
  npm:         { label: 'Node.js',     url: 'https://nodejs.org',                          note: t => t.noteNpm },
  pnpm:        { label: 'pnpm',        url: 'https://pnpm.io/installation',                command: 'npm install -g pnpm' },
  yarn:        { label: 'Yarn',        url: 'https://yarnpkg.com/getting-started/install', command: 'npm install -g yarn' },
  git:         { label: 'Git',         url: 'https://git-scm.com/downloads' },
  php:         { label: 'PHP',         url: 'https://www.php.net/downloads',               note: t => t.notePhp },
  composer:    { label: 'Composer',    url: 'https://getcomposer.org/download/',           note: t => t.noteComposer },
  symfony_cli: { label: 'Symfony CLI', url: 'https://symfony.com/download',                note: t => t.noteSymfony },
  docker:      { label: 'Docker',      url: 'https://docs.docker.com/get-docker/' }
}

// ─── Tool row ─────────────────────────────────────────────────────────────────

function ToolRow({ tool, t }: { tool: EnvironmentTool; t: EnvT }) {
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
          <Badge color="success" mono>{tool.version}</Badge>
        ) : install ? (
          <div className="flex flex-col items-end gap-1">
            {install.note && <span className="text-right text-xs text-fg-muted">{install.note(t)}</span>}
            {install.command && <code className="font-mono text-xs text-fg-muted">{install.command}</code>}
            <Button
              size="sm"
              variant="secondary"
              className="border-accent bg-accent-soft text-accent hover:bg-accent hover:text-accent-fg"
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

  async function refresh(force = false) {
    setLoading(true)
    try { setTools(await window.devforge.detectEnvironment(force)) }
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
    { label: 'Python',               ids: ['python'] },
    { label: t.environment.catInfra, ids: ['docker'] }
  ]

  return (
    <Page>
      <PageHeader
        crumb={t.nav.groupSystem}
        title={t.environment.title}
        subtitle={tools.length > 0
          ? t.environment.subtitle.replace('{n}', String(totalDetected)).replace('{total}', String(tools.length))
          : t.environment.subtitleLoading}
        actions={
          <Button variant="secondary" size="sm" onClick={() => refresh(true)} loading={loading}>
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
                <div className="flex items-baseline justify-between gap-3">
                  <SectionTitle>{cat.label}</SectionTitle>
                  <span className="text-xs text-fg-muted tabular-nums">
                    {t.environment.catCount
                      .replace('{n}', String(catTools.filter(x => x.status === 'detected').length))
                      .replace('{total}', String(catTools.length))}
                  </span>
                </div>
                <Card className="overflow-hidden">
                  {catTools.map(tool => <ToolRow key={tool.id} tool={tool} t={t.environment} />)}
                </Card>
              </section>
            )
          })}
          <ProjectCompatibility tools={tools} />
        </div>
      )}
    </Page>
  )
}
