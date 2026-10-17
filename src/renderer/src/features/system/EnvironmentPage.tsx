import { useState, useEffect } from 'react'
import { RefreshCw, CheckCircle2, XCircle, ExternalLink } from 'lucide-react'
import type { EnvironmentTool } from '@shared/types'
import { useI18n } from '@renderer/i18n/I18nContext'
import Button from '@renderer/components/ui/Button'
import styles from './EnvironmentPage.module.css'

// ─── Install info per tool ────────────────────────────────────────────────────

interface InstallInfo {
  label: string
  url: string
  note?: string
}

const INSTALL_INFO: Record<string, InstallInfo> = {
  node: {
    label: 'Install Node.js',
    url: 'https://nodejs.org',
    note: 'npm is included with Node.js'
  },
  npm: {
    label: 'Install Node.js',
    url: 'https://nodejs.org',
    note: 'npm is bundled with Node.js'
  },
  pnpm: {
    label: 'Install pnpm',
    url: 'https://pnpm.io/installation',
    note: 'npm install -g pnpm'
  },
  yarn: {
    label: 'Install Yarn',
    url: 'https://yarnpkg.com/getting-started/install',
    note: 'npm install -g yarn'
  },
  git: {
    label: 'Install Git',
    url: 'https://git-scm.com/downloads'
  },
  php: {
    label: 'Install PHP',
    url: 'https://www.php.net/downloads',
    note: 'Required for Symfony projects'
  },
  composer: {
    label: 'Install Composer',
    url: 'https://getcomposer.org/download/',
    note: 'PHP dependency manager — required for Symfony'
  },
  symfony_cli: {
    label: 'Install Symfony CLI',
    url: 'https://symfony.com/download',
    note: 'Optional — enables symfony new & symfony server:start'
  },
  docker: {
    label: 'Install Docker',
    url: 'https://docs.docker.com/get-docker/'
  }
}

// ─── Tool row ─────────────────────────────────────────────────────────────────

function ToolRow({ tool, t }: { tool: EnvironmentTool; t: { notDetected: string; install: string } }) {
  const detected = tool.status === 'detected'
  const install  = !detected ? INSTALL_INFO[tool.id] : undefined

  return (
    <div className={styles.toolRow}>
      <div className={styles.toolLeft}>
        {detected
          ? <CheckCircle2 size={16} className={styles.iconOk} />
          : <XCircle      size={16} className={styles.iconMissing} />
        }
        <div className={styles.toolInfo}>
          <span className={styles.toolName}>{tool.name}</span>
          <span className={styles.toolCommand}>{tool.command}</span>
        </div>
      </div>

      <div className={styles.toolRight}>
        {detected ? (
          <span className={styles.version}>{tool.version}</span>
        ) : install ? (
          <div className={styles.installHint}>
            {install.note && <span className={styles.installNote}>{install.note}</span>}
            <button className={styles.installBtn} onClick={() => window.devforge.openExternal(install.url)}>
              {t.install.replace('{name}', install.label)}
              <ExternalLink size={11} />
            </button>
          </div>
        ) : (
          <span className={styles.versionMissing}>{t.notDetected}</span>
        )}
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const CATEGORIES = [
  { label: 'JavaScript',      ids: ['node', 'npm', 'pnpm', 'yarn'] },
  { label: 'Version Control', ids: ['git'] },
  { label: 'PHP',             ids: ['php', 'composer', 'symfony_cli'] },
  { label: 'Infrastructure',  ids: ['docker'] }
]

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

  const CATEGORIES = [
    { label: t.environment.catJS,    ids: ['node', 'npm', 'pnpm', 'yarn'] },
    { label: t.environment.catVCS,   ids: ['git'] },
    { label: t.environment.catPHP,   ids: ['php', 'composer', 'symfony_cli'] },
    { label: t.environment.catInfra, ids: ['docker'] }
  ]

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>{t.environment.title}</h1>
          <p className={styles.subtitle}>
            {tools.length > 0
              ? t.environment.subtitle.replace('{n}', String(totalDetected)).replace('{total}', String(tools.length))
              : t.environment.subtitleLoading}
          </p>
        </div>
        <Button variant="secondary" size="sm" onClick={refresh} loading={loading}>
          <RefreshCw size={13} /> {t.environment.refresh}
        </Button>
      </div>

      {loading && tools.length === 0 ? (
        <div className={styles.loading}>{t.environment.detecting}</div>
      ) : (
        <div className={styles.content}>
          {CATEGORIES.map(cat => {
            const catTools = getTools(cat.ids)
            if (catTools.length === 0) return null
            return (
              <section key={cat.label} className={styles.section}>
                <h2 className={styles.sectionTitle}>{cat.label}</h2>
                <div className={styles.toolList}>
                  {catTools.map(tool => <ToolRow key={tool.id} tool={tool} t={t.environment} />)}
                </div>
              </section>
            )
          })}
        </div>
      )}
    </div>
  )
}
