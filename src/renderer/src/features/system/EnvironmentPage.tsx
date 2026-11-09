import { useState, type CSSProperties } from 'react'
import { setLive, useLive } from '@renderer/lib/live'
import { Check, Download, RefreshCw } from 'lucide-react'
import type { EnvironmentTool } from '@shared/types'
import { useI18n } from '@renderer/i18n/I18nContext'
import Button from '@renderer/components/ui/Button'
import { Page, PageHeader } from '@renderer/components/ui/Page'
import { Skeleton } from '@renderer/components/ui/Skeleton'
import ProjectCompatibility, { useCompatibility } from './ProjectCompatibility'

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
  python:      { label: 'Python',      url: 'https://www.python.org/downloads/' },
  docker:      { label: 'Docker',      url: 'https://docs.docker.com/get-docker/' }
}

// ─── Tool row ─────────────────────────────────────────────────────────────────

/**
 * As in the mock-up: found, a check, its name and version; missing, a grey
 * dot, its name dimmed and Install (the accent one when a project needs it).
 */
function ToolRow({ tool, usedBy, t }: { tool: EnvironmentTool; usedBy: string[]; t: EnvT }) {
  const detected = tool.status === 'detected'
  const install = !detected ? INSTALL_INFO[tool.id] : undefined
  const hint = install?.command ?? install?.note?.(t)

  return (
    <li className="flex min-h-11 items-center gap-3 px-4 py-2">
      {detected
        ? <Check size={14} aria-hidden className="shrink-0 text-success" />
        : <span aria-hidden className="mx-1 size-2 shrink-0 rounded-full bg-active" />}
      <span className={detected ? 'font-semibold text-fg' : 'text-fg-muted'}>{tool.name}</span>
      {!detected && <span className="sr-only">{t.notDetected}</span>}
      <span className="ml-auto flex min-w-0 items-center gap-3">
        {detected ? (
          <span className="font-mono text-sm text-fg tabular-nums">{tool.version?.replace(/^v(?=\d)/, '')}</span>
        ) : (
          <>
            {usedBy.length > 0
              ? <span className="truncate text-xs text-fg-secondary">{t.usedBy.replace('{names}', usedBy.join(', '))}</span>
              : hint && <span className="truncate font-mono text-xs text-fg-muted" title={hint}>{hint}</span>}
            {install
              ? (
                <Button size="sm" variant={usedBy.length ? 'primary' : 'secondary'} className="shrink-0" aria-label={t.install.replace('{name}', install.label)}
                  onClick={() => window.devforge.openExternal(install.url)}>
                  <Download size={13} aria-hidden /> {t.installShort}
                </Button>
              )
              : <span className="text-sm text-fg-muted italic">{t.notDetected}</span>}
          </>
        )}
      </span>
    </li>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const ENVIRONMENT = 'environment'
const NO_TOOLS: EnvironmentTool[] = []

export default function EnvironmentPage() {
  const { t } = useI18n()
  const e = t.environment
  // The scan, kept five minutes: the page comes back with it at once
  const scan = useLive<EnvironmentTool[]>(ENVIRONMENT, () => window.devforge.detectEnvironment(false), { freshMs: 5 * 60_000 })
  const tools = scan.data ?? NO_TOOLS
  const [forcing, setForcing] = useState(false)
  const loading = forcing || !scan.loaded
  const compat = useCompatibility(tools)

  /** Looks again on the disk (a tool just installed) */
  async function refresh() {
    setForcing(true)
    try { const fresh = await window.devforge.detectEnvironment(true); setLive<EnvironmentTool[]>(ENVIRONMENT, () => fresh) }
    finally { setForcing(false) }
  }

  const totalDetected = tools.filter(tool => tool.status === 'detected').length
  // A missing tool that a project asks for: its names beside Install
  const usedBy = (id: string) => [...new Set(compat.filter(r => r.req.tool === id && r.status === 'missing').map(r => r.project.name))]

  const categories = [
    { label: e.catJS,     ids: ['node', 'npm', 'pnpm', 'yarn'] },
    { label: e.catPHP,    ids: ['php', 'composer', 'symfony_cli'] },
    { label: e.catTools,  ids: ['git', 'docker'] },
    { label: e.catOthers, ids: ['python'] }
  ].map(cat => ({ ...cat, tools: cat.ids.map(id => tools.find(x => x.id === id)).filter((x): x is EnvironmentTool => !!x) }))

  return (
    <Page className="df-mockup">
      <PageHeader
        crumb={t.nav.groupSystem}
        title={e.title}
        subtitle={tools.length > 0
          ? e.subtitle.replace('{n}', String(totalDetected)).replace('{total}', String(tools.length))
          : e.subtitleLoading}
        actions={
          <Button variant="secondary" onClick={refresh} loading={loading}>
            <RefreshCw size={14} aria-hidden /> {e.refresh}
          </Button>
        }
      />

      {loading && tools.length === 0 ? (
        <div role="status" aria-label={e.detecting} className="grid gap-4 lg:grid-cols-2">
          {[4, 3, 2, 1].map(n => (
            <div key={n} className="overflow-hidden rounded-card border border-line-subtle bg-surface">
              <div className="border-b border-line-subtle px-4 py-4"><Skeleton className="h-4 w-28" /></div>
              {Array.from({ length: n }, (_, i) => (
                <div key={i} className="flex items-center gap-3 px-4 py-3.5"><Skeleton className="h-3.5 w-24" /><Skeleton className="ml-auto h-3.5 w-14" /></div>
              ))}
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="grid items-start gap-4 lg:grid-cols-2">
            {categories.filter(cat => cat.tools.length > 0).map((cat, i) => (
              <section key={cat.label} aria-labelledby={`env-cat-${i}`} className="df-rise overflow-hidden rounded-card border border-line-subtle bg-surface" style={{ '--i': i } as CSSProperties}>
                <div className="flex items-center justify-between gap-3 border-b border-line-subtle px-4 py-3.5">
                  <h2 id={`env-cat-${i}`} className="font-display text-md font-bold text-fg">{cat.label}</h2>
                  <span className="text-xs text-fg-muted tabular-nums">
                    {e.catCount.replace('{n}', String(cat.tools.filter(x => x.status === 'detected').length)).replace('{total}', String(cat.tools.length))}
                  </span>
                </div>
                <ul className="divide-y divide-line-subtle">
                  {cat.tools.map(tool => <ToolRow key={tool.id} tool={tool} usedBy={usedBy(tool.id)} t={e} />)}
                </ul>
              </section>
            ))}
          </div>
          <ProjectCompatibility rows={compat} />
        </div>
      )}
    </Page>
  )
}
