import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { ExternalLink, Search, Send } from 'lucide-react'
import type { DbConnection, SfCommand, SfEntity, SfRoute, SfStatus } from '@shared/types'
import { SF_NAME_RE } from '@shared/lib/symfonyCommands'
import { useI18n } from '@renderer/i18n/I18nContext'
import Button from '@renderer/components/ui/Button'
import IconButton from '@renderer/components/ui/IconButton'
import Spinner from '@renderer/components/ui/Spinner'
import { Input, Select } from '@renderer/components/ui/Input'
import { CommandButton, Section, errorText } from './parts'

type Exec = (command: SfCommand, arg?: string) => void

// ─── Database ─────────────────────────────────────────────────────────────────

export function DatabaseSection({ projectPath, status, exec, onChanged }: { projectPath: string; status: SfStatus; exec: Exec; onChanged: () => void }) {
  const { t } = useI18n()
  const s = t.symfony
  const db = status.database
  const [connections, setConnections] = useState<DbConnection[]>([])
  const [picked, setPicked] = useState('')
  const [error, setError] = useState('')

  useEffect(() => { window.devforge.db.list().then(list => setConnections(list.filter(c => !c.sshConnectionId))).catch(() => {}) }, [])

  async function use() {
    setError('')
    try { await window.devforge.symfony.useConnection(projectPath, picked); onChanged() } catch (err) { setError(errorText(err)) }
  }

  return (
    <Section title={s.dbTitle} help={s.dbHelp}>
      {!status.packages.orm ? (
        <div className="flex flex-wrap items-center gap-3">
          <span className="flex-1 text-sm text-fg-secondary">{s.noOrm}</span>
          <CommandButton command="install:orm" label={s.install} variant="primary" onRun={exec} />
        </div>
      ) : (
        <>
          <div className="grid gap-2 rounded-xl bg-canvas p-3 text-sm sm:grid-cols-[140px_1fr]">
            <span className="text-fg-muted">{s.dbDriver}</span><code className="font-mono text-fg">{db?.driver || '—'}</code>
            <span className="text-fg-muted">{s.dbTarget}</span><code className="font-mono text-fg">{db?.target || '—'}</code>
            <span className="text-fg-muted">{s.dbState}</span>
            <span className={db?.reachable ? 'text-success' : 'text-warning'}>{db?.reachable ? s.dbReachable : s.dbUnreachable}</span>
          </div>
          {db?.error && <p className="font-mono text-xs break-words text-fg-muted">{db.error}</p>}
          <div className="flex flex-wrap gap-4">
            {status.composeDatabase && <CommandButton command="database:start" label={s.dbStart} onRun={exec} />}
            <CommandButton command="database:create" label={s.dbCreate} onRun={exec} />
          </div>
        </>
      )}
      <div className="flex flex-col gap-2 border-t border-line-subtle pt-4">
        <span className="text-sm font-medium text-fg">{s.dbUseConnection}</span>
        <div className="flex flex-wrap items-center gap-2">
          <Select aria-label={s.dbUseConnection} value={picked} onChange={e => setPicked(e.target.value)} className="w-auto min-w-[220px]">
            <option value="">{s.dbPick}</option>
            {connections.map(c => <option key={c.id} value={c.id}>{c.name} · {c.type}</option>)}
          </Select>
          <Button size="sm" variant="secondary" disabled={!picked} onClick={use}>{s.dbUse}</Button>
        </div>
        <span className="text-xs text-fg-muted">{s.dbUseHint}</span>
        {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      </div>
    </Section>
  )
}

// ─── Pages, controllers and users ─────────────────────────────────────────────

export function PagesSection({ entities, status, exec }: { entities: SfEntity[]; status: SfStatus; exec: Exec }) {
  const { t } = useI18n()
  const s = t.symfony
  const [controller, setController] = useState('')
  const ctrlOk = SF_NAME_RE.test(controller.replace(/Controller$/, ''))

  if (!status.packages.maker) {
    return (
      <Section title={s.pagesTitle} help={s.pagesHelp}>
        <div className="flex flex-wrap items-center gap-3">
          <span className="flex-1 text-sm text-fg-secondary">{s.needsMaker}</span>
          <CommandButton command="install:maker" label={s.install} variant="primary" onRun={exec} />
        </div>
      </Section>
    )
  }
  return (
    <div className="flex flex-col gap-4">
      <Section title={s.pagesTitle} help={s.pagesHelp}>
        <div className="flex flex-col overflow-hidden rounded-xl border border-line-subtle">
          {entities.map(e => (
            <div key={e.name} className="flex flex-wrap items-center gap-3 border-t border-line-subtle px-4 py-3 first:border-t-0">
              <span className="min-w-0 flex-1"><strong className="text-fg">{e.name}</strong> <span className="text-sm text-fg-muted">{s.crudHint}</span></span>
              <CommandButton command="make:crud" arg={e.name} label={s.crud} onRun={exec} />
            </div>
          ))}
        </div>
        <div className="flex flex-wrap items-end gap-3 border-t border-line-subtle pt-4">
          <label className="flex flex-col gap-1.5 text-sm text-fg-secondary">{s.newController}
            <Input value={controller} onChange={e => setController(e.target.value.replace(/\s/g, ''))} placeholder="Accueil" className="w-56 font-mono" spellCheck={false} />
          </label>
          <CommandButton command="make:controller" arg={controller.replace(/Controller$/, '') || 'Nom'} label={s.createController} onRun={exec} disabled={!ctrlOk} />
        </div>
      </Section>
      <Section title={s.usersTitle} help={s.usersHelp}>
        <div className="flex flex-wrap gap-4">
          {!status.hasUserEntity && <CommandButton command="make:user" label={s.makeUser} onRun={exec} disabled={!status.packages.security} />}
          <CommandButton command="make:login" label={s.makeLogin} onRun={exec} disabled={!status.hasUserEntity} />
        </div>
        {status.hasUserEntity && <p className="text-sm text-success">{s.hasUser}</p>}
      </Section>
    </div>
  )
}

// ─── Fake data ────────────────────────────────────────────────────────────────

/** How many rows of each entity, then one console task (Symfony, Next.js, Laravel) */
export function FixturesSection({ entities, ready, install, line, canRun, onRun }: {
  entities: SfEntity[]
  /** The tools are installed; otherwise `install` shows what to do */
  ready: boolean; install: ReactNode
  line: string; canRun: boolean
  onRun: (counts: Record<string, number>) => void
}) {
  const { t } = useI18n()
  const s = t.symfony
  const [counts, setCounts] = useState<Record<string, number>>(() => Object.fromEntries(entities.map(e => [e.name, e.relations.some(r => r.kind === 'ManyToOne') ? 20 : 5])))
  const total = Object.values(counts).reduce((a, b) => a + (b || 0), 0)

  function generate() {
    if (!window.confirm(s.fixturesConfirm)) return
    onRun(counts)
  }

  return (
    <Section title={s.fixturesTitle} help={s.fixturesHelp}>
      {!ready && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl bg-warning/10 p-3">
          <span className="flex-1 text-sm text-fg">{s.needsFixtures}</span>
          {install}
        </div>
      )}
      <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-2">
        {entities.map(e => (
          <label key={e.name} className="flex items-center gap-2 rounded-xl border border-line-subtle bg-canvas px-3 py-2 text-sm">
            <span className="min-w-0 flex-1 truncate text-fg">{e.name}</span>
            <Input type="number" min={0} max={10000} aria-label={s.howMany.replace('{name}', e.name)} value={counts[e.name] ?? 0}
              onChange={ev => setCounts(c => ({ ...c, [e.name]: Math.max(0, Math.min(10000, Number(ev.target.value) || 0)) }))} className="w-24" />
          </label>
        ))}
      </div>
      <p className="text-sm text-warning">{s.fixturesWarning}</p>
      <div className="flex flex-wrap items-center justify-end gap-3">
        <code className="mr-auto font-mono text-[11px] text-fg-muted">{line}</code>
        <Button disabled={!ready || !canRun || total === 0} onClick={generate}>{s.fixturesGo.replace('{n}', String(total))}</Button>
      </div>
    </Section>
  )
}

