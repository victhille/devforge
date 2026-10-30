import type { ComponentType } from 'react'
import {
  Home, FolderOpen, Plus, Monitor, Terminal, Settings, Wifi, BookOpen,
  Wrench, Send, Code, Columns, Key, GitBranch, HardDrive, FileKey2, Rocket, Container, UploadCloud, Activity, Globe, Database, ScrollText, Webhook,
  Code2, Server, Cpu, Workflow, BarChart3, ShieldCheck, AppWindow, HeartPulse, HardDriveDownload, RadioTower, Shapes, type LucideIcon
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
  /** Only listed (menu, palette) once a server is set up; the page itself stays reachable */
  needs?: 'server'
  /** Its page on the documentation site (path under the site, without language) */
  docs?: string
}

/**
 * Single source of truth for pages: the router, the sidebar and the
 * command palette are all built from this list.
 */
export const PAGES: NavPage[] = [
  // Main
  { path: '/projects',    labelKey: 'projects',    icon: FolderOpen, section: 'sectionMain',  load: () => import('@renderer/features/projects/ProjectsPage'), docs: 'dev/projects' },
  { path: '/git',         labelKey: 'git',         icon: GitBranch,  section: 'sectionMain',  load: () => import('@renderer/features/git/GitDashboardPage'), keywords: ['pull', 'push', 'fetch', 'commit', 'branch', 'repo'], docs: 'dev/git' },
  { path: '/activity',    labelKey: 'activityPage', icon: BarChart3, section: 'sectionMain', load: () => import('@renderer/features/git/ActivityPage'), keywords: ['commits', 'activité', 'semaine', 'statistiques', 'stats', 'branches', 'pousser'], docs: 'dev/activity' },
  { path: '/stacks',      labelKey: 'stacks',      icon: Rocket,     section: 'sectionMain',  load: () => import('@renderer/features/stacks/StacksPage'), keywords: ['start', 'démarrer', 'dev server', 'launch', 'lancer', 'stack'], docs: 'dev/stacks' },
  { path: '/new-project', labelKey: 'newProject',  icon: Plus,       section: 'sectionMain',  load: () => import('@renderer/features/projects/new/NewProjectPage'), keywords: ['create', 'créer', 'react', 'vue', 'next', 'symfony'], docs: 'dev/new-project' },

  // Servers
  { path: '/ssh',         labelKey: 'ssh',         icon: Terminal,   section: 'sectionServers', load: () => import('@renderer/features/ssh/SSHPage'), keywords: ['vps', 'server', 'serveur', 'terminal'], docs: 'servers/ssh' },
  { path: '/docker',      labelKey: 'docker',      icon: Container,  section: 'sectionServers', load: () => import('@renderer/features/docker/DockerPage'), keywords: ['container', 'conteneur', 'compose', 'image'], docs: 'dev/docker' },
  { path: '/deploy',      labelKey: 'deploy',      icon: UploadCloud, section: 'sectionServers', load: () => import('@renderer/features/deploy/DeployPage'), keywords: ['deploy', 'déployer', 'production', 'pm2', 'release', 'mise en prod'], docs: 'online/deploy' },
  { path: '/monitor',     labelKey: 'monitor',     icon: Activity,   section: 'sectionServers', load: () => import('@renderer/features/monitor/MonitorPage'), keywords: ['uptime', 'ping', 'status', 'down', 'surveillance'], docs: 'servers/monitoring' },
  { path: '/n8n',         labelKey: 'n8n',         icon: Workflow,   section: 'sectionServers', load: () => import('@renderer/features/n8n/N8nPage'), keywords: ['n8n', 'workflow', 'automation', 'automatisation', 'zapier'], needs: 'server', docs: 'online/n8n' },
  { path: '/services',    labelKey: 'services',    icon: AppWindow,  section: 'sectionServers', load: () => import('@renderer/features/vps/ServicesPage'), keywords: ['portainer', 'phpmyadmin', 'adminer', 'tunnel', 'interface', 'web', 'conteneur'], needs: 'server', docs: 'servers/services' },
  { path: '/health',      labelKey: 'health',      icon: HeartPulse, section: 'sectionServers', load: () => import('@renderer/features/vps/HealthPage'), keywords: ['santé', 'sécurité', 'security', 'updates', 'mises à jour', 'fail2ban', 'disque', 'disk', 'ports'], needs: 'server', docs: 'servers/health' },
  { path: '/backups',     labelKey: 'backups',     icon: HardDriveDownload, section: 'sectionServers', load: () => import('@renderer/features/vps/BackupsPage'), keywords: ['sauvegarde', 'backup', 'restaurer', 'restore', 'dump', 'cron'], needs: 'server', docs: 'servers/backups' },
  { path: '/status',      labelKey: 'statusPage',  icon: RadioTower, section: 'sectionServers', load: () => import('@renderer/features/status/StatusPage'), keywords: ['statut', 'status', 'uptime', 'incident', 'surveillance', 'alerte', 'ntfy', 'disponibilité'], needs: 'server', docs: 'online/status-page' },
  { path: '/vpn',         labelKey: 'vpn',         icon: ShieldCheck, section: 'sectionServers', load: () => import('@renderer/features/vpn/VpnPage'), keywords: ['vpn', 'wireguard', 'wg-easy', 'qr', 'client', 'tunnel'], needs: 'server', docs: 'online/vpn' },

  // System
  { path: '/environment', labelKey: 'environment', icon: Monitor,    section: 'sectionSystem', load: () => import('@renderer/features/system/EnvironmentPage'), keywords: ['node', 'npm', 'php', 'git', 'docker'], docs: 'system/environment' },
  { path: '/ports',       labelKey: 'ports',       icon: Wifi,       section: 'sectionSystem', load: () => import('@renderer/features/system/PortsPage'), keywords: ['netstat', 'process'], docs: 'system/ports' },
  { path: '/env-files',   labelKey: 'envFiles',    icon: FileKey2,   section: 'sectionSystem', load: () => import('@renderer/features/envfiles/EnvFilesPage'), keywords: ['.env', 'dotenv', 'variables', 'secrets', 'config'], docs: 'system/env-files' },
  { path: '/domains',     labelKey: 'domains',     icon: Globe,      section: 'sectionSystem', load: () => import('@renderer/features/domains/DomainsPage'), keywords: ['hosts', '.test', 'domain', 'domaine', 'proxy', 'vhost'], docs: 'system/domains' },
  { path: '/cleaner',     labelKey: 'cleaner',     icon: HardDrive,  section: 'sectionSystem', load: () => import('@renderer/features/cleaner/DiskCleanerPage'), keywords: ['node_modules', 'disk', 'disque', 'space', 'espace', 'clean', 'nettoyer'], docs: 'system/cleaner' },

  // Utilities
  { path: '/toolbox',     labelKey: 'toolbox',     icon: Wrench,     section: 'sectionUtils', load: () => import('@renderer/features/tools/toolbox/ToolboxPage'), keywords: ['json', 'base64', 'jwt', 'regex', 'hash', 'uuid'], docs: 'tools/utilities' },
  { path: '/api-tester',  labelKey: 'apiTester',   icon: Send,       section: 'sectionUtils', load: () => import('@renderer/features/tools/api-tester/ApiTesterPage'), keywords: ['http', 'rest', 'postman', 'fetch'], docs: 'data/api-tester' },
  { path: '/webhooks',    labelKey: 'webhooks',    icon: Webhook,    section: 'sectionUtils', load: () => import('@renderer/features/webhooks/WebhooksPage'), keywords: ['webhook', 'stripe', 'github', 'callback', 'requestbin'], docs: 'data/webhooks' },
  { path: '/database',    labelKey: 'database',    icon: Database,   section: 'sectionUtils', load: () => import('@renderer/features/database/DatabasePage'), keywords: ['sql', 'mysql', 'postgres', 'sqlite', 'bdd', 'db', 'query'], docs: 'data/database' },
  { path: '/modeling',    labelKey: 'modeling',    icon: Shapes,     section: 'sectionUtils', load: () => import('@renderer/features/modeling/ModelingPage'), keywords: ['mcd', 'mld', 'mpd', 'merise', 'uml', 'diagramme', 'diagram', 'conception', 'modèle', "cas d'utilisation", 'use case'], docs: 'data/modeling' },
  { path: '/logs',        labelKey: 'logs',        icon: ScrollText, section: 'sectionUtils', load: () => import('@renderer/features/logs/LogsPage'), keywords: ['tail', 'log', 'laravel.log', 'nginx', 'error'], docs: 'data/logs' },
  { path: '/snippets',    labelKey: 'snippets',    icon: Code,       section: 'sectionUtils', load: () => import('@renderer/features/tools/snippets/SnippetsPage'), docs: 'tools/utilities' },
  { path: '/diff',        labelKey: 'diff',        icon: Columns,    section: 'sectionUtils', load: () => import('@renderer/features/tools/diff/DiffPage'), keywords: ['compare', 'comparer'], docs: 'tools/utilities' },
  { path: '/generator',   labelKey: 'generator',   icon: Key,        section: 'sectionUtils', load: () => import('@renderer/features/tools/generator/GeneratorPage'), keywords: ['password', 'mot de passe', 'secret', 'token'], docs: 'tools/utilities' },
  { path: '/docs',        labelKey: 'docs',        icon: BookOpen,   section: 'sectionUtils', load: () => import('@renderer/features/docs/DocsPage'), keywords: ['cheatsheet', 'commandes', 'commands'], docs: 'tools/utilities' },

  // Pinned at the bottom of the sidebar
  { path: '/settings',    labelKey: 'settings',    icon: Settings,                            load: () => import('@renderer/features/settings/SettingsPage'), keywords: ['theme', 'thème', 'langue', 'language'], docs: 'settings/general' },

  // Routed only (detail pages)
  { path: '/project',     route: '/project/:id',          labelKey: 'projects', icon: FolderOpen, load: () => import('@renderer/features/projects/ProjectDetailPage'), docs: 'dev/projects' },
  { path: '/model',       route: '/model',                labelKey: 'modeling', icon: Shapes,     load: () => import('@renderer/features/modeling/ModelEditorPage'), docs: 'data/modeling' },
  { path: '/vps',         route: '/vps/:connectionId',    labelKey: 'ssh',      icon: Terminal,   load: () => import('@renderer/features/ssh/vps/VPSDashboardPage'), docs: 'servers/ssh' }
]

