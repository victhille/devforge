import { useCallback, useEffect, useState } from 'react'
import { LogIn, Plus, RefreshCw, Trash2 } from 'lucide-react'
import type { McpServer } from '@shared/types'
import { useI18n } from '@renderer/i18n/I18nContext'
import { useToast } from '@renderer/app/ToastContext'
import { confirmDialog } from '@renderer/app/ConfirmContext'
import { errorText } from '@renderer/lib/errors'
import { cn } from '@renderer/lib/cn'
import Button from '@renderer/components/ui/Button'
import IconButton from '@renderer/components/ui/IconButton'
import Switch from '@renderer/components/ui/Switch'
import Modal from '@renderer/components/ui/Modal'
import StatusDot from '@renderer/components/ui/StatusDot'
import { Field, Input } from '@renderer/components/ui/Input'
import { CardSkeleton } from '@renderer/components/ui/Skeleton'
import ErrorState from '@renderer/components/ui/ErrorState'
import { SettingsCard, Segmented } from './parts'

type Filter = 'all' | 'added' | 'free'

/** Each catalog server's tile: its initials in its own colors (decoration, its name says it) */
const TILE: Record<string, { text: string; bg: string; fg: string }> = {
  vercel: { text: '▲', bg: '#000000', fg: '#FFFFFF' },
  context7: { text: 'C7', bg: '#1F2A22', fg: '#4ACB8A' },
  supabase: { text: 'S', bg: '#1C2B22', fg: '#3ECF8E' },
  sentry: { text: 'Se', bg: '#2A2033', fg: '#B49AE0' },
  linear: { text: 'L', bg: '#20223A', fg: '#8E95F2' },
  notion: { text: 'N', bg: '#F2EEE9', fg: '#121110' },
  playwright: { text: 'Pw', bg: '#1F2A1C', fg: '#7CC36E' }
}

