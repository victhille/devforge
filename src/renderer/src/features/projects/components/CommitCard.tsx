import { useEffect, useId, useRef, useState } from 'react'
import { ArrowUp, ChevronRight, Sparkles } from 'lucide-react'
import { useI18n } from '@renderer/i18n/I18nContext'
import { cn } from '@renderer/lib/cn'
import Button from '@renderer/components/ui/Button'
import Card from '@renderer/components/ui/Card'
import Checkbox from '@renderer/components/ui/Checkbox'
import { formatCommit, suggestCommit } from '@renderer/features/git/commitMessage'
import { STATUS_LETTER, type CommitState } from '@renderer/features/git/useCommit'

/**
 * The commit of the « Files and Git » tab, as in the mock-up: the message, a
 * suggestion, how many files, Commit or Commit and push. The files unfold to
 * leave some out (a partial commit). The message follows the chosen files
 * until it is written by hand.
 */
export default function CommitCard({ commit, canPush }: { commit: CommitState; canPush: boolean }) {
  const { t } = useI18n()
  const g = t.gitDash
  const id = useId()
  const { changes, chosen, selected, setSelected, toggle, busy } = commit
  const [text, setText] = useState('')
  const [open, setOpen] = useState(false)
  const edited = useRef(false)
  const suggest = () => { edited.current = false; setText(formatCommit(suggestCommit(chosen), '')) }
  useEffect(() => { if (!edited.current) setText(formatCommit(suggestCommit(chosen), '')) }, [chosen])

  if (!changes?.length) return null
  const header = text.split('\n')[0].trim()
  const ready = !!header && chosen.length > 0 && !busy
  const count = chosen.length === changes.length
    ? g.filesCount.replace('{n}', String(changes.length))
    : g.files.replace('{n}', String(chosen.length)).replace('{total}', String(changes.length))

  return (
    <Card className="flex shrink-0 flex-col gap-3 p-4.5">
      <label htmlFor={id} className="text-sm font-semibold text-fg-secondary">{g.message}</label>
      <textarea id={id} value={text} rows={2} onChange={e => { edited.current = true; setText(e.target.value) }}
        className="min-h-16 resize-y rounded-control border border-line bg-canvas px-3 py-2 font-mono text-sm text-fg outline-none focus:border-accent focus:ring-3 focus:ring-accent-soft" />
      {open && (
        <div className="flex max-h-40 flex-col overflow-y-auto rounded-lg border border-line-subtle bg-canvas py-1">
          <div className="flex items-center px-3 py-1">
            <Checkbox checked={selected.size === changes.length} onChange={on => setSelected(on ? new Set(changes.map(c => c.path)) : new Set())}>
              <span className="text-xs text-fg-secondary">{g.selectAll}</span>
            </Checkbox>
          </div>
          {changes.map(c => {
            const st = STATUS_LETTER[c.status]
            return (
              <div key={c.path} className="flex items-center gap-2.5 px-3 py-1 hover:bg-hover">
                <Checkbox checked={selected.has(c.path)} onChange={on => toggle(c.path, on)}><span className="sr-only">{c.path}</span></Checkbox>
                <span aria-hidden className={cn('w-3 font-mono text-xs font-bold', st.className)}>{st.letter}</span>
                <span className="flex-1 truncate font-mono text-xs text-fg">{c.path}</span>
                {c.insertions !== null && <span className="font-mono text-2xs text-success">+{c.insertions}</span>}
                {c.deletions !== null && <span className="font-mono text-2xs text-danger">−{c.deletions}</span>}
              </div>
            )
          })}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="ghost" className="text-accent hover:text-accent" onClick={suggest}><Sparkles size={13} /> {g.suggest}</Button>
        <button type="button" aria-expanded={open} onClick={() => setOpen(v => !v)}
          className="inline-flex h-7.5 items-center gap-1 rounded-md px-2 text-sm text-fg-muted hover:bg-elevated hover:text-fg">
          <ChevronRight size={13} aria-hidden className={cn('transition-transform', open && 'rotate-90')} /> {count}
        </button>
        <span className={cn('font-mono text-xs', header.length > 72 ? 'text-warning' : 'text-fg-muted')} title={g.headerLength}>{header.length}/72</span>
        <span className="flex-1" />
        <Button size="sm" variant="secondary" disabled={!ready} loading={busy === 'commit'} onClick={() => commit.commit(text.trim(), false)}>{g.commit}</Button>
        {canPush && (
          <Button size="sm" disabled={!ready} loading={busy === 'push'} onClick={() => commit.commit(text.trim(), true)}>
            {busy !== 'push' && <ArrowUp size={13} />} {g.commitPush}
          </Button>
        )}
      </div>
    </Card>
  )
}