/** Home is not lazy-loaded: it is the first screen. */
export const HOME = { path: '/', labelKey: 'home' as NavKey, icon: Home, docs: 'getting-started/interface' }

/** Project page tabs with a documentation page of their own (the others: the project page's) */
export const PROJECT_TAB_DOCS: Record<string, string> = { packages: 'dev/packages' }

/** The documentation of the page at this address (detail pages count for their parent, a project tab may have its own), the interface overview otherwise */
export function docsOf(pathname: string, search = ''): string {
  if (pathname === '/') return HOME.docs
  const tab = pathname.startsWith('/project/') ? new URLSearchParams(search).get('tab') : null
  if (tab && PROJECT_TAB_DOCS[tab]) return PROJECT_TAB_DOCS[tab]
  const page = PAGES.find(p => pathname === p.path || pathname.startsWith(p.path + '/'))
  return page?.docs ?? HOME.docs
}

export const SECTIONS: SectionKey[] = ['sectionMain', 'sectionServers', 'sectionSystem', 'sectionUtils']

/** Pages shown in the sidebar and the palette. */
export const LISTED_PAGES = PAGES.filter(p => !p.route)

/** Listed now: a page that needs a server waits for one */
export const isListed = (path: string, hasServer: boolean) => hasServer || PAGES.find(p => p.path === path)?.needs !== 'server'

