import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell, Bot, Box, Cloud, Database, ExternalLink, GitBranch, GitPullRequest, KeyRound, Plus, Server, Trash2, Workflow } from 'lucide-react'
import type { ConnectionKind, ConnectionTest, ConnectionsOverview, SSHConnection, StatusAlertsState } from '@shared/types'
import { useI18n } from '@renderer/i18n/I18nContext'
import { useToast } from '@renderer/app/ToastContext'
import { cn } from '@renderer/lib/cn'
import Badge from '@renderer/components/ui/Badge'
import Button from '@renderer/components/ui/Button'
import IconButton from '@renderer/components/ui/IconButton'
import Spinner from '@renderer/components/ui/Spinner'
import { Input } from '@renderer/components/ui/Input'
import ConnectionForm from '@renderer/features/ssh/components/ConnectionForm'
import DbConnectionForm from '@renderer/features/database/DbConnectionForm'
import { SettingRow, SettingsCard } from './parts'
import { useLive } from '@renderer/lib/live'
import { CardSkeleton } from '@renderer/components/ui/Skeleton'

const OVERVIEW = 'connections-overview'
import { NO_SERVERS, useSshConnections } from '@renderer/hooks/useLiveData'
import { errorText } from '@renderer/lib/errors'
import { providerInfo } from '@shared/data/assistantProviders'
import { providerLabel } from '@renderer/features/assistant/providerLabel'
import { confirmDialog } from '@renderer/app/ConfirmContext'

/** Remove: a small button in red, as in the mock-up */
const REMOVE = 'text-danger hover:bg-danger-soft hover:text-danger'

/** A database's kind as it is written */
const DB_KIND: Record<string, string> = { sqlite: 'SQLite', postgres: 'PostgreSQL', mysql: 'MySQL' }

/** Plugged in or not, in a few words, with a dot of its colour */
function State({ on, children }: { on: boolean; children: ReactNode }) {
  return <Badge color={on ? 'success' : 'default'} dot>{children}</Badge>
}

/**
 * One service: its tile, its name and what it is for; on the right its state and a few small actions.
 * What is typed (a key, a name) opens under it, only when asked.
 */
function ServiceRow({ icon, tile, name, hint, aside, children }: {
  icon: ReactNode; tile?: string; name: ReactNode; hint?: ReactNode; aside?: ReactNode; children?: ReactNode
}) {
  return (
    <div className="border-t border-line-subtle px-5 py-3.5">
      <div className="flex flex-wrap items-center gap-x-3.5 gap-y-2">
        <span aria-hidden className={cn('flex size-9 shrink-0 items-center justify-center rounded-control border border-line-subtle bg-elevated text-fg-secondary', tile)}>{icon}</span>
        <div className="min-w-[200px] flex-1">
          <h3 className="text-base font-semibold text-fg">{name}</h3>
          {hint && <div className="mt-0.5 text-sm text-fg-secondary">{hint}</div>}
        </div>
        {aside && <div className="flex flex-wrap items-center justify-end gap-1.5">{aside}</div>}
      </div>
      {children && <div className="mt-3 flex flex-col gap-2 sm:pl-[50px]">{children}</div>}
    </div>
  )
}

