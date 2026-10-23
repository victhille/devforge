import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AppWindow, ExternalLink, GitPullRequestArrow, HardDriveDownload, HeartPulse, Minimize2, Moon, RefreshCw, RotateCcw, ShieldPlus, Sun, type LucideIcon } from 'lucide-react'
import type { BackupPlan, N8nInstance, SSHConnection, UpdateStatus, VpnServer, VpsService } from '@shared/types'
import { useI18n } from '@renderer/i18n/I18nContext'
import { applyAppearance } from '@renderer/lib/appearance'
import type { Command } from './useCommands'

/**
 * Actions of the palette: they do something (restart n8n, back up now, open
 * a service…) instead of opening a page. One that changes something carries
 * `confirm`, asked before it runs.
 */

/** Services of a server: an SSH call, so kept a few minutes between two openings */
const servicesCache = new Map<string, { at: number; list: VpsService[] }>()
const SERVICES_TTL = 5 * 60_000

/** The VPS pages share the server they show */
const pickServer = (id: string) => { try { localStorage.setItem('devforge:vps-server', id) } catch { /* not kept */ } }

export function useActions(open: boolean): Command[] {
  const { t } = useI18n()
  const navigate = useNavigate()
  const [connections, setConnections] = useState<SSHConnection[]>([])
  const [n8n, setN8n] = useState<N8nInstance[]>([])
  const [vpn, setVpn] = useState<VpnServer[]>([])
  const [plans, setPlans] = useState<BackupPlan[]>([])
  const [services, setServices] = useState<Record<string, VpsService[]>>({})
  const [theme, setTheme] = useState<'dark' | 'light'>('dark')
  const [compact, setCompact] = useState(false)

  useEffect(() => {
    if (!open) return
    window.devforge.getSshConnections().then(list => {
      setConnections(list)
      for (const c of list) {
        const cached = servicesCache.get(c.id)
        if (cached && Date.now() - cached.at < SERVICES_TTL) { setServices(s => ({ ...s, [c.id]: cached.list })); continue }
        window.devforge.vpsOps.services(c.id).then(l => {
          servicesCache.set(c.id, { at: Date.now(), list: l })
          setServices(s => ({ ...s, [c.id]: l }))
        }).catch(() => {})
      }
    }).catch(() => {})
    window.devforge.n8n.instances().then(setN8n).catch(() => {})
    window.devforge.vpn.servers().then(setVpn).catch(() => {})
    window.devforge.backups.plans().then(setPlans).catch(() => {})
    window.devforge.getSettings().then(s => {
      setTheme(document.documentElement.getAttribute('data-theme') === 'light' || s.theme === 'light' ? 'light' : 'dark')
      setCompact(s.density === 'compact')
    }).catch(() => {})
  }, [open])

  return useMemo(() => {
    const a = t.palette
    const group = a.groupActions
    const list: Command[] = []
    const name = (id: string) => connections.find(c => c.id === id)?.name ?? id
    const add = (c: Omit<Command, 'group'> & { icon: LucideIcon }) => list.push({ group, ...c })

    for (const i of n8n) {
      const server = name(i.connectionId)
      add({
        id: `act:n8n-open:${i.connectionId}`, title: `${a.openN8n} — ${server}`, icon: ExternalLink, keywords: 'n8n workflow',
        run: async () => { window.devforge.openExternal(i.exposure === 'caddy' && i.domain ? `https://${i.domain}` : await window.devforge.n8n.openTunnel(i.connectionId)) }
      })
      add({
        id: `act:n8n-restart:${i.connectionId}`, title: `${a.restartN8n} — ${server}`, icon: RotateCcw, keywords: 'n8n redémarrer restart',
        confirm: a.restartN8nConfirm.replace('{name}', server),
        run: async () => { const r = await window.devforge.n8n.control(i.connectionId, 'restart'); if (!r.ok) throw new Error(r.output.slice(-200)) }
      })
    }

    for (const v of vpn) {
      const server = name(v.connectionId)
      add({
        id: `act:vpn-new:${v.connectionId}`, title: `${a.newVpnClient} — ${server}`, icon: ShieldPlus, keywords: 'vpn wireguard client qr',
        run: () => { pickServer(v.connectionId); sessionStorage.setItem('devforge:vpn-new', v.connectionId); navigate('/vpn') }
      })
      add({
        id: `act:vpn-web:${v.connectionId}`, title: `${a.openWgEasy} — ${server}`, icon: ExternalLink, keywords: 'vpn wireguard wg-easy',
        run: async () => { window.devforge.openExternal(await window.devforge.vpn.openWeb(v.connectionId)) }
      })
    }

    for (const p of plans) {
      const server = name(p.connectionId)
      add({
        id: `act:backup-now:${p.connectionId}`, title: `${a.backupNow} — ${server}`, icon: HardDriveDownload, keywords: 'sauvegarde backup dump',
        confirm: a.backupNowConfirm.replace('{name}', server),
        run: async () => { const r = await window.devforge.backups.runNow(p.connectionId); if (!r.ok) throw new Error(t.backups.failed) }
      })
      if (p.localDir) add({
        id: `act:backup-copy:${p.connectionId}`, title: `${a.backupCopy} — ${server}`, icon: HardDriveDownload, keywords: 'sauvegarde backup copie pc',
        run: async () => { await window.devforge.backups.copyNow(p.connectionId) }
      })
    }

    for (const c of connections) {
      add({
        id: `act:health:${c.id}`, title: `${a.health} — ${c.name}`, icon: HeartPulse, keywords: 'santé sécurité health updates',
        run: () => { pickServer(c.id); navigate('/health') }
      })
      for (const s of services[c.id] ?? []) {
        if (!s.running) continue
        add({
          id: `act:service:${c.id}:${s.port}`, title: `${a.openService.replace('{name}', s.name)} — ${c.name}`, subtitle: s.image, icon: AppWindow, keywords: 'service interface web tunnel',
          run: async () => { window.devforge.openExternal(await window.devforge.vpsOps.openService(c.id, s.port, s.scheme)) }
        })
      }
    }

    add({
      id: 'act:updates', title: a.checkUpdates, icon: RefreshCw, keywords: 'mise à jour update version devforge',
      run: async () => {
        const s: UpdateStatus = await window.devforge.updates.check()
        if (s.state === 'unavailable') throw new Error(s.reason === 'dev' ? t.settings.updateDev : t.settings.updateFeed)
      }
    })
    add({
      id: 'act:theme', title: theme === 'light' ? a.themeDark : a.themeLight, icon: theme === 'light' ? Moon : Sun, keywords: 'thème theme clair sombre light dark',
      run: async () => {
        const s = await window.devforge.getSettings()
        const next = { ...s, theme: theme === 'light' ? 'dark' as const : 'light' as const }
        await window.devforge.saveSettings(next)
        applyAppearance(next)
      }
    })
    add({
      id: 'act:density', title: compact ? a.compactOff : a.compactOn, icon: Minimize2, keywords: 'compact densité density petit écran',
      run: async () => {
        const s = await window.devforge.getSettings()
        const next = { ...s, density: compact ? 'comfortable' as const : 'compact' as const }
        await window.devforge.saveSettings(next)
        applyAppearance(next)
      }
    })
    add({
      id: 'act:git-fetch', title: a.fetchAll, icon: GitPullRequestArrow, keywords: 'git fetch dépôts repos',
      run: async () => {
        const projects = await window.devforge.getProjects()
        await Promise.all(projects.map(p => window.devforge.git.fetch(p.path).catch(() => null)))
      }
    })
    return list
  }, [t, navigate, connections, n8n, vpn, plans, services, theme, compact])
}
