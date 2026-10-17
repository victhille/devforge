import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft, Code2, Terminal, Star, Trash2, GitBranch, FolderOpen,
  Folder, File, ChevronRight, ChevronDown, Play, RefreshCw
} from 'lucide-react'
import type { Project, FileEntry, GitStatus } from '@shared/types'
import FrameworkIcon, { FRAMEWORK_COLOR, FRAMEWORK_LABEL } from '@renderer/components/ui/FrameworkIcon'
import Button from '@renderer/components/ui/Button'
import { useI18n } from '@renderer/i18n/I18nContext'
import { useConsole } from '@renderer/app/ConsoleContext'
import styles from './ProjectDetailPage.module.css'

// ─── File tree helpers ────────────────────────────────────────────────────────

const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', '.next', 'build', 'out', '.nuxt', 'vendor', '__pycache__', '.cache'])

const EXT_COLORS: Record<string, string> = {
  ts: '#3178C6', tsx: '#3178C6', js: '#F7DF1E', jsx: '#61DAFB',
  css: '#1572B6', scss: '#CF649A', html: '#E34F26', json: '#CBCB41',
  md: '#083FA1', svg: '#FFB13B', png: '#7B68EE', jpg: '#7B68EE', jpeg: '#7B68EE',
  py: '#3776AB', go: '#00ADD8', rs: '#DEA584', php: '#777BB4',
  sh: '#89E051', yml: '#CB171E', yaml: '#CB171E', env: '#ECD53F',
  vue: '#42B883', rb: '#CC342D', java: '#ED8B00', kt: '#7F52FF',
  cs: '#9B4993', cpp: '#F34B7D', c: '#555555', swift: '#FA7343',
}

function fileColor(ext: string | null): string {
  return ext ? (EXT_COLORS[ext.toLowerCase()] ?? '#6B7280') : '#6B7280'
}

function formatSize(bytes: number | null): string {
  if (bytes === null || bytes === 0) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(iso))
}

function sortEntries(entries: FileEntry[]): FileEntry[] {
  return [...entries]
    .filter(e => !(e.isDirectory && SKIP_DIRS.has(e.name)))
    .sort((a, b) => {
      if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1
      const aH = a.name.startsWith('.')
      const bH = b.name.startsWith('.')
      if (aH !== bH) return aH ? 1 : -1
      return a.name.localeCompare(b.name)
    })
}

// ─── Tree node ────────────────────────────────────────────────────────────────

interface TreeNodeProps {
  entry:    FileEntry
  depth:    number
  dirs:     Map<string, FileEntry[]>
  expanded: Set<string>
  onToggle: (path: string) => void
}

