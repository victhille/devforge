import type { ComponentType } from 'react'
import {
  Home, FolderOpen, Plus, Monitor, Terminal, Settings, Wifi, BookOpen,
  Wrench, Send, Code, Columns, Key, GitBranch, HardDrive, FileKey2, Rocket,
  type LucideIcon
} from 'lucide-react'
import type { Translations } from '@renderer/i18n/translations'

export type NavKey = keyof Translations['nav']
export type SectionKey = 'sectionMain' | 'sectionServers' | 'sectionSystem' | 'sectionUtils'

type PageModule = Promise<{ default: ComponentType }>

export interface NavPage {
  /** URL used for navigation */
  path: string
  /** Router pattern when it differs from `path` (params) */
  route?: string
  labelKey: NavKey
  icon: LucideIcon
  /** Sidebar section; pages without one are routed but not listed */
  section?: SectionKey
  load: () => PageModule
  /** Extra words matched by the command palette */
  keywords?: string[]
}

/**
 * Single source of truth for pages: the router, the sidebar and the
 * command palette are all built from this list.
 */
export const PAGES: NavPage[] = [
  // Main
  { path: '/projects',    labelKey: 'projects',    icon: FolderOpen, section: 'sectionMain',  load: () => import('@renderer/features/projects/ProjectsPage') },
  { path: '/git',         labelKey: 'git',         icon: GitBranch,  section: 'sectionMain',  load: () => import('@renderer/features/git/GitDashboardPage'), keywords: ['pull', 'push', 'fetch', 'commit', 'branch', 'repo'] },
  { path: '/stacks',      labelKey: 'stacks',      icon: Rocket,     section: 'sectionMain',  load: () => import('@renderer/features/stacks/StacksPage'), keywords: ['start', 'démarrer', 'dev server', 'launch', 'lancer', 'stack'] },
  { path: '/new-project', labelKey: 'newProject',  icon: Plus,       section: 'sectionMain',  load: () => import('@renderer/features/projects/new/NewProjectPage'), keywords: ['create', 'créer', 'react', 'vue', 'next', 'symfony'] },

  // Servers
  { path: '/ssh',         labelKey: 'ssh',         icon: Terminal,   section: 'sectionServers', load: () => import('@renderer/features/ssh/SSHPage'), keywords: ['vps', 'server', 'serveur', 'terminal'] },

  // System
  { path: '/environment', labelKey: 'environment', icon: Monitor,    section: 'sectionSystem', load: () => import('@renderer/features/system/EnvironmentPage'), keywords: ['node', 'npm', 'php', 'git', 'docker'] },
  { path: '/ports',       labelKey: 'ports',       icon: Wifi,       section: 'sectionSystem', load: () => import('@renderer/features/system/PortsPage'), keywords: ['netstat', 'process'] },
  { path: '/env-files',   labelKey: 'envFiles',    icon: FileKey2,   section: 'sectionSystem', load: () => import('@renderer/features/envfiles/EnvFilesPage'), keywords: ['.env', 'dotenv', 'variables', 'secrets', 'config'] },
  { path: '/cleaner',     labelKey: 'cleaner',     icon: HardDrive,  section: 'sectionSystem', load: () => import('@renderer/features/cleaner/DiskCleanerPage'), keywords: ['node_modules', 'disk', 'disque', 'space', 'espace', 'clean', 'nettoyer'] },

  // Utilities
  { path: '/toolbox',     labelKey: 'toolbox',     icon: Wrench,     section: 'sectionUtils', load: () => import('@renderer/features/tools/toolbox/ToolboxPage'), keywords: ['json', 'base64', 'jwt', 'regex', 'hash', 'uuid'] },
  { path: '/api-tester',  labelKey: 'apiTester',   icon: Send,       section: 'sectionUtils', load: () => import('@renderer/features/tools/api-tester/ApiTesterPage'), keywords: ['http', 'rest', 'postman', 'fetch'] },
  { path: '/snippets',    labelKey: 'snippets',    icon: Code,       section: 'sectionUtils', load: () => import('@renderer/features/tools/snippets/SnippetsPage') },
  { path: '/diff',        labelKey: 'diff',        icon: Columns,    section: 'sectionUtils', load: () => import('@renderer/features/tools/diff/DiffPage'), keywords: ['compare', 'comparer'] },
  { path: '/generator',   labelKey: 'generator',   icon: Key,        section: 'sectionUtils', load: () => import('@renderer/features/tools/generator/GeneratorPage'), keywords: ['password', 'mot de passe', 'secret', 'token'] },
  { path: '/docs',        labelKey: 'docs',        icon: BookOpen,   section: 'sectionUtils', load: () => import('@renderer/features/docs/DocsPage'), keywords: ['cheatsheet', 'commandes', 'commands'] },

  // Pinned at the bottom of the sidebar
  { path: '/settings',    labelKey: 'settings',    icon: Settings,                            load: () => import('@renderer/features/settings/SettingsPage'), keywords: ['theme', 'thème', 'langue', 'language'] },

  // Routed only (detail pages)
  { path: '/project',     route: '/project/:id',          labelKey: 'projects', icon: FolderOpen, load: () => import('@renderer/features/projects/ProjectDetailPage') },
  { path: '/vps',         route: '/vps/:connectionId',    labelKey: 'ssh',      icon: Terminal,   load: () => import('@renderer/features/ssh/vps/VPSDashboardPage') }
]

/** Home is not lazy-loaded: it is the first screen. */
export const HOME = { path: '/', labelKey: 'home' as NavKey, icon: Home }

export const SECTIONS: SectionKey[] = ['sectionMain', 'sectionServers', 'sectionSystem', 'sectionUtils']

/** Pages shown in the sidebar and the palette. */
export const LISTED_PAGES = PAGES.filter(p => !p.route)
