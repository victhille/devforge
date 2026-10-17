import { NavLink } from 'react-router-dom'
import {
  Home, FolderOpen, Plus, Monitor, Terminal, Settings, Wifi, BookOpen,
  Wrench, Send, Code, Columns, Key,
  type LucideIcon
} from 'lucide-react'
import { useI18n } from '../../i18n/I18nContext'
import styles from './Sidebar.module.css'

interface NavItem { to: string; labelKey: keyof ReturnType<typeof useI18n>['t']['nav']; Icon: LucideIcon }

const NAV_MAIN: NavItem[] = [
  { to: '/',            labelKey: 'home',        Icon: Home },
  { to: '/projects',    labelKey: 'projects',    Icon: FolderOpen },
  { to: '/new-project', labelKey: 'newProject',  Icon: Plus }
]

const NAV_TOOLS: NavItem[] = [
  { to: '/ssh',         labelKey: 'ssh',         Icon: Terminal },
  { to: '/environment', labelKey: 'environment', Icon: Monitor },
  { to: '/ports',       labelKey: 'ports',       Icon: Wifi },
  { to: '/docs',        labelKey: 'docs',        Icon: BookOpen },
  { to: '/settings',    labelKey: 'settings',    Icon: Settings }
]

const NAV_UTILS: NavItem[] = [
  { to: '/toolbox',    labelKey: 'toolbox',   Icon: Wrench },
  { to: '/api-tester', labelKey: 'apiTester', Icon: Send },
  { to: '/snippets',   labelKey: 'snippets',  Icon: Code },
  { to: '/diff',       labelKey: 'diff',      Icon: Columns },
  { to: '/generator',  labelKey: 'generator', Icon: Key }
]

export default function Sidebar() {
  const { t } = useI18n()

  function NavItems({ items }: { items: NavItem[] }) {
    return (
      <>
        {items.map(({ to, labelKey, Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) => `${styles.navItem} ${isActive ? styles.active : ''}`}
          >
            <Icon size={16} className={styles.icon} />
            <span className={styles.label}>{t.nav[labelKey]}</span>
          </NavLink>
        ))}
      </>
    )
  }

  return (
    <aside className={styles.sidebar}>
      <nav className={styles.nav}>
        <div className={styles.section}>
          <span className={styles.sectionLabel}>{t.nav.sectionMain}</span>
          <NavItems items={NAV_MAIN} />
        </div>
        <div className={styles.section}>
          <span className={styles.sectionLabel}>{t.nav.sectionTools}</span>
          <NavItems items={NAV_TOOLS} />
        </div>
        <div className={styles.section}>
          <span className={styles.sectionLabel}>{t.nav.sectionUtils}</span>
          <NavItems items={NAV_UTILS} />
        </div>
      </nav>
      <div className={styles.footer}>
        <span className={styles.version}>v0.1.0</span>
      </div>
    </aside>
  )
}