// ─── Routes ───────────────────────────────────────────────────────────────────

/** Every address of the app, with a shortcut to the API tester */
export function RoutesSection({ load, serverUrl, defaultUrl, help }: { load: () => Promise<SfRoute[]>; serverUrl: string | null; defaultUrl: string; help: string }) {
  const { t } = useI18n()
  const s = t.symfony
  const navigate = useNavigate()
  const [routes, setRoutes] = useState<SfRoute[] | null>(null)
  const [error, setError] = useState('')
  const [q, setQ] = useState('')

  useEffect(() => {
    let alive = true
    load().then(r => { if (alive) setRoutes(r) }).catch(err => { if (alive) setError(errorText(err)) })
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- read once per panel
  }, [])

  const shown = useMemo(() => (routes ?? []).filter(r => !q || `${r.path} ${r.name} ${r.controller}`.toLowerCase().includes(q.toLowerCase())), [routes, q])
  const base = (serverUrl ?? defaultUrl).replace(/\/$/, '')

  return (
    <Section title={s.routesTitle.replace('{n}', String(routes?.length ?? 0))} help={help}
      actions={<div className="relative">
        <Search size={13} className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-fg-muted" />
        <Input aria-label={s.routesSearch} placeholder={s.routesSearch} value={q} onChange={e => setQ(e.target.value)} className="w-64 pl-8" />
      </div>}>
      {error ? <p role="alert" className="font-mono text-sm text-danger">{error}</p> : !routes ? <Spinner /> : (
        <ul aria-label={s.routesTitle.replace('{n}', String(routes.length))} className="flex flex-col overflow-hidden rounded-xl border border-line-subtle">
          {shown.map(r => {
            const method = r.methods[0] ?? 'GET'
            const plain = !/[{[]/.test(r.path)
            return (
              <li key={`${r.name} ${r.path}`} className="grid grid-cols-[90px_1.4fr_1.4fr_auto] items-center gap-3 border-t border-line-subtle px-4 py-2 first:border-t-0">
                <span className="font-mono text-xs text-accent">{r.methods.join('|') || s.anyMethod}</span>
                <code className="truncate font-mono text-sm text-fg" title={r.name}>{r.path}</code>
                <code className="truncate font-mono text-xs text-fg-muted" title={r.controller}>{r.controller.replace(/^App\\(Http\\)?Controllers?\\/, '')}</code>
                <span className="flex gap-1">
                  <IconButton size="sm" title={s.openInTester} onClick={() => navigate(`/api-tester?${new URLSearchParams({ method, url: base + r.path })}`)}><Send size={13} /></IconButton>
                  {plain && method === 'GET' && <IconButton size="sm" title={s.openInBrowser} disabled={!serverUrl} onClick={() => window.devforge.openExternal(base + r.path)}><ExternalLink size={13} /></IconButton>}
                </span>
              </li>
            )
          })}
        </ul>
      )}
    </Section>
  )
}

// ─── Local server and cache ───────────────────────────────────────────────────

export function ServerSection({ status, serverUrl, exec }: { status: SfStatus; serverUrl: string | null; exec: Exec }) {
  const { t } = useI18n()
  const s = t.symfony
  return (
    <Section title={s.serverTitle} help={s.serverHelp}>
      {!status.symfonyCli ? <p className="text-sm text-warning">{s.noSymfonyCli}</p> : (
        <div className="flex flex-wrap items-center gap-4">
          <span className={serverUrl ? 'text-success' : 'text-fg-muted'}>{serverUrl ? s.serverOn.replace('{url}', serverUrl) : s.serverOff}</span>
          {serverUrl
            ? <>
              <Button size="sm" variant="secondary" onClick={() => window.devforge.openExternal(serverUrl)}><ExternalLink size={13} /> {s.openSite}</Button>
              <CommandButton command="server:stop" label={s.serverStop} onRun={exec} />
            </>
            : <CommandButton command="server:start" label={s.serverStart} variant="primary" onRun={exec} />}
        </div>
      )}
      <div className="flex flex-wrap gap-4 border-t border-line-subtle pt-4">
        <CommandButton command="cache:clear" label={s.cacheClear} onRun={exec} />
        <CommandButton command="composer:install" label={s.composerInstall} onRun={exec} />
      </div>
    </Section>
  )
}
