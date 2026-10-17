import { NavLink } from 'react-router-dom'
import {
  Home, FolderOpen, Plus, Monitor, Terminal, Settings, Wifi, BookOpen,
  Wrench, Send, Code, Columns, Key,
  type LucideIcon
} from 'lucide-react'
import { useI18n } from '@renderer/i18n/I18nContext'
import { cn } from '@renderer/lib/cn'

type NavKey = keyof ReturnType<typeof useI18n>['t']['nav']
interface NavItem { to: string; labelKey: NavKey; Icon: LucideIcon }

const NAV_SECTIONS: { labelKey: NavKey; items: NavItem[] }[] = [
  {
    labelKey: 'sectionMain',
    items: [
      { to: '/',            labelKey: 'home',        Icon: Home },
      { to: '/projects',    labelKey: 'projects',    Icon: FolderOpen },
      { to: '/new-project', labelKey: 'newProject',  Icon: Plus }
    ]
  },
  {
    labelKey: 'sectionTools',
    items: [
      { to: '/ssh',         labelKey: 'ssh',         Icon: Terminal },
      { to: '/environment', labelKey: 'environment', Icon: Monitor },
      { to: '/ports',       labelKey: 'ports',       Icon: Wifi },
      { to: '/docs',        labelKey: 'docs',        Icon: BookOpen }
    ]
  },
  {
    labelKey: 'sectionUtils',
    items: [
      { to: '/toolbox',    labelKey: 'toolbox',   Icon: Wrench },
      { to: '/api-tester', labelKey: 'apiTester', Icon: Send },
      { to: '/snippets',   labelKey: 'snippets',  Icon: Code },
      { to: '/diff',       labelKey: 'diff',      Icon: Columns },
      { to: '/generator',  labelKey: 'generator', Icon: Key }
    ]
  }
]

function NavEntry({ to, label, Icon }: { to: string; label: string; Icon: LucideIcon }) {
  return (
    <NavLink
      to={to}
      end={to === '/'}
      className={({ isActive }) => cn(
        'group relative flex h-9 items-center gap-3 rounded-lg px-3 text-base transition-colors',
        isActive
          ? 'bg-active font-medium text-fg'
          : 'text-fg-secondary hover:bg-hover hover:text-fg'
      )}
    >
      {({ isActive }) => (
        <>
          {/* Active indicator bar */}
          <span
            className={cn(
              'absolute top-2 bottom-2 -left-2.5 w-[3px] rounded-r-full bg-accent transition-opacity',
              isActive ? 'opacity-100' : 'opacity-0'
            )}
          />
          <Icon
            size={17}
            strokeWidth={isActive ? 2.2 : 1.8}
            className={cn('shrink-0 transition-colors', isActive ? 'text-accent' : 'text-fg-muted group-hover:text-fg-secondary')}
          />
          <span className="truncate">{label}</span>
        </>
      )}
    </NavLink>
  )
}

export default function Sidebar() {
  const { t } = useI18n()

  return (
    <aside className="flex w-[232px] shrink-0 flex-col overflow-hidden border-r border-line-subtle bg-surface">
      <nav className="flex flex-1 flex-col gap-5 overflow-y-auto px-2.5 py-4">
        {NAV_SECTIONS.map(section => (
          <div key={section.labelKey} className="flex flex-col gap-0.5">
            <span className="px-3 pb-1.5 text-2xs font-semibold uppercase tracking-widest text-fg-muted">
              {t.nav[section.labelKey]}
            </span>
            {section.items.map(item => (
              <NavEntry key={item.to} to={item.to} label={t.nav[item.labelKey]} Icon={item.Icon} />
            ))}
          </div>
        ))}
      </nav>

      {/* Settings pinned at the bottom, with the version */}
      <div className="flex flex-col gap-1.5 border-t border-line-subtle px-2.5 py-2.5">
        <NavEntry to="/settings" label={t.nav.settings} Icon={Settings} />
        <span className="px-3 text-2xs text-fg-muted">v{__APP_VERSION__}</span>
      </div>
    </aside>
  )
}