function TreeNode({ entry, depth, dirs, expanded, onToggle }: TreeNodeProps) {
  const isExpanded = expanded.has(entry.path)
  const children   = dirs.get(entry.path)
  const color      = entry.isDirectory ? '#E8B86D' : fileColor(entry.extension)

  return (
    <div>
      <div
        className={`${styles.treeNode} ${entry.isDirectory ? styles.treeDir : ''}`}
        style={{ paddingLeft: `${8 + depth * 14}px` }}
        onClick={() => entry.isDirectory && onToggle(entry.path)}
      >
        <span className={styles.chevron}>
          {entry.isDirectory
            ? (isExpanded ? <ChevronDown size={10} /> : <ChevronRight size={10} />)
            : null}
        </span>
        {entry.isDirectory
          ? (isExpanded
              ? <FolderOpen size={13} color={color} strokeWidth={1.8} />
              : <Folder size={13} color={color} strokeWidth={1.8} />)
          : <File size={13} color={color} strokeWidth={1.8} />}
        <span className={styles.treeLabel}>{entry.name}</span>
        {!entry.isDirectory && entry.size !== null && entry.size > 0 && (
          <span className={styles.treeSize}>{formatSize(entry.size)}</span>
        )}
      </div>
      {entry.isDirectory && isExpanded && children && (
        <div>
          {sortEntries(children).map(child => (
            <TreeNode
              key={child.path}
              entry={child}
              depth={depth + 1}
              dirs={dirs}
              expanded={expanded}
              onToggle={onToggle}
            />
          ))}
          {children.filter(e => !(e.isDirectory && SKIP_DIRS.has(e.name))).length === 0 && (
            <div className={styles.treeEmpty} style={{ paddingLeft: `${22 + (depth + 1) * 14}px` }}>
              empty
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function ProjectDetailPage() {
  const { id }      = useParams<{ id: string }>()
  const navigate    = useNavigate()
  const { t }       = useI18n()
  const console_    = useConsole()

  const [project,   setProject]   = useState<Project | null>(null)
  const [gitStatus, setGitStatus] = useState<GitStatus | null>(null)
  const [scripts,   setScripts]   = useState<Record<string, string>>({})
  const [settings,  setSettings]  = useState<{ defaultIDE: string } | null>(null)

  // File tree state
  const [dirs,     setDirs]     = useState<Map<string, FileEntry[]>>(new Map())
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (!id) return
    window.devforge.getProjects().then(projects => {
      const p = projects.find(x => x.id === id)
      if (!p) { navigate('/projects'); return }
      setProject(p)
      loadDir(p.path)
      setExpanded(new Set([p.path]))
      window.devforge.getGitStatus(p.path).then(setGitStatus).catch(() => {})
      window.devforge.getProjectScripts(p.path).then(setScripts).catch(() => {})
    })
    window.devforge.getSettings().then(s => setSettings({ defaultIDE: s.defaultIDE }))
  }, [id])

  async function loadDir(path: string) {
    if (dirs.has(path)) return
    const entries = await window.devforge.readDirectory(path)
    setDirs(prev => new Map(prev).set(path, entries))
  }

  function toggleDir(path: string) {
    if (expanded.has(path)) {
      setExpanded(prev => { const n = new Set(prev); n.delete(path); return n })
    } else {
      loadDir(path)
      setExpanded(prev => new Set(prev).add(path))
    }
  }

  async function handleRefreshTree() {
    if (!project) return
    setDirs(new Map())
    setExpanded(new Set([project.path]))
    const entries = await window.devforge.readDirectory(project.path)
    setDirs(new Map([[project.path, entries]]))
  }

  async function handleToggleFavorite() {
    if (!project) return
    await window.devforge.toggleFavorite(project.id)
    setProject(p => p ? { ...p, favorite: !p.favorite } : p)
  }

  async function handleOpenIDE() {
    if (!project) return
    const ide = (settings?.defaultIDE ?? 'vscode') as any
    await window.devforge.openInIDE(project.path, ide)
  }

  async function handleTerminal() {
    if (!project) return
    await window.devforge.openTerminal(project.path)
  }

  async function handleRemove() {
    if (!project) return
    if (!window.confirm(`Remove "${project.name}" from DevForge? (The folder will not be deleted.)`)) return
    await window.devforge.removeProject(project.id)
    navigate('/projects')
  }

  function handleRunScript(script: string) {
    if (!project) return
    console_.runScript(project.path, script, project.packageManager, project.name)
  }

  if (!project) {
    return (
      <div className={styles.page}>
        <div className={styles.loading}>Loading…</div>
      </div>
    )
  }

  const color       = FRAMEWORK_COLOR[project.framework] ?? '#6B7280'
  const fwLabel     = FRAMEWORK_LABEL[project.framework] ?? project.framework
  const rootEntries = dirs.get(project.path) ?? []
  const scriptList  = Object.entries(scripts)

  return (
    <div className={styles.page}>
      {/* ── Header ── */}
      <div className={styles.header}>
        <button className={styles.backBtn} onClick={() => navigate(-1)}>
          <ArrowLeft size={14} />
        </button>

        <div className={styles.headerIcon} style={{ background: `${color}18`, borderColor: `${color}30` }}>
          <FrameworkIcon name={project.framework} size={16} style={{ color }} />
        </div>

        <div className={styles.headerMeta}>
          <span className={styles.headerName}>{project.name}</span>
          {gitStatus?.branch && (
            <span className={styles.headerBranch}>
              <GitBranch size={11} />
              {gitStatus.branch}
              {gitStatus.dirty && <span className={styles.dirtyDot} />}
            </span>
          )}
        </div>

        <div className={styles.headerActions}>
          <button
            className={`${styles.actionBtn} ${project.favorite ? styles.actionBtnActive : ''}`}
            onClick={handleToggleFavorite}
            title="Favorite"
          >
            <Star size={14} fill={project.favorite ? 'currentColor' : 'none'} />
          </button>
          <button className={styles.actionBtn} onClick={handleOpenIDE} title="Open in IDE">
            <Code2 size={14} />
          </button>
          <button className={styles.actionBtn} onClick={handleTerminal} title="Open terminal">
            <Terminal size={14} />
          </button>
          <button className={`${styles.actionBtn} ${styles.actionBtnDanger}`} onClick={handleRemove} title="Remove">
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {/* ── Body ── */}
      <div className={styles.body}>
        {/* File tree sidebar */}
        <div className={styles.sidebar}>
          <div className={styles.sidebarHeader}>
            <span className={styles.sidebarTitle}>Files</span>
            <button className={styles.refreshBtn} onClick={handleRefreshTree} title="Refresh">
              <RefreshCw size={12} />
            </button>
          </div>
          <div className={styles.tree}>
            {sortEntries(rootEntries).map(entry => (
              <TreeNode
                key={entry.path}
                entry={entry}
                depth={0}
                dirs={dirs}
                expanded={expanded}
                onToggle={toggleDir}
              />
            ))}
            {rootEntries.length === 0 && (
              <div className={styles.treeEmpty} style={{ padding: '12px 16px' }}>
                No files found
              </div>
            )}
          </div>
        </div>

        {/* Info panel */}
        <div className={styles.panel}>
          {/* Project info card */}
          <div className={styles.card}>
            <h3 className={styles.cardTitle}>Project</h3>
            <div className={styles.infoGrid}>
              <div className={styles.infoRow}>
                <span className={styles.infoLabel}>Framework</span>
                <span className={styles.infoValue} style={{ color }}>
                  <FrameworkIcon name={project.framework} size={12} style={{ color }} />
                  {fwLabel}
                </span>
              </div>
              <div className={styles.infoRow}>
                <span className={styles.infoLabel}>Package manager</span>
                <span className={styles.infoValue}>{project.packageManager}</span>
              </div>
              <div className={styles.infoRow}>
                <span className={styles.infoLabel}>Created</span>
                <span className={styles.infoValue}>{formatDate(project.createdAt)}</span>
              </div>
              <div className={styles.infoRow}>
                <span className={styles.infoLabel}>Last opened</span>
                <span className={styles.infoValue}>{formatDate(project.lastOpenedAt)}</span>
              </div>
              <div className={styles.infoRow}>
                <span className={styles.infoLabel}>Path</span>
                <span
                  className={`${styles.infoValue} ${styles.infoPath}`}
                  title={project.path}
                  onClick={() => window.devforge.openDirectory(project.path)}
                >
                  {project.path}
                </span>
              </div>
            </div>
          </div>

          {/* Git card */}
          {gitStatus && (
            <div className={styles.card}>
              <h3 className={styles.cardTitle}>Git</h3>
              <div className={styles.infoGrid}>
                {gitStatus.branch ? (
                  <>
                    <div className={styles.infoRow}>
                      <span className={styles.infoLabel}>Branch</span>
                      <span className={styles.infoValue}>
                        <GitBranch size={11} />
                        {gitStatus.branch}
                      </span>
                    </div>
                    <div className={styles.infoRow}>
                      <span className={styles.infoLabel}>Status</span>
                      <span className={`${styles.infoValue} ${gitStatus.dirty ? styles.statusDirty : styles.statusClean}`}>
                        {gitStatus.dirty ? 'Uncommitted changes' : 'Clean'}
                      </span>
                    </div>
                    {(gitStatus.ahead > 0 || gitStatus.behind > 0) && (
                      <div className={styles.infoRow}>
                        <span className={styles.infoLabel}>Sync</span>
                        <span className={styles.infoValue}>
                          {gitStatus.ahead > 0 && <span className={styles.syncAhead}>↑{gitStatus.ahead}</span>}
                          {gitStatus.behind > 0 && <span className={styles.syncBehind}>↓{gitStatus.behind}</span>}
                        </span>
                      </div>
                    )}
                  </>
                ) : (
                  <div className={styles.infoRow}>
                    <span className={styles.infoLabel}>Repository</span>
                    <span className={styles.infoValue} style={{ color: 'var(--text-muted)' }}>Not initialized</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Scripts card */}
          {scriptList.length > 0 && (
            <div className={styles.card}>
              <h3 className={styles.cardTitle}>Scripts</h3>
              <div className={styles.scriptList}>
                {scriptList.map(([name, cmd]) => (
                  <div key={name} className={styles.scriptRow}>
                    <div className={styles.scriptInfo}>
                      <span className={styles.scriptName}>{name}</span>
                      <span className={styles.scriptCmd}>{cmd}</span>
                    </div>
                    <button
                      className={styles.runBtn}
                      onClick={() => handleRunScript(name)}
                      title={`Run ${name}`}
                    >
                      <Play size={11} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
