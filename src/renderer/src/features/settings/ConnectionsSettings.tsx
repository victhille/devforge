import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell, Check, Database, ExternalLink, KeyRound, Plug, Plus, Server, Trash2, X } from 'lucide-react'
import type { ConnectionKind, ConnectionTest, ConnectionsOverview, StatusAlertsState } from '@shared/types'
import { useI18n } from '@renderer/i18n/I18nContext'
import { useToast } from '@renderer/app/ToastContext'
import { cn } from '@renderer/lib/cn'
import Button from '@renderer/components/ui/Button'
import IconButton from '@renderer/components/ui/IconButton'
import Spinner from '@renderer/components/ui/Spinner'
import { Input } from '@renderer/components/ui/Input'
import ConnectionForm from '@renderer/features/ssh/components/ConnectionForm'
import DbConnectionForm from '@renderer/features/database/DbConnectionForm'
import { SettingRow, SettingsCard } from './parts'

const errorText = (err: unknown) => String(err instanceof Error ? err.message : err).replace(/^Error invoking remote method '[^']+': (Error: )?/, '')

/** Configured or not, in a few words */
function State({ on, children }: { on: boolean; children: ReactNode }) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium', on ? 'bg-success-soft text-success' : 'bg-elevated text-fg-muted')}>
      {on ? <Check size={12} /> : <X size={12} />} {children}
    </span>
  )
}

/** A secret typed once: saved, then never shown again */
function SecretForm({ label, placeholder, onSave }: { label: string; placeholder: string; onSave: (value: string) => Promise<void> }) {
  const { t } = useI18n()
  const c = t.settings.connections
  const [value, setValue] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  return (
    <form className="flex w-full flex-col gap-1.5" onSubmit={async e => {
      e.preventDefault()
      setBusy(true); setError('')
      try { await onSave(value.trim()); setValue('') } catch (err) { setError(errorText(err)) } finally { setBusy(false) }
    }}>
      <div className="flex gap-2">
        <Input type="password" aria-label={label} placeholder={placeholder} value={value} onChange={e => setValue(e.target.value)} className="font-mono" autoComplete="off" />
        <Button type="submit" variant="secondary" disabled={!value.trim()} loading={busy}>{!busy && <KeyRound size={14} />} {c.save}</Button>
      </div>
      {error && <p role="alert" className="text-xs text-danger">{error}</p>}
    </form>
  )
}

/** A status page's ntfy alerts: read on the server when asked (SSH), set, removed */
function AlertsRow({ page, testButton, result, onRemove }: {
  page: ConnectionsOverview['statusPages'][number]
  testButton: ReactNode
  result: ReactNode
  onRemove: () => Promise<void>
}) {
  const { t } = useI18n()
  const c = t.settings.connections
  const [state, setState] = useState<StatusAlertsState | 'busy' | null>(null)
  const [error, setError] = useState('')
  const [server, setServer] = useState('https://ntfy.sh')
  const [topic, setTopic] = useState('')
  const [saving, setSaving] = useState(false)
  const read = async () => {
    setState('busy'); setError('')
    try { setState(await window.devforge.connections.alerts(page.connectionId)) } catch (err) { setState(null); setError(errorText(err)) }
  }
  const known = state && state !== 'busy' ? state : null
  return (
    <SettingRow label={c.statusOf.replace('{server}', page.server)} hint={<span className="font-mono">{page.where}</span>}>
      <div className="flex flex-[1_1_320px] flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          {known ? <State on={known.ntfy}>{known.ntfy ? c.ntfyOn : c.ntfyOff}{known.webhook ? ` ${c.webhookToo}` : ''}</State>
            : <Button size="sm" variant="ghost" loading={state === 'busy'} onClick={read}><Bell size={13} /> {c.readAlerts}</Button>}
          {testButton}
          {known?.ntfy && <Button size="sm" variant="ghost" onClick={async () => { await onRemove(); await read() }}><Trash2 size={13} /> {c.remove}</Button>}
          {result}
        </div>
        {known && !known.ntfy && (
          <form className="flex w-full flex-col gap-1.5" onSubmit={async e => {
            e.preventDefault()
            setSaving(true); setError('')
            try { await window.devforge.connections.setNtfy(page.connectionId, server, topic); setTopic(''); await read() }
            catch (err) { const code = errorText(err); setError((c.errors as Record<string, string>)[code] ?? code) } finally { setSaving(false) }
          }}>
            <div className="flex flex-wrap gap-2">
              <Input aria-label={c.ntfyServer} value={server} onChange={e => setServer(e.target.value)} className="w-48 font-mono" />
              <Input type="password" aria-label={c.ntfyTopic} placeholder={c.ntfyTopic} value={topic} onChange={e => setTopic(e.target.value)} className="min-w-48 flex-1 font-mono" autoComplete="off" />
              <Button type="submit" variant="secondary" disabled={!topic.trim()} loading={saving}>{!saving && <KeyRound size={14} />} {c.save}</Button>
            </div>
          </form>
        )}
        {error && <p role="alert" className="text-xs text-danger">{error}</p>}
      </div>
    </SettingRow>
  )
}

