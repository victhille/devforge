import { useState } from 'react'
import { ArrowDownToLine, ArrowUpFromLine, GitCompareArrows } from 'lucide-react'
import type { EnvSyncDiff, EnvSyncKey } from '@shared/types'
import { useI18n } from '@renderer/i18n/I18nContext'
import { useToast } from '@renderer/app/ToastContext'
import { cn } from '@renderer/lib/cn'
import Button from '@renderer/components/ui/Button'
import Checkbox from '@renderer/components/ui/Checkbox'
import Modal from '@renderer/components/ui/Modal'
import { Input, Select } from '@renderer/components/ui/Input'

const errorText = (err: unknown) => String(err instanceof Error ? err.message : err).replace(/^Error invoking remote method '[^']+': (Error: )?/, '')

const STATUS_STYLE: Record<EnvSyncKey['status'], string> = {
  same: 'bg-active text-fg-muted',
  different: 'bg-warning-soft text-warning',
  local: 'bg-accent-soft text-accent',
  remote: 'bg-forgy-soft text-forgy'
}

/**
 * The project's .env against the one of a deployed copy. Only the state of
 * each key comes to the window; the values stay in the main process.
 */
export default function EnvSyncPanel({ targetId, envFiles }: { targetId: string; envFiles: string[] }) {
  const { t } = useI18n()
  const e = t.hub.envSync
  const toast = useToast()
  const [local, setLocal] = useState(envFiles.includes('.env') ? '.env' : envFiles[0] ?? '.env')
  const [remote, setRemote] = useState('.env')
  const [diff, setDiff] = useState<EnvSyncDiff | null>(null)
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState(false)
  const [confirm, setConfirm] = useState<'push' | 'pull' | null>(null)

  async function compare() {
    setBusy(true)
    try {
      const d = await window.devforge.env.syncDiff(targetId, local, remote)
      setDiff(d)
      setPicked(new Set(d.keys.filter(k => k.status !== 'same').map(k => k.key)))
    } catch (err) { toast.show({ tone: 'error', title: errorText(err) === 'NO_PROJECT' ? e.noProject : errorText(err) }) }
    finally { setBusy(false) }
  }

  async function apply(direction: 'push' | 'pull') {
    setConfirm(null); setBusy(true)
    try {
      const r = await window.devforge.env.syncApply(targetId, local, remote, direction, [...picked])
      toast.show({ tone: 'success', title: (direction === 'push' ? e.pushed : e.pulled).replace('{n}', String(r.changed)), description: r.backup && direction === 'push' ? e.backupAt.replace('{file}', r.backup) : undefined })
      await compare()
    } catch (err) { toast.show({ tone: 'error', title: errorText(err) }) }
    finally { setBusy(false) }
  }

  const toggle = (k: string) => setPicked(p => { const n = new Set(p); if (n.has(k)) n.delete(k); else n.add(k); return n })
  const differs = diff?.keys.filter(k => k.status !== 'same') ?? []

  return (
    <div className="flex flex-col gap-3 border-t border-line-subtle bg-canvas/40 px-[18px] py-4">
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1.5 text-[13px] text-fg-secondary">{e.localFile}
          {envFiles.length ? (
            <Select value={local} onChange={ev => { setLocal(ev.target.value); setDiff(null) }} className="w-44">
              {envFiles.map(f => <option key={f} value={f}>{f}</option>)}
            </Select>
          ) : <Input value={local} onChange={ev => { setLocal(ev.target.value); setDiff(null) }} className="w-44 font-mono" />}
        </label>
        <label className="flex flex-col gap-1.5 text-[13px] text-fg-secondary">{e.remoteFile}
          <Input value={remote} onChange={ev => { setRemote(ev.target.value); setDiff(null) }} className="w-44 font-mono" />
        </label>
        <Button variant="secondary" loading={busy && !diff} onClick={compare}><GitCompareArrows size={14} /> {e.compare}</Button>
      </div>
      <p className="text-xs text-fg-muted">{e.hint}</p>

      {diff && (
        <>
          <div className="font-mono text-xs text-fg-muted">{diff.remotePath}{!diff.remoteExists && ` · ${e.remoteMissing}`}</div>
          {diff.keys.length === 0 ? <p className="text-sm text-fg-muted">{e.empty}</p> : (
            <div className="flex flex-col gap-1">
              {diff.keys.map(k => (
                <div key={k.key} className="flex items-center gap-3 rounded-lg px-2 py-1 hover:bg-hover">
                  {k.status === 'same'
                    ? <span className="size-4 shrink-0" aria-hidden />
                    : <Checkbox checked={picked.has(k.key)} onChange={() => toggle(k.key)}><span className="sr-only">{k.key}</span></Checkbox>}
                  <span className="min-w-0 flex-1 truncate font-mono text-[12.5px] text-fg">{k.key}</span>
                  <span className={cn('rounded-md px-2 py-0.5 text-2xs font-medium', STATUS_STYLE[k.status])}>{e.status[k.status]}</span>
                </div>
              ))}
            </div>
          )}
          {differs.length === 0 && diff.keys.length > 0 && <p className="text-sm text-success">{e.inSync}</p>}
          {differs.length > 0 && (
            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="secondary" disabled={!picked.size || busy} onClick={() => setConfirm('pull')}><ArrowDownToLine size={14} /> {e.pull}</Button>
              <Button disabled={!picked.size || busy} loading={busy} onClick={() => setConfirm('push')}><ArrowUpFromLine size={14} /> {e.push}</Button>
            </div>
          )}
        </>
      )}

      {confirm && diff && (
        <Modal title={confirm === 'push' ? e.pushTitle : e.pullTitle} onClose={() => setConfirm(null)}
          footer={<>
            <Button variant="ghost" onClick={() => setConfirm(null)}>{e.cancel}</Button>
            <Button onClick={() => apply(confirm)}>{confirm === 'push' ? e.push : e.pull}</Button>
          </>}>
          <p className="text-[13px] text-fg-secondary">
            {(confirm === 'push' ? e.pushText : e.pullText).replace('{n}', String(picked.size)).replace('{local}', local).replace('{remote}', diff.remotePath)}
          </p>
          <p className="font-mono text-xs break-all text-fg-muted">{[...picked].join(', ')}</p>
          <p className="text-[13px] text-fg-secondary">{confirm === 'push' ? e.pushSafety : e.pullSafety}</p>
        </Modal>
      )}
    </div>
  )
}