/** A secret typed once: saved, then never shown again */
function SecretForm({ label, placeholder, onSave, onCancel }: { label: string; placeholder: string; onSave: (value: string) => Promise<void>; onCancel?: () => void }) {
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
      <div className="flex flex-wrap gap-2">
        <Input type="password" aria-label={label} placeholder={placeholder} value={value} onChange={e => setValue(e.target.value)} className="min-w-48 flex-1 font-mono" autoComplete="off" autoFocus={!!onCancel} />
        <Button type="submit" size="sm" variant="secondary" disabled={!value.trim()} loading={busy}>{!busy && <KeyRound size={13} />} {c.save}</Button>
        {onCancel && <Button type="button" size="sm" variant="ghost" onClick={onCancel}>{t.common.cancel}</Button>}
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
    <ServiceRow icon={<Bell size={16} />} name={c.statusOf.replace('{server}', page.server)} hint={<span className="font-mono">{page.where}</span>}
      aside={<>
        {result}
        {known ? <State on={known.ntfy}>{known.ntfy ? c.ntfyOn : c.ntfyOff}{known.webhook ? ` ${c.webhookToo}` : ''}</State>
          : <Button size="sm" variant="ghost" loading={state === 'busy'} onClick={read}>{c.readAlerts}</Button>}
        {testButton}
        {known?.ntfy && <Button size="sm" variant="ghost" className={REMOVE} aria-label={c.removeOf.replace('{name}', `ntfy · ${page.server}`)} onClick={async () => { await onRemove(); await read() }}>{c.remove}</Button>}
      </>}>
      {known && !known.ntfy && (
        <form className="flex flex-wrap gap-2" onSubmit={async e => {
          e.preventDefault()
          setSaving(true); setError('')
          try { await window.devforge.connections.setNtfy(page.connectionId, server, topic); setTopic(''); await read() }
          catch (err) { const code = errorText(err); setError((c.errors as Record<string, string>)[code] ?? code) } finally { setSaving(false) }
        }}>
          <Input aria-label={c.ntfyServer} value={server} onChange={e => setServer(e.target.value)} className="w-48 font-mono" />
          <Input type="password" aria-label={c.ntfyTopic} placeholder={c.ntfyTopic} value={topic} onChange={e => setTopic(e.target.value)} className="min-w-48 flex-1 font-mono" autoComplete="off" />
          <Button type="submit" size="sm" variant="secondary" disabled={!topic.trim()} loading={saving}>{!saving && <KeyRound size={13} />} {c.save}</Button>
        </form>
      )}
      {error && <p role="alert" className="text-xs text-danger">{error}</p>}
    </ServiceRow>
  )
}

