import { useEffect, useRef, useState } from 'react'
import { ChevronDown, ChevronRight, Pencil, Play, Plus, Rocket, Square, Trash2 } from 'lucide-react'
import type { ProcessInfo, Stack } from '@shared/types'
import { useI18n } from '@renderer/i18n/I18nContext'
import { useToast } from '@renderer/app/ToastContext'
import { cn } from '@renderer/lib/cn'
import Badge from '@renderer/components/ui/Badge'
import Button from '@renderer/components/ui/Button'
import Card from '@renderer/components/ui/Card'
import EmptyState from '@renderer/components/ui/EmptyState'
import IconButton from '@renderer/components/ui/IconButton'
import { Page, PageHeader } from '@renderer/components/ui/Page'
import StackEditor, { STEP_ICON } from './StackEditor'
import { procKey, useProcessLogs, useStacks } from './useStacks'

const DOT: Record<ProcessInfo['status'], string> = {
  running: 'bg-success animate-pulse',
  exited:  'bg-fg-muted',
  stopped: 'bg-fg-muted',
  failed:  'bg-danger'
}

function LogPanel({ procKey: key }: { procKey: string }) {
  const logs = useProcessLogs(key)
  const end = useRef<HTMLDivElement>(null)
  useEffect(() => { end.current?.scrollIntoView({ block: 'nearest' }) }, [logs])
  return (
    <div className="max-h-64 overflow-y-auto rounded-lg bg-console p-3 font-mono text-xs leading-relaxed">
      {logs.length === 0 && <span className="text-fg-muted">—</span>}
      {logs.map((l, i) => (
        <div key={i} className={cn('whitespace-pre-wrap break-all', l.stream === 'stderr' ? 'text-warning' : l.stream === 'system' ? 'text-accent' : 'text-fg-secondary')}>
          {l.text}
        </div>
      ))}
      <div ref={end} />
    </div>
  )
}

function StackCard({ stack, procs, running, onEdit, onDelete }: {
  stack: Stack
  procs: Record<string, ProcessInfo>
  running: number
  onEdit: () => void
  onDelete: () => void
}) {
  const { t } = useI18n()
  const s = t.stacks
  const toast = useToast()
  const [open, setOpen] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function startAll() {
    setBusy(true)
    try { await window.devforge.stacks.start(stack.id) }
    catch (err) { toast.show({ tone: 'error', title: s.startFailed, description: String(err) }) }
    finally { setBusy(false) }
  }

  return (
    <Card className="overflow-hidden">
      <div className="flex items-center gap-3 border-b border-line-subtle px-4 py-3">
        <span className="size-2.5 rounded-full" style={{ background: stack.color }} />
        <h3 className="flex-1 text-md font-semibold text-fg">{stack.name}</h3>
        {running > 0 && <Badge color="success">{s.running.replace('{n}', String(running))}</Badge>}
        <IconButton title={s.edit} onClick={onEdit}><Pencil size={14} /></IconButton>
        <IconButton title={t.common.delete} tone="danger" onClick={onDelete}><Trash2 size={14} /></IconButton>
        {running > 0
          ? <Button variant="danger" size="sm" onClick={() => window.devforge.stacks.stop(stack.id)}><Square size={12} /> {s.stopAll}</Button>
          : <Button size="sm" loading={busy} onClick={startAll}>{!busy && <Play size={13} />} {s.startAll}</Button>}
      </div>

      <div className="divide-y divide-line-subtle">
        {stack.steps.map(step => {
          const key = procKey(stack.id, step.id)
          const info = procs[key]
          const Icon = STEP_ICON[step.type]
          const isCommand = step.type === 'command'
          return (
            <div key={step.id} className="px-4 py-2.5">
              <div className="flex items-center gap-3">
                {isCommand ? (
                  <button onClick={() => setOpen(o => (o === key ? null : key))} className="text-fg-muted hover:text-fg" aria-label="Logs">
                    {open === key ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  </button>
                ) : <span className="w-3.5" />}
                <Icon size={15} className="shrink-0 text-fg-muted" />
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate font-medium text-fg">{step.label}</span>
                  <span className="truncate font-mono text-2xs text-fg-muted">
                    {step.type === 'url' ? step.url : step.type === 'command' ? `${step.command}  ·  ${step.cwd}` : step.cwd}
                  </span>
                </div>
                {isCommand && info && (
                  <span className="flex items-center gap-1.5 text-xs text-fg-secondary">
                    <span className={cn('size-2 rounded-full', DOT[info.status])} />
                    {s.status[info.status]}{info.exitCode !== null && info.status === 'failed' ? ` (${info.exitCode})` : ''}
                  </span>
                )}
                {isCommand && (info?.status === 'running'
                  ? <IconButton title={s.stop} tone="danger" onClick={() => window.devforge.stacks.stopStep(stack.id, step.id)}><Square size={12} /></IconButton>
                  : <IconButton title={s.start} onClick={() => { window.devforge.stacks.startStep(stack.id, step.id); setOpen(key) }}><Play size={13} /></IconButton>)}
                {!isCommand && <IconButton title={s.start} onClick={() => window.devforge.stacks.startStep(stack.id, step.id)}><Play size={13} /></IconButton>}
              </div>
              {open === key && <div className="mt-2.5"><LogPanel procKey={key} /></div>}
            </div>
          )
        })}
      </div>
    </Card>
  )
}

export default function StacksPage() {
  const { t } = useI18n()
  const s = t.stacks
  const { stacks, procs, save, remove, running } = useStacks()
  const [editing, setEditing] = useState<{ stack?: Stack } | null>(null)

  return (
    <Page>
      <PageHeader
        icon={<Rocket size={18} />}
        title={s.title}
        subtitle={s.subtitle}
        actions={<Button onClick={() => setEditing({})}><Plus size={14} /> {s.newStack}</Button>}
      />

      {stacks.length === 0 ? (
        <EmptyState
          icon={<Rocket size={32} />}
          title={s.emptyTitle}
          description={s.emptyHint}
          action={<Button onClick={() => setEditing({})}><Plus size={14} /> {s.newStack}</Button>}
        />
      ) : (
        <div className="flex flex-col gap-4">
          {stacks.map(stack => (
            <StackCard
              key={stack.id}
              stack={stack}
              procs={procs}
              running={running(stack)}
              onEdit={() => setEditing({ stack })}
              onDelete={() => { if (window.confirm(s.deleteConfirm.replace('{name}', stack.name))) remove(stack.id) }}
            />
          ))}
        </div>
      )}

      {editing && (
        <StackEditor
          initial={editing.stack}
          onClose={() => setEditing(null)}
          onSave={async stack => { await save(stack); setEditing(null) }}
        />
      )}
    </Page>
  )
}
