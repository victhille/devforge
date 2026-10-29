import { useCallback, useEffect, useState } from 'react'
import { AlertTriangle, ArrowRight, CheckCircle2, ExternalLink, Globe, Plus, ShieldCheck, Trash2 } from 'lucide-react'
import type { DomainSuggestion, DomainsStatus, LocalDomain } from '@shared/types'
import { useI18n } from '@renderer/i18n/I18nContext'
import { useToast } from '@renderer/app/ToastContext'
import { cn } from '@renderer/lib/cn'
import Button from '@renderer/components/ui/Button'
import Card from '@renderer/components/ui/Card'
import EmptyState from '@renderer/components/ui/EmptyState'
import IconButton from '@renderer/components/ui/IconButton'
import Switch from '@renderer/components/ui/Switch'
import { Input } from '@renderer/components/ui/Input'
import { Page, PageHeader } from '@renderer/components/ui/Page'
import Suggestions from '@renderer/components/ui/Suggestions'
import { errorText } from '@renderer/lib/errors'

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

export default function DomainsPage() {
  const { t } = useI18n()
  const d = t.domains
  const toast = useToast()
  const [domains, setDomains] = useState<LocalDomain[]>([])
  const [status, setStatus] = useState<DomainsStatus | null>(null)
  const [suggested, setSuggested] = useState<DomainSuggestion[]>([])
  const [draft, setDraft] = useState({ name: '', port: '3000' })
  const [applying, setApplying] = useState(false)

  const reload = useCallback(async () => {
    const [list, st] = await Promise.all([window.devforge.domains.list(), window.devforge.domains.status()])
    setDomains(list)
    setStatus(st)
  }, [])

  useEffect(() => {
    reload()
    window.devforge.suggest.domains().then(setSuggested).catch(() => {})
  }, [reload])

  async function save(domain: LocalDomain) {
    try {
      await window.devforge.domains.save(domain)
      await reload()
      return true
    } catch (err) {
      toast.show({ tone: 'error', title: d.saveFailed, description: errorText(err) })
      return false
    }
  }

  async function add() {
    const name = draft.name.trim().toLowerCase()
    const domain = /\.(test|localhost)$/.test(name) ? name : `${slug(name)}.test`
    if (await save({ id: crypto.randomUUID(), domain, port: Number(draft.port), enabled: true })) setDraft({ name: '', port: '3000' })
  }

  async function applyHosts() {
    setApplying(true)
    const r = await window.devforge.domains.applyHosts()
    setApplying(false)
    toast.show(r.ok ? { tone: 'success', title: d.hostsUpdated } : { tone: 'error', title: d.hostsFailed, description: r.error })
    reload()
  }

  const suffix = status?.proxyPort && status.proxyPort !== 80 ? `:${status.proxyPort}` : ''

  return (
    <Page>
      <PageHeader icon={<Globe size={18} />} title={d.title} subtitle={d.subtitle} />

      {/* Status */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="flex items-center gap-3 px-4 py-3">
          {status?.proxyPort
            ? <CheckCircle2 size={18} className="text-success" />
            : <AlertTriangle size={18} className={domains.some(x => x.enabled) ? 'text-danger' : 'text-fg-muted'} />}
          <div className="flex flex-col">
            <span className="font-medium text-fg">{status?.proxyPort ? d.proxyOn.replace('{port}', String(status.proxyPort)) : d.proxyOff}</span>
            <span className="text-xs text-fg-muted">{status?.proxyError ?? (status?.proxyPort && status.proxyPort !== 80 ? d.portFallback : d.proxyHint)}</span>
          </div>
        </Card>
        <Card className="flex items-center gap-3 px-4 py-3">
          {status?.hostsInSync ? <CheckCircle2 size={18} className="text-success" /> : <AlertTriangle size={18} className="text-warning" />}
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="font-medium text-fg">{status?.hostsInSync ? d.hostsOk : d.hostsOutdated}</span>
            <span className="truncate font-mono text-2xs text-fg-muted">{status?.hostsPath}</span>
          </div>
          {!status?.hostsInSync && (
            <Button size="sm" onClick={applyHosts} loading={applying}>{!applying && <ShieldCheck size={13} />} {d.applyHosts}</Button>
          )}
        </Card>
      </div>

      {/* Add */}
      <Card className="flex items-end gap-2 p-4">
        <label className="flex flex-1 flex-col gap-1.5">
          <span className="text-xs font-medium text-fg-secondary">{d.domain}</span>
          <div className="flex items-center">
            <Input value={draft.name} onChange={e => setDraft(x => ({ ...x, name: e.target.value }))} placeholder="shop" className="rounded-r-none font-mono"
              onKeyDown={e => e.key === 'Enter' && draft.name && add()} />
            {!/\.(test|localhost)$/.test(draft.name) && (
              <span className="flex h-9 items-center rounded-r-lg border border-l-0 border-line bg-active px-3 font-mono text-sm text-fg-secondary">.test</span>
            )}
          </div>
        </label>
        <ArrowRight size={16} className="mb-2.5 text-fg-muted" />
        <label className="flex w-40 flex-col gap-1.5">
          <span className="text-xs font-medium text-fg-secondary">localhost:</span>
          <Input type="number" value={draft.port} onChange={e => setDraft(x => ({ ...x, port: e.target.value }))} className="font-mono" />
        </label>
        <Button onClick={add} disabled={!draft.name.trim()}><Plus size={14} /> {d.add}</Button>
      </Card>
      <Suggestions
        title={d.suggestions}
        items={suggested.map(s => ({
          key: s.domain,
          label: <span className="font-mono">{s.domain} → :{s.port}</span>,
          hint: s.running ? `● ${d.running}` : s.source,
          onPick: async () => {
            if (await save({ id: crypto.randomUUID(), domain: s.domain, port: s.port, enabled: true })) {
              setSuggested(list => list.filter(x => x.domain !== s.domain))
            }
          }
        }))}
      />

      {/* List */}
      {domains.length === 0 ? (
        <EmptyState icon={<Globe size={32} />} title={d.emptyTitle} description={d.emptyHint} />
      ) : (
        <Card className="divide-y divide-line-subtle">
          {domains.map(dom => (
            <div key={dom.id} className={cn('flex items-center gap-4 px-4 py-3', !dom.enabled && 'opacity-50')}>
              <Switch checked={dom.enabled} onChange={v => save({ ...dom, enabled: v })} label={dom.domain} />
              <button
                disabled={!status?.proxyPort || !dom.enabled}
                onClick={() => window.devforge.openExternal(`http://${dom.domain}${suffix}`)}
                className="flex items-center gap-1.5 font-mono text-md text-fg hover:text-accent disabled:hover:text-fg"
              >
                http://{dom.domain}{suffix} <ExternalLink size={12} />
              </button>
              <ArrowRight size={14} className="text-fg-muted" />
              <span className="flex-1 font-mono text-sm text-fg-secondary">localhost:{dom.port}</span>
              <IconButton title={t.common.delete} tone="danger" onClick={async () => { await window.devforge.domains.remove(dom.id); reload() }}>
                <Trash2 size={14} />
              </IconButton>
            </div>
          ))}
        </Card>
      )}
    </Page>
  )
}
