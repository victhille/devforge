import { useEffect, useState } from 'react'
import { LinesSkeleton } from '@renderer/components/ui/Skeleton'
import { ArrowUp, GitCommitHorizontal, Sparkles } from 'lucide-react'
import type { Project } from '@shared/types'
import { useI18n } from '@renderer/i18n/I18nContext'
import { cn } from '@renderer/lib/cn'
import Button from '@renderer/components/ui/Button'
import Checkbox from '@renderer/components/ui/Checkbox'
import Modal from '@renderer/components/ui/Modal'
import { Input, Textarea } from '@renderer/components/ui/Input'
import { COMMIT_TYPES, formatCommit, suggestCommit, type CommitType } from './commitMessage'
import { STATUS_LETTER, useCommit } from './useCommit'

interface Props {
  project: Project
  canPush: boolean
  onClose: () => void
  onDone: () => void
}

export default function CommitModal({ project, canPush, onClose, onDone }: Props) {
  const { t } = useI18n()
  const g = t.gitDash
  const { changes, selected, setSelected, toggle, chosen, busy, commit: send } = useCommit(project.path, onDone)
  const [type, setType] = useState<CommitType>('feat')
  const [scope, setScope] = useState('')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')

  /** Re-suggest whenever the selection changes */
  function applySuggestion() {
    const s = suggestCommit(chosen)
    setType(s.type)
    setScope(s.scope)
    setSubject(s.subject)
  }
  useEffect(applySuggestion, [chosen])

  const message = formatCommit({ type, scope, subject }, body)
  const header = message.split('\n')[0]

  const commit = (push: boolean) => send(message, push)

  return (
    <Modal
      title={<span className="flex items-center gap-2"><GitCommitHorizontal size={16} /> {g.commitTitle} — {project.name}</span>}
      onClose={onClose}
      className="max-w-3xl"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>{t.common.cancel}</Button>
          <Button variant="secondary" disabled={!subject.trim() || chosen.length === 0 || !!busy} loading={busy === 'commit'} onClick={() => commit(false)}>
            {g.commit}
          </Button>
          {canPush && (
            <Button disabled={!subject.trim() || chosen.length === 0 || !!busy} loading={busy === 'push'} onClick={() => commit(true)}>
              {busy !== 'push' && <ArrowUp size={14} />} {g.commitPush}
            </Button>
          )}
        </>
      }
    >
      {/* Files */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-fg-secondary">{g.files.replace('{n}', String(chosen.length)).replace('{total}', String(changes?.length ?? 0))}</span>
          {changes && changes.length > 0 && (
            <Checkbox checked={selected.size === changes.length} onChange={on => setSelected(on ? new Set(changes.map(c => c.path)) : new Set())}>
              <span className="text-xs">{g.selectAll}</span>
            </Checkbox>
          )}
        </div>
        <div className="max-h-56 overflow-y-auto rounded-lg border border-line-subtle bg-canvas">
          {!changes && <LinesSkeleton lines={4} className="p-4" />}
          {changes?.length === 0 && <p className="p-4 text-center text-sm text-fg-muted">{g.noChanges}</p>}
          {changes?.map(c => {
            const st = STATUS_LETTER[c.status]
            return (
              <div key={c.path} className="flex items-center gap-2.5 px-3 py-1.5 hover:bg-hover">
                <Checkbox checked={selected.has(c.path)} onChange={on => toggle(c.path, on)}>{null}</Checkbox>
                <span className={cn('w-3 font-mono text-xs font-bold', st.className)}>{st.letter}</span>
                <span className="flex-1 truncate font-mono text-xs text-fg">{c.path}</span>
                {c.insertions !== null && <span className="font-mono text-2xs text-success">+{c.insertions}</span>}
                {c.deletions !== null && <span className="font-mono text-2xs text-danger">−{c.deletions}</span>}
              </div>
            )
          })}
        </div>
      </div>

      {/* Message */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-fg-secondary">{g.message}</span>
          <Button variant="ghost" size="sm" onClick={applySuggestion}><Sparkles size={13} /> {g.suggest}</Button>
        </div>
        <div className="flex flex-wrap gap-1">
          {COMMIT_TYPES.map(ct => (
            <button
              key={ct}
              type="button"
              onClick={() => setType(ct)}
              className={cn(
                'rounded-full border px-2.5 py-0.5 font-mono text-xs transition-colors',
                type === ct ? 'border-accent bg-accent-soft text-accent' : 'border-line-subtle text-fg-secondary hover:border-line hover:text-fg'
              )}
            >
              {ct}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <Input value={scope} onChange={e => setScope(e.target.value.replace(/\s/g, '-'))} placeholder="scope" className="w-36 font-mono text-sm" />
          <Input value={subject} onChange={e => setSubject(e.target.value)} placeholder={g.subjectPlaceholder} className="font-mono text-sm" />
        </div>
        <Textarea value={body} onChange={e => setBody(e.target.value)} placeholder={g.bodyPlaceholder} rows={3} className="resize-none" />
        <div className={cn('rounded-lg bg-canvas px-3 py-2 font-mono text-xs', header.length > 72 ? 'text-warning' : 'text-fg-secondary')}>
          {header} <span className="text-fg-muted">({header.length}/72)</span>
        </div>
      </div>
    </Modal>
  )
}