/**
 * Sidebar layout: a few favorites always visible, every other page in a
 * folding group. Settings is pinned at the bottom on its own.
 */
export { DEFAULT_FAVORITES } from '@shared/lib/favorites'

export type GroupKey = 'groupDev' | 'groupServers' | 'groupOnline' | 'groupData' | 'groupSystem' | 'groupTools'

/** Five pages at most per group: a group stays readable at a glance */
export const MENU_GROUPS: { key: GroupKey; icon: LucideIcon; paths: string[] }[] = [
  { key: 'groupDev',     icon: Code2,       paths: ['/projects', '/new-project', '/git', '/activity', '/stacks'] },
  { key: 'groupServers', icon: Server,      paths: ['/ssh', '/health', '/services', '/backups', '/monitor'] },
  { key: 'groupOnline',  icon: UploadCloud, paths: ['/deploy', '/docker', '/n8n', '/vpn', '/status'] },
  { key: 'groupData',    icon: Database,    paths: ['/database', '/modeling', '/api-tester', '/webhooks', '/logs'] },
  { key: 'groupSystem',  icon: Cpu,         paths: ['/environment', '/ports', '/env-files', '/domains', '/cleaner'] },
  { key: 'groupTools',   icon: Wrench,      paths: ['/toolbox', '/snippets', '/diff', '/generator', '/docs'] }
]

/** Group holding a route (detail pages count for their parent: /vps/… is SSH) */
export function groupOf(pathname: string): GroupKey | null {
  const path = pathname.startsWith('/vps/') ? '/ssh' : pathname
  return MENU_GROUPS.find(g => g.paths.some(p => path === p || path.startsWith(p + '/')))?.key ?? null
}
