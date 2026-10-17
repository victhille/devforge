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
      { to: '/docs',        labelKey: 'docs',        Icon: BookOpen },
      { to: '/settings',    labelKey: 'settings',    Icon: Settings }
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

export default function Sidebar() {
  const { t } = useI18n()

  return (
    <aside className="flex w-[220px] shrink-0 flex-col overflow-hidden border-r border-line-subtle bg-surface">
      <nav className="flex flex-1 flex-col gap-5 overflow-y-auto px-2 py-3">
        {NAV_SECTIONS.map(section => (
          <div key={section.labelKey} className="flex flex-col gap-0.5">
            <span className="px-2 pb-1.5 text-2xs font-semibold uppercase tracking-widest text-fg-muted">
              {t.nav[section.labelKey]}
            </span>
            {section.items.map(({ to, labelKey, Icon }) => (
              <NavLink
                key={to}
                to={to}
                end={to === '/'}
                className={({ isActive }) => cn(
                  'group flex items-center gap-2.5 rounded-lg px-2.5 py-[7px] text-base transition-colors',
                  isActive
                    ? 'bg-accent-soft text-accent'
                    : 'text-fg-secondary hover:bg-hover hover:text-fg'
                )}
              >
                {({ isActive }) => (
                  <>
                    <Icon
                      size={16}
                      className={cn(
                        'shrink-0 transition-colors',
                        isActive ? 'text-accent' : 'text-fg-muted group-hover:text-fg-secondary'
                      )}
                    />
                    <span className="flex-1">{t.nav[labelKey]}</span>
                  </>
                )}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>
      <div className="border-t border-line-subtle px-4 py-3 text-xs text-fg-muted">
        v{__APP_VERSION__}
      </div>
    </aside>
  )
}