/** Every service DevForge can reach: whether it is plugged in, test it, change it, remove it */
export default function ConnectionsSettings() {
  const { t } = useI18n()
  const c = t.settings.connections
  const toast = useToast()
  const navigate = useNavigate()
  // Shown at once with what was seen last, read again at each visit: keys and tokens saved elsewhere (Forgy, a page) tell no topic
  const overview = useLive<ConnectionsOverview>(OVERVIEW, () => window.devforge.connections.overview(), { topic: ['ssh', 'db-connections', 'settings'], freshMs: 0 })
  const data = overview.data ?? null
  const ssh: SSHConnection[] = useSshConnections().data ?? NO_SERVERS
  const [tests, setTests] = useState<Record<string, ConnectionTest | 'busy'>>({})
  const [identity, setIdentity] = useState({ name: '', email: '' })
  // The one form open under a row (a key, a token, the Git identity), the server being added or changed
  const [open, setOpen] = useState<string | null>(null)
  const [serverForm, setServerForm] = useState<SSHConnection | 'new' | null>(null)
  const [dbForm, setDbForm] = useState(false)

  const { reload } = overview
  const load = useCallback(() => { void reload() }, [reload])
  // The Git identity's fields start from what is saved
  useEffect(() => {
    if (data) setIdentity(i => (i.name || i.email ? i : { name: data.git.name ?? '', email: data.git.email ?? '' }))
  }, [data])
  useEffect(() => { if (overview.error) toast.show({ tone: 'error', title: errorText(overview.error) }) }, [overview.error, toast])

  async function test(kind: ConnectionKind, id?: string) {
    const key = id ? `${kind}:${id}` : kind
    setTests(m => ({ ...m, [key]: 'busy' }))
    const r = await window.devforge.connections.test(kind, id).catch(err => ({ ok: false, detail: errorText(err) }))
    setTests(m => ({ ...m, [key]: r }))
  }
  async function disconnect(kind: Exclude<ConnectionKind, 'docker'>, name: string, id?: string) {
    if (!(await confirmDialog(c.removeConfirm.replace('{name}', name), { danger: true }))) return
    try { await window.devforge.connections.disconnect(kind, id) } catch (err) { toast.show({ tone: 'error', title: errorText(err) }); return }
    setTests(m => { const n = { ...m }; delete n[id ? `${kind}:${id}` : kind]; return n })
    toast.show({ tone: 'success', title: c.removed.replace('{name}', name) })
    load()
  }
  const saved = (fn: (v: string) => Promise<unknown>) => async (v: string) => { await fn(v); setOpen(null); load() }

  /** The last test, as a tag (its words read out when it lands) */
  const result = (key: string) => {
    const r = tests[key]
    if (!r) return null
    if (r === 'busy') return <Spinner />
    const detail = (c.errors as Record<string, string>)[r.detail] ?? r.detail
    return <span role="status"><Badge color={r.ok ? 'success' : 'danger'} dot>{r.ok ? c.testOk.replace('{detail}', detail) : c.testFailed.replace('{detail}', detail)}</Badge></span>
  }
  const testButton = (kind: ConnectionKind, name: string, id?: string) => (
    <Button size="sm" variant="ghost" disabled={tests[id ? `${kind}:${id}` : kind] === 'busy'} onClick={() => test(kind, id)} aria-label={c.testOf.replace('{name}', name)}>
      {c.test}
    </Button>
  )
  const addButton = (key: string, label: string, name: string) => (
    <Button size="sm" variant="ghost" aria-expanded={open === key} aria-label={`${label} · ${name}`} onClick={() => setOpen(o => (o === key ? null : key))}><Plus size={13} /> {label}</Button>
  )

  if (!data) return (
    <div role="status" aria-label={t.common.loading} className="flex flex-col gap-5">
      <CardSkeleton label={false} rows={5} />
      <CardSkeleton label={false} rows={2} />
    </div>
  )

  const plugged = [!!(data.git.name && data.git.email), !!data.github.cli || data.github.token, data.vercel.connected, !!data.docker.version, data.forgy.hasKey].filter(Boolean).length
  const forgyName = providerLabel(data.forgy.provider, t)

  return (
    <>
      <SettingsCard title={c.accountsTitle} action={<span className="text-sm text-fg-muted">{c.plugged.replace('{n}', String(plugged))}</span>}>
        <ServiceRow icon={<GitBranch size={16} />} name={c.gitIdentity} hint={c.gitIdentityHint}
          aside={<>
            {data.git.name || data.git.email
              ? <span className="max-w-[320px] truncate font-mono text-sm text-fg-secondary">{[data.git.name, data.git.email].filter(Boolean).join(' · ')}</span>
              : <State on={false}>{c.gitUnset}</State>}
            <Button size="sm" variant="ghost" aria-expanded={open === 'git'} onClick={() => setOpen(o => (o === 'git' ? null : 'git'))}>{c.edit}</Button>
          </>}>
          {open === 'git' && (
            <form className="flex flex-wrap gap-2" onSubmit={async e => {
              e.preventDefault()
              try { await window.devforge.connections.setGitIdentity(identity.name, identity.email); toast.show({ tone: 'success', title: c.gitSaved }); setOpen(null); load() } catch (err) {
                const code = errorText(err)
                toast.show({ tone: 'error', title: (c.errors as Record<string, string>)[code] ?? code })
              }
            }}>
              <Input aria-label={c.gitName} placeholder={c.gitName} value={identity.name} onChange={e => setIdentity(i => ({ ...i, name: e.target.value }))} className="flex-[1_1_140px]" autoFocus />
              <Input aria-label={c.gitEmail} placeholder={c.gitEmail} type="email" value={identity.email} onChange={e => setIdentity(i => ({ ...i, email: e.target.value }))} className="flex-[1_1_180px]" />
              <Button type="submit" size="sm" variant="secondary" disabled={!identity.name.trim() || !identity.email.trim()}>{c.save}</Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(null)}>{t.common.cancel}</Button>
            </form>
          )}
        </ServiceRow>

        <ServiceRow icon={<GitPullRequest size={16} />} name="GitHub" hint={c.githubHint}
          aside={<>
            {result('github')}
            <State on={!!data.github.cli}>{data.github.cli ? c.githubCli.replace('{login}', data.github.cli) : c.githubNoCli}</State>
            {data.github.token && <State on>{c.tokenSaved}</State>}
            {(data.github.cli || data.github.token) && testButton('github', 'GitHub')}
            {data.github.token && <Button size="sm" variant="ghost" className={REMOVE} aria-label={c.removeOf.replace('{name}', c.githubToken)} onClick={() => disconnect('github', c.githubToken)}>{c.remove}</Button>}
            {!data.github.cli && !data.github.token && addButton('github', c.addToken, 'GitHub')}
          </>}>
          {open === 'github' && <SecretForm label={c.githubToken} placeholder="ghp_… / github_pat_…" onCancel={() => setOpen(null)} onSave={saved(v => window.devforge.github.saveToken(v))} />}
        </ServiceRow>

        <ServiceRow icon={<Cloud size={16} />} name="Vercel" hint={c.vercelHint}
          aside={<>
            {result('vercel')}
            <span title={data.vercel.username ? c.vercelAs.replace('{name}', data.vercel.username) : undefined}><State on={data.vercel.connected}>{data.vercel.connected ? c.tokenSaved : c.noToken}</State></span>
            {data.vercel.connected && testButton('vercel', 'Vercel')}
            {data.vercel.connected ? <Button size="sm" variant="ghost" className={REMOVE} aria-label={c.removeOf.replace('{name}', c.vercelToken)} onClick={() => disconnect('vercel', c.vercelToken)}>{c.remove}</Button> : addButton('vercel', c.addToken, 'Vercel')}
          </>}>
          {open === 'vercel' && <SecretForm label={c.vercelToken} placeholder={c.vercelToken} onCancel={() => setOpen(null)} onSave={saved(v => window.devforge.vercel.saveToken(v))} />}
        </ServiceRow>

        <ServiceRow icon={<Box size={16} />} name="Docker" hint={c.dockerHint}
          aside={<>
            {result('docker')}
            <span title={data.docker.version ? `Docker ${data.docker.version}` : undefined}><State on={!!data.docker.version}>{data.docker.version ? c.dockerUp : c.dockerDown}</State></span>
            {!data.docker.version && testButton('docker', 'Docker')}
            {!data.docker.version && <Button size="sm" variant="ghost" onClick={() => window.devforge.openExternal('https://www.docker.com/products/docker-desktop/')}><ExternalLink size={13} /> {c.dockerGet}</Button>}
          </>} />

        <ServiceRow icon={<Bot size={16} />} tile="border-accent/30 bg-accent-soft text-accent" name={c.forgy} hint={c.forgyHint}
          aside={<>
            <span title={forgyName}><State on={data.forgy.hasKey}>{data.forgy.source === 'env' ? c.keyFromEnv.replace('{env}', providerInfo(data.forgy.provider).env.join(' / ')) : data.forgy.hasKey ? c.keySaved : c.noKey}</State></span>
            <Button size="sm" variant="ghost" onClick={() => navigate('/settings?section=forgy')}>{c.forgySettings}</Button>
          </>} />
      </SettingsCard>

      <SettingsCard title={c.serversTitle} hint={c.serversHint}
        action={<Button size="sm" variant="secondary" onClick={() => setServerForm('new')}><Plus size={14} /> {c.addServer}</Button>}>
        {data.servers.length === 0 && <SettingRow label={c.noServer} hint={c.noServerHint} />}
        {data.servers.map(s => {
          const full = ssh.find(x => x.id === s.id)
          return (
            <ServiceRow key={s.id} icon={<Server size={16} />} name={s.name}
              hint={<span className="font-mono">{s.username}@{s.host}{full ? `:${full.port} · ${full.authMethod === 'privateKey' ? c.authKey : c.authPassword}` : ''}</span>}
              aside={<>
                {result(`server:${s.id}`) ?? <State on={false}>{c.untested}</State>}
                {testButton('server', s.name, s.id)}
                {full && <Button size="sm" variant="ghost" onClick={() => setServerForm(full)}>{c.edit}</Button>}
                <IconButton size="sm" title={c.removeOf.replace('{name}', s.name)} tone="danger" onClick={() => disconnect('server', s.name, s.id)}><Trash2 size={13} /></IconButton>
              </>} />
          )
        })}
      </SettingsCard>

      <SettingsCard title={c.databasesTitle} hint={c.databasesHint}
        action={<Button size="sm" variant="secondary" onClick={() => setDbForm(true)}><Plus size={14} /> {c.addDatabase}</Button>}>
        {data.databases.length === 0 && <SettingRow label={c.noDatabase} />}
        {data.databases.map(d => (
          <ServiceRow key={d.id} icon={<Database size={16} />} tile="border-info/30 bg-info-soft text-info" name={d.name} hint={<span className="font-mono">{DB_KIND[d.type] ?? d.type} · {d.target}</span>}
            aside={<>
              <Button size="sm" variant="ghost" onClick={() => navigate(`/database?conn=${encodeURIComponent(d.id)}`)}>{c.open}</Button>
              <IconButton size="sm" title={c.removeOf.replace('{name}', d.name)} tone="danger" onClick={() => disconnect('database', d.name, d.id)}><Trash2 size={13} /></IconButton>
            </>} />
        ))}
      </SettingsCard>

      <SettingsCard title={c.automationTitle} hint={c.automationHint}>
        {data.n8n.length === 0 && (
          <SettingRow label={c.noN8n} hint={c.noN8nHint}>
            <Button size="sm" variant="ghost" onClick={() => navigate('/n8n')}>{c.open}</Button>
          </SettingRow>
        )}
        {data.n8n.map(n => (
          <ServiceRow key={n.connectionId} icon={<Workflow size={16} />} tile="border-accent/30 bg-accent-soft text-accent" name={c.n8nOf.replace('{server}', n.server)}
            hint={<>{n.hasKey ? c.n8nKeySaved : c.n8nNoKey} · <span className="font-mono">{n.where}</span></>}
            aside={<>
              {result(`n8n:${n.connectionId}`)}
              {n.hasKey && testButton('n8n', c.n8nOf.replace('{server}', n.server), n.connectionId)}
              {n.hasKey ? <Button size="sm" variant="ghost" className={REMOVE} aria-label={c.removeOf.replace('{name}', c.n8nOf.replace('{server}', n.server))} onClick={() => disconnect('n8n', c.n8nKey, n.connectionId)}>{c.remove}</Button> : addButton(`n8n:${n.connectionId}`, c.addKey, c.n8nOf.replace('{server}', n.server))}
              <Button size="sm" variant="ghost" onClick={() => navigate('/n8n')}>{c.open}</Button>
            </>}>
            {open === `n8n:${n.connectionId}` && <SecretForm label={c.n8nKey} placeholder="n8n_api_…" onCancel={() => setOpen(null)} onSave={saved(v => window.devforge.n8n.saveKey(n.connectionId, v))} />}
          </ServiceRow>
        ))}
        {data.statusPages.length === 0 && <SettingRow label={c.noStatus} hint={c.noStatusHint} />}
        {data.statusPages.map(p => (
          <AlertsRow key={p.connectionId} page={p}
            testButton={testButton('alerts', c.statusOf.replace('{server}', p.server), p.connectionId)}
            result={result(`alerts:${p.connectionId}`)}
            onRemove={() => disconnect('alerts', `ntfy · ${p.server}`, p.connectionId)} />
        ))}
      </SettingsCard>

      <p className="text-xs text-fg-muted">{c.storedNote}</p>

      {serverForm && (
        <ConnectionForm initial={serverForm === 'new' ? undefined : serverForm} onCancel={() => setServerForm(null)} onSave={async conn => {
          await window.devforge.saveSshConnection(conn)
          setServerForm(null)
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