/** Every service DevForge can reach: whether it is set, set it, test it, remove it */
export default function ConnectionsSettings() {
  const { t } = useI18n()
  const c = t.settings.connections
  const toast = useToast()
  const navigate = useNavigate()
  const [data, setData] = useState<ConnectionsOverview | null>(null)
  const [tests, setTests] = useState<Record<string, ConnectionTest | 'busy'>>({})
  const [identity, setIdentity] = useState({ name: '', email: '' })
  const [serverForm, setServerForm] = useState(false)
  const [dbForm, setDbForm] = useState(false)

  const load = useCallback(() => {
    window.devforge.connections.overview().then(d => {
      setData(d)
      setIdentity(i => (i.name || i.email ? i : { name: d.git.name ?? '', email: d.git.email ?? '' }))
    }).catch(err => toast.show({ tone: 'error', title: errorText(err) }))
  }, [toast])
  useEffect(load, [load])

  async function test(kind: ConnectionKind, id?: string) {
    const key = id ? `${kind}:${id}` : kind
    setTests(m => ({ ...m, [key]: 'busy' }))
    const r = await window.devforge.connections.test(kind, id).catch(err => ({ ok: false, detail: errorText(err) }))
    setTests(m => ({ ...m, [key]: r }))
  }
  async function disconnect(kind: Exclude<ConnectionKind, 'docker'>, name: string, id?: string) {
    if (!window.confirm(c.removeConfirm.replace('{name}', name))) return
    try { await window.devforge.connections.disconnect(kind, id) } catch (err) { toast.show({ tone: 'error', title: errorText(err) }); return }
    setTests(m => { const n = { ...m }; delete n[id ? `${kind}:${id}` : kind]; return n })
    toast.show({ tone: 'success', title: c.removed.replace('{name}', name) })
    load()
  }

  const result = (key: string) => {
    const r = tests[key]
    if (!r) return null
    if (r === 'busy') return <Spinner />
    const detail = (c.errors as Record<string, string>)[r.detail] ?? r.detail
    return <span role="status" className={cn('text-xs', r.ok ? 'text-success' : 'text-danger')}>{r.ok ? c.testOk.replace('{detail}', detail) : c.testFailed.replace('{detail}', detail)}</span>
  }
  const testButton = (kind: ConnectionKind, name: string, id?: string, disabled = false) => (
    <Button size="sm" variant="ghost" disabled={disabled || tests[id ? `${kind}:${id}` : kind] === 'busy'} onClick={() => test(kind, id)} aria-label={c.testOf.replace('{name}', name)}>
      <Plug size={13} /> {c.test}
    </Button>
  )

  if (!data) return <div className="flex justify-center p-10"><Spinner /></div>

  return (
    <>
      <SettingsCard title={c.accountsTitle} hint={c.accountsHint}>
        <SettingRow label="GitHub" hint={c.githubHint}>
          <div className="flex flex-[1_1_320px] flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <State on={!!data.github.cli}>{data.github.cli ? c.githubCli.replace('{login}', data.github.cli) : c.githubNoCli}</State>
              <State on={data.github.token}>{data.github.token ? c.tokenSaved : c.noToken}</State>
              {testButton('github', 'GitHub', undefined, !data.github.cli && !data.github.token)}
              {data.github.token && <Button size="sm" variant="ghost" onClick={() => disconnect('github', c.githubToken)}><Trash2 size={13} /> {c.remove}</Button>}
              {result('github')}
            </div>
            {!data.github.token && <SecretForm label={c.githubToken} placeholder="ghp_… / github_pat_…" onSave={async v => { await window.devforge.github.saveToken(v); load() }} />}
          </div>
        </SettingRow>

        <SettingRow label={c.gitIdentity} hint={c.gitIdentityHint}>
          <form className="flex flex-[1_1_320px] flex-wrap gap-2" onSubmit={async e => {
            e.preventDefault()
            try { await window.devforge.connections.setGitIdentity(identity.name, identity.email); toast.show({ tone: 'success', title: c.gitSaved }); load() } catch (err) {
              const code = errorText(err)
              toast.show({ tone: 'error', title: (c.errors as Record<string, string>)[code] ?? code })
            }
          }}>
            <Input aria-label={c.gitName} placeholder={c.gitName} value={identity.name} onChange={e => setIdentity(i => ({ ...i, name: e.target.value }))} className="flex-[1_1_140px]" />
            <Input aria-label={c.gitEmail} placeholder={c.gitEmail} type="email" value={identity.email} onChange={e => setIdentity(i => ({ ...i, email: e.target.value }))} className="flex-[1_1_180px]" />
            <Button type="submit" variant="secondary" disabled={!identity.name.trim() || !identity.email.trim()}>{c.save}</Button>
          </form>
        </SettingRow>

        <SettingRow label={c.forgy} hint={c.forgyHint}>
          <div className="flex flex-[1_1_320px] flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <State on={data.forgy.hasKey}>{data.forgy.source === 'env' ? c.keyFromEnv : data.forgy.hasKey ? c.keySaved : c.noKey}</State>
              {data.forgy.hasKey && testButton('forgy', c.forgy)}
              {data.forgy.source === 'saved' && <Button size="sm" variant="ghost" onClick={() => disconnect('forgy', c.forgyKey)}><Trash2 size={13} /> {c.remove}</Button>}
              {result('forgy')}
            </div>
            {data.forgy.source !== 'saved' && <SecretForm label={c.forgyKey} placeholder="sk-ant-…" onSave={async v => { await window.devforge.assistant.saveConfig({ apiKey: v }); load() }} />}
          </div>
        </SettingRow>

        <SettingRow label="Vercel" hint={c.vercelHint}>
          <div className="flex flex-[1_1_320px] flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <State on={data.vercel.connected}>{data.vercel.connected ? c.vercelAs.replace('{name}', data.vercel.username ?? '') : c.noToken}</State>
              {data.vercel.connected && testButton('vercel', 'Vercel')}
              {data.vercel.connected && <Button size="sm" variant="ghost" onClick={() => disconnect('vercel', c.vercelToken)}><Trash2 size={13} /> {c.remove}</Button>}
              {result('vercel')}
            </div>
            {!data.vercel.connected && <SecretForm label={c.vercelToken} placeholder={c.vercelToken} onSave={async v => { await window.devforge.vercel.saveToken(v); load() }} />}
          </div>
        </SettingRow>

        <SettingRow label="Docker" hint={c.dockerHint}>
          <div className="flex flex-wrap items-center gap-2">
            <State on={!!data.docker.version}>{data.docker.version ? `Docker ${data.docker.version}` : c.dockerDown}</State>
            {testButton('docker', 'Docker')}
            {!data.docker.version && <Button size="sm" variant="ghost" onClick={() => window.devforge.openExternal('https://www.docker.com/products/docker-desktop/')}><ExternalLink size={13} /> {c.dockerGet}</Button>}
            {result('docker')}
          </div>
        </SettingRow>
      </SettingsCard>

      <SettingsCard title={c.serversTitle} hint={c.serversHint} icon={<Server size={18} className="text-fg-muted" />}>
        {data.servers.length === 0 && <SettingRow label={c.noServer} hint={c.noServerHint} />}
        {data.servers.map(s => (
          <SettingRow key={s.id} label={s.name} hint={<span className="font-mono">{s.username}@{s.host}</span>}>
            <div className="flex flex-wrap items-center gap-2">
              {testButton('server', s.name, s.id)}
              <Button size="sm" variant="ghost" onClick={() => navigate(`/vps/${s.id}`)}>{c.open}</Button>
              <IconButton size="sm" title={c.removeOf.replace('{name}', s.name)} tone="danger" onClick={() => disconnect('server', s.name, s.id)}><Trash2 size={13} /></IconButton>
              {result(`server:${s.id}`)}
            </div>
          </SettingRow>
        ))}
        <div className="border-t border-line-subtle px-5 py-3">
          <Button size="sm" variant="secondary" onClick={() => setServerForm(true)}><Plus size={14} /> {c.addServer}</Button>
        </div>
      </SettingsCard>

      <SettingsCard title={c.automationTitle} hint={c.automationHint} icon={<Bell size={18} className="text-fg-muted" />}>
        {data.n8n.length === 0 && (
          <SettingRow label={c.noN8n} hint={c.noN8nHint}>
            <Button size="sm" variant="ghost" onClick={() => navigate('/n8n')}>{c.open}</Button>
          </SettingRow>
        )}
        {data.n8n.map(n => (
          <SettingRow key={n.connectionId} label={c.n8nOf.replace('{server}', n.server)} hint={<span className="font-mono">{n.where}</span>}>
            <div className="flex flex-[1_1_320px] flex-col gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <State on={n.hasKey}>{n.hasKey ? c.keySaved : c.noKey}</State>
                {n.hasKey && testButton('n8n', c.n8nOf.replace('{server}', n.server), n.connectionId)}
                {n.hasKey && <Button size="sm" variant="ghost" onClick={() => disconnect('n8n', c.n8nKey, n.connectionId)}><Trash2 size={13} /> {c.remove}</Button>}
                <Button size="sm" variant="ghost" onClick={() => navigate('/n8n')}>{c.open}</Button>
                {result(`n8n:${n.connectionId}`)}
              </div>
              {!n.hasKey && <SecretForm label={c.n8nKey} placeholder="n8n_api_…" onSave={async v => { await window.devforge.n8n.saveKey(n.connectionId, v); load() }} />}
            </div>
          </SettingRow>
        ))}
        {data.statusPages.length === 0 && <SettingRow label={c.noStatus} hint={c.noStatusHint} />}
        {data.statusPages.map(p => (
          <AlertsRow key={p.connectionId} page={p}
            testButton={testButton('alerts', c.statusOf.replace('{server}', p.server), p.connectionId)}
            result={result(`alerts:${p.connectionId}`)}
            onRemove={() => disconnect('alerts', `ntfy · ${p.server}`, p.connectionId)} />
        ))}
      </SettingsCard>

      <SettingsCard title={c.databasesTitle} hint={c.databasesHint} icon={<Database size={18} className="text-fg-muted" />}>
        {data.databases.length === 0 && <SettingRow label={c.noDatabase} />}
        {data.databases.map(d => (
          <SettingRow key={d.id} label={d.name} hint={<span className="font-mono">{d.type} · {d.target}</span>}>
            <div className="flex flex-wrap items-center gap-2">
              {testButton('database', d.name, d.id)}
              <IconButton size="sm" title={c.removeOf.replace('{name}', d.name)} tone="danger" onClick={() => disconnect('database', d.name, d.id)}><Trash2 size={13} /></IconButton>
              {result(`database:${d.id}`)}
            </div>
          </SettingRow>
        ))}
        <div className="border-t border-line-subtle px-5 py-3">
          <Button size="sm" variant="secondary" onClick={() => setDbForm(true)}><Plus size={14} /> {c.addDatabase}</Button>
        </div>
      </SettingsCard>

      <p className="text-xs text-fg-muted">{c.storedNote}</p>

      {serverForm && (
        <ConnectionForm onCancel={() => setServerForm(false)} onSave={async conn => {
          await window.devforge.saveSshConnection(conn)
          setServerForm(false)
          load()
        }} />
      )}
      {dbForm && (
        <DbConnectionForm onClose={() => setDbForm(false)} onSave={async conn => {
          await window.devforge.db.save(conn)
          setDbForm(false)
          load()
        }} />
      )}
    </>
  )
}
