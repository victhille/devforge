import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Code2, FolderOpen, Info, Server, Terminal, Play, Rocket, type LucideIcon } from 'lucide-react'
import type { Project, SSHConnection, Stack } from '@shared/types'
import { useI18n } from '@renderer/i18n/I18nContext'
import { useConsole } from '@renderer/app/ConsoleContext'
import { HOME, LISTED_PAGES, type NavPage } from '@renderer/app/navigation'
import { useActions } from './useActions'

export interface Command {
  id: string
  group: string
  title: string
  subtitle?: string
  icon: LucideIcon
  /** Hex color for the icon, e.g. a project's framework */
  color?: string
  keywords?: string
  /** Asked before the command runs (it changes something) */
  confirm?: string
  /** A promise: the palette says when it is done, or why it failed */
  run: () => void | Promise<void>
}

/** Every action the palette can run, built from pages, projects and SSH connections. */
export function useCommands(open: boolean): Command[] {
  const { t } = useI18n()
  const navigate = useNavigate()
  const { runScript } = useConsole()
  const [projects, setProjects] = useState<Project[]>([])
  const [connections, setConnections] = useState<SSHConnection[]>([])
  const [scripts, setScripts] = useState<Record<string, Record<string, string>>>({})
  const [stacks, setStacks] = useState<Stack[]>([])
  const actions = useActions(open)

  // Refresh data each time the palette opens (cheap local reads)
  useEffect(() => {
    if (!open) return
    window.devforge.getProjects().then(list => {
      setProjects(list)
      Promise.all(list.map(p =>
        window.devforge.getProjectScripts(p.path).then(s => [p.id, s] as const).catch(() => [p.id, {}] as const)
      )).then(entries => setScripts(Object.fromEntries(entries)))
    })
    window.devforge.getSshConnections().then(setConnections)
    window.devforge.stacks.list().then(setStacks)
  }, [open])

  return useMemo(() => {
    const c = t.palette
    const list: Command[] = []

    // Pages
    const pages: Pick<NavPage, 'path' | 'labelKey' | 'icon' | 'keywords'>[] = [HOME, ...LISTED_PAGES]
    for (const p of pages) {
      list.push({
        id: `page:${p.path}`,
        group: c.groupPages,
        title: t.nav[p.labelKey],
        icon: p.icon,
        keywords: p.keywords?.join(' '),
        run: () => navigate(p.path)
      })
    }

    // Stacks
    for (const st of stacks) {
      list.push({
        id: `stack:${st.id}`,
        group: c.groupStacks,
        title: `${c.startStack} — ${st.name}`,
        icon: Rocket,
        color: st.color,
        keywords: 'stack launch lancer',
        run: () => { window.devforge.stacks.start(st.id); navigate('/stacks') }
      })
    }

    // Projects
    for (const p of projects) {
      list.push(
        { id: `proj:code:${p.id}`,   group: c.groupProjects, title: `${c.openInVSCode} — ${p.name}`, subtitle: p.path, icon: Code2,      keywords: p.framework, run: () => { window.devforge.updateProjectLastOpened(p.id); window.devforge.openInIDE(p.path, 'vscode') } },
        { id: `proj:detail:${p.id}`, group: c.groupProjects, title: `${c.details} — ${p.name}`,      subtitle: p.path, icon: Info,       run: () => navigate(`/project/${p.id}`) },
        { id: `proj:folder:${p.id}`, group: c.groupProjects, title: `${c.openFolder} — ${p.name}`,   subtitle: p.path, icon: FolderOpen, run: () => window.devforge.openDirectory(p.path) },
        { id: `proj:term:${p.id}`,   group: c.groupProjects, title: `${c.terminal} — ${p.name}`,     subtitle: p.path, icon: Terminal,   run: () => window.devforge.openTerminal(p.path) }
      )
      for (const script of Object.keys(scripts[p.id] ?? {})) {
        list.push({
          id: `script:${p.id}:${script}`,
          group: c.groupScripts,
          title: `${p.name} › ${script}`,
          subtitle: scripts[p.id][script],
          icon: Play,
          keywords: 'npm run',
          run: () => runScript(p.path, script, p.packageManager, p.name)
        })
      }
    }

    // SSH connections
    for (const conn of connections) {
      list.push({
        id: `ssh:${conn.id}`,
        group: c.groupServers,
        title: `${c.dashboard} — ${conn.name}`,
        subtitle: `${conn.username}@${conn.host}`,
        icon: Server,
        color: conn.color,
        keywords: 'vps ssh',
        run: () => navigate(`/vps/${conn.id}`)
      })
    }

    // Actions after the pages: they show first for a matching search
    return [...list.slice(0, pages.length), ...actions, ...list.slice(pages.length)]
  }, [t, navigate, runScript, projects, scripts, connections, stacks, actions])
}

/** Lowercase, accent-free text for matching. */
function normalize(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

/**
 * Score a command against the query: every word must appear somewhere;
 * matches at word starts in the title rank higher. 0 = no match.
 */
export function scoreCommand(cmd: Command, query: string): number {
  const words = normalize(query).split(/\s+/).filter(Boolean)
  if (words.length === 0) return 1
  const title = normalize(cmd.title)
  const hay = `${title} ${normalize(cmd.subtitle ?? '')} ${normalize(cmd.keywords ?? '')} ${normalize(cmd.group)}`
  let score = 0
  for (const w of words) {
    if (!hay.includes(w)) return 0
    if (title.startsWith(w)) score += 3
    else if (title.includes(` ${w}`)) score += 2
    else if (title.includes(w)) score += 1.5
    else score += 0.5
  }
  return score
}