/** Settings › Connections › MCP servers for Forgy: the official ones, and any other added by hand */
export default function McpServers() {
  const { t } = useI18n()
  const c = t.settings.connections
  const toast = useToast()
  const [servers, setServers] = useState<McpServer[] | null>(null)
  const [filter, setFilter] = useState<Filter>('all')
  const [busy, setBusy] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)

  const load = useCallback(() => {
    setLoadError(null)
    window.devforge.mcp
      .list()
      .then(setServers)
      .catch(err => setLoadError(errorText(err)))
  }, [])
  useEffect(load, [load])

  const replace = (s: McpServer) => setServers(list => (list ? list.map(x => (x.id === s.id ? s : x)) : list))

  async function run(id: string, fn: () => Promise<McpServer | void>, done?: (s: McpServer) => string | null) {
    setBusy(id)
    try {
      const s = await fn()
      if (s) {
        replace(s)
        const msg = done?.(s)
        if (s.error) toast.show({ tone: 'error', title: c.mcpFailed.replace('{name}', s.name), description: s.error })
        else if (msg) toast.show({ tone: 'success', title: msg })
      } else load()
    } catch (err) {
      toast.show({ tone: 'error', title: errorText(err) })
    } finally {
      setBusy(null)
    }
  }

  async function remove(s: McpServer) {
    if (!(await confirmDialog(c.mcpRemoveConfirm.replace('{name}', s.name)))) return
    run(s.id, () => window.devforge.mcp.remove(s.id))
  }

  if (!servers) return loadError ? <ErrorState title={c.mcpTitle} error={loadError} onRetry={load} /> : <CardSkeleton rows={3} />

  const shown = servers.filter(s => filter === 'all' || (filter === 'added' && s.added) || (filter === 'free' && s.auth !== 'oauth'))
  const ready = (s: McpServer) => s.state === 'ready'

  return (
    <section aria-label={c.mcpTitle}>
      <SettingsCard
        title={c.mcpTitle}
        hint={c.mcpHint}
        action={
          <Segmented
            label={c.mcpFilter}
            value={filter}
            onChange={setFilter}
            items={[
              { value: 'all', label: c.mcpAll },
              { value: 'added', label: c.mcpAdded },
              { value: 'free', label: c.mcpFree }
            ]}
          />
        }
      >
        <ul className="grid grid-cols-[repeat(auto-fill,minmax(270px,1fr))] gap-3 px-5 pb-5">
          {shown.map(s => {
            const tile = TILE[s.id] ?? { text: s.name.slice(0, 2), bg: 'var(--bg-elevated)', fg: 'var(--text-secondary)' }
            const how = s.auth === 'oauth' ? c.mcpHowAccount : s.auth === 'local' ? c.mcpHowLocal : c.mcpHowFree
            const desc = (c.mcpDesc as Record<string, string>)[s.id] ?? s.target
            return (
              <li
                key={s.id}
                className={cn(
                  'flex min-h-[132px] flex-col gap-2 rounded-card border p-3.5',
                  s.added ? 'border-line-strong bg-elevated' : 'border-line bg-surface'
                )}
              >
                <div className="flex items-center gap-2.5">
                  <span
                    aria-hidden
                    className="grid size-8 shrink-0 place-items-center rounded-control text-xs font-bold"
                    style={{ background: tile.bg, color: tile.fg }}
                  >
                    {tile.text}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold text-fg">{s.name}</div>
                    <div className="truncate text-xs text-fg-muted">{s.catalog ? how : s.target}</div>
                  </div>
                  {s.added && (
                    <Switch
                      checked={s.enabled}
                      label={c.mcpUse.replace('{name}', s.name)}
                      disabled={busy === s.id}
                      onChange={on => run(s.id, () => window.devforge.mcp.setEnabled(s.id, on))}
                    />
                  )}
                </div>
                <p className="text-xs leading-relaxed text-fg-secondary">{desc}</p>
                <div className="mt-auto flex flex-wrap items-center gap-2 text-xs">
                  {!s.added ? (
                    <Button
                      size="sm"
                      variant="secondary"
                      loading={busy === s.id}
                      onClick={() =>
                        run(
                          s.id,
                          () => window.devforge.mcp.add(s.id),
                          x => (x.state === 'ready' ? c.mcpAddedDone.replace('{name}', x.name) : null)
                        )
                      }
                    >
                      {busy !== s.id && (s.auth === 'oauth' ? <LogIn size={13} /> : <Plus size={13} />)} {s.auth === 'oauth' ? c.mcpSignIn : c.mcpAdd}
                    </Button>
                  ) : (
                    <>
                      <span
                        role="status"
                        className={cn('flex items-center gap-1.5', ready(s) ? 'text-success' : s.state === 'error' ? 'text-danger' : 'text-fg-muted')}
                      >
                        <StatusDot state={ready(s) ? 'on' : s.state === 'error' ? 'error' : 'off'} />
                        {ready(s)
                          ? c.mcpTools.replace('{n}', String(s.tools)).replace('{r}', String(s.readOnlyTools))
                          : s.state === 'needs-login'
                            ? c.mcpNeedsLogin
                            : s.state === 'error'
                              ? c.mcpError
                              : s.enabled
                                ? c.mcpNotTested
                                : c.mcpOff}
                      </span>
                      <span className="ml-auto flex items-center gap-1">
                        {s.state === 'needs-login' ? (
                          <Button size="sm" variant="secondary" loading={busy === s.id} onClick={() => run(s.id, () => window.devforge.mcp.signIn(s.id))}>
                            {busy !== s.id && <LogIn size={13} />} {c.mcpSignIn}
                          </Button>
                        ) : (
                          <IconButton
                            size="sm"
                            title={c.testOf.replace('{name}', s.name)}
                            disabled={busy === s.id || !s.enabled}
                            onClick={() => run(s.id, () => window.devforge.mcp.test(s.id))}
                          >
                            <RefreshCw size={13} />
                          </IconButton>
                        )}
                        <IconButton size="sm" title={c.removeOf.replace('{name}', s.name)} disabled={busy === s.id} onClick={() => remove(s)}>
                          <Trash2 size={13} />
                        </IconButton>
                      </span>
                    </>
                  )}
                </div>
                {s.error && <p className="text-xs break-words text-danger">{s.error}</p>}
              </li>
            )
          })}
          {filter !== 'free' && (
            <li className="flex min-h-[132px] flex-col justify-center gap-2 rounded-card border border-dashed border-line p-3.5">
              <div className="text-sm font-semibold text-fg">{c.mcpOther}</div>
              <p className="text-xs text-fg-muted">{c.mcpOtherHint}</p>
              <Button size="sm" variant="secondary" className="self-start" onClick={() => setAdding(true)}>
                <Plus size={13} /> {c.mcpAddCustom}
              </Button>
            </li>
          )}
        </ul>
        {adding && (
          <CustomDialog
            onClose={() => setAdding(false)}
            onAdded={s => {
              setAdding(false)
              setServers(list => [...(list ?? []), s])
              if (s.error) toast.show({ tone: 'error', title: c.mcpFailed.replace('{name}', s.name), description: s.error })
            }}
          />
        )}
      </SettingsCard>
    </section>
  )
}

/** A server that is not in the list: its name, and its address or the command that starts it on this PC */
function CustomDialog({ onClose, onAdded }: { onClose: () => void; onAdded: (s: McpServer) => void }) {
  const { t } = useI18n()
  const c = t.settings.connections
  const toast = useToast()
  const [name, setName] = useState('')
  const [target, setTarget] = useState('')
  const [busy, setBusy] = useState(false)
  const isCommand = !!target.trim() && !/^https?:\/\//i.test(target.trim())

  async function add() {
    // A command runs on this PC with the user's rights: said before it is added
    if (isCommand && !(await confirmDialog(c.mcpCommandConfirm.replace('{command}', target.trim())))) return
    setBusy(true)
    try {
      onAdded(await window.devforge.mcp.addCustom({ name, target }))
    } catch (err) {
      toast.show({ tone: 'error', title: errorText(err) })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      title={c.mcpAddCustom}
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t.common.cancel}
          </Button>
          <Button disabled={!name.trim() || !target.trim()} loading={busy} onClick={add}>
            {c.mcpAdd}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <Field label={c.mcpName}>
          <Input value={name} onChange={e => setName(e.target.value)} placeholder={c.mcpNamePlaceholder} />
        </Field>
        <Field label={c.mcpTarget} hint={c.mcpTargetHint}>
          <Input value={target} onChange={e => setTarget(e.target.value)} className="font-mono" placeholder="https://example.com/mcp" />
        </Field>
      </div>
    </Modal>
  )
}
