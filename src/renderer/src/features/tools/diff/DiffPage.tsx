import { useMemo, useState } from 'react'
import { ArrowLeftRight, Trash2 } from 'lucide-react'
import { useI18n } from '@renderer/i18n/I18nContext'
import { cn } from '@renderer/lib/cn'
import { usePersistentState } from '@renderer/hooks/usePersistentState'
import Badge from '@renderer/components/ui/Badge'
import Button from '@renderer/components/ui/Button'
import Checkbox from '@renderer/components/ui/Checkbox'
import IconButton from '@renderer/components/ui/IconButton'
import EmptyState from '@renderer/components/ui/EmptyState'
import Tabs from '@renderer/components/ui/Tabs'
import { Page, PageHeader } from '@renderer/components/ui/Page'
import { computeDiff, type DiffLine } from './diff'
import ToolHelp from '@renderer/components/ui/ToolHelp'
import { DIFF_EXAMPLE } from '../examples'

type View = 'split' | 'unified'

/** A line with its number on its side (or both, unified) */
interface Numbered extends DiffLine { left: number | null; right: number | null }

function numbered(diff: DiffLine[]): Numbered[] {
  let l = 0, r = 0
  return diff.map(d => ({ ...d, left: d.type === 'add' ? null : ++l, right: d.type === 'remove' ? null : ++r }))
}

const ROW: Record<DiffLine['type'], string> = { add: 'bg-success-soft', remove: 'bg-danger-soft', equal: '' }

/** A column of lines, its numbers in the margin, as in the mock-up */
function Lines({ lines, side, label }: { lines: Numbered[]; side: 'left' | 'right' | 'both'; label: string }) {
  return (
    <div role="region" aria-label={label} tabIndex={0} className="overflow-auto rounded-card bg-console py-3 font-mono text-sm leading-relaxed">
      {lines.map((line, i) => (
        <div key={i} className={cn('flex min-w-max', ROW[line.type])}>
          {side === 'both' ? (
            <>
              <span aria-hidden className="w-10 shrink-0 pr-2 text-right text-fg-muted select-none">{line.left ?? ''}</span>
              <span aria-hidden className="w-10 shrink-0 pr-3 text-right text-fg-muted select-none">{line.right ?? ''}</span>
              <span aria-hidden className={cn('w-4 shrink-0 select-none', line.type === 'add' ? 'text-success' : line.type === 'remove' ? 'text-danger' : 'text-fg-muted')}>
                {line.type === 'add' ? '+' : line.type === 'remove' ? '-' : ' '}
              </span>
            </>
          ) : (
            <span aria-hidden className="w-11 shrink-0 pr-4 text-right text-fg-muted select-none">{side === 'left' ? line.left : line.right}</span>
          )}
          <span className="pr-4 whitespace-pre text-fg">
            {line.type !== 'equal' && <span className="sr-only">{line.type === 'add' ? '+' : '-'}</span>}
            {line.text || ' '}
          </span>
        </div>
      ))}
    </div>
  )
}

/**
 * As in the mock-up: what was taken out and put in counted at the top, the
 * two versions side by side with their line numbers (or one unified list);
 * the texts are typed or pasted in the two fields above.
 */
export default function DiffPage() {
  const { t } = useI18n()
  const d = t.diff
  const [left,  setLeft]  = useState('')
  const [right, setRight] = useState('')
  const [ignoreSpaces, setIgnoreSpaces] = useState(false)
  const [view, setView] = usePersistentState<View>('devforge:diff-view', 'split')

  const diff    = useMemo(() => numbered(left || right ? computeDiff(left, right, { ignoreWhitespace: ignoreSpaces }) : []), [left, right, ignoreSpaces])
  const added   = diff.filter(x => x.type === 'add').length
  const removed = diff.filter(x => x.type === 'remove').length

  return (
    <Page className="df-mockup min-h-full max-w-none gap-5">
      <PageHeader
        crumb={t.nav.groupTools}
        title={d.title}
        subtitle={d.subtitle}
        actions={
          <>
            <Tabs<View> value={view} onChange={setView} label={d.view} items={[{ value: 'split', label: d.split }, { value: 'unified', label: d.unified }]} />
            <Button variant="secondary" disabled={!left && !right} onClick={() => { setLeft(right); setRight(left) }}>
              <ArrowLeftRight size={14} aria-hidden /> {d.swap}
            </Button>
            {(left || right) && (
              <IconButton title={d.clear} onClick={() => { setLeft(''); setRight('') }}><Trash2 size={15} /></IconButton>
            )}
          </>
        }
      />
      <ToolHelp id="diff" what={t.toolHelp.diff.what} how={t.toolHelp.diff.how}
        examples={[{ label: t.toolHelp.diff.sample, onPick: () => { setLeft(DIFF_EXAMPLE.left); setRight(DIFF_EXAMPLE.right) } }]} />

      {/* The two texts */}
      <div className="grid shrink-0 gap-4 lg:grid-cols-2">
        {[
          { label: d.original, value: left,  set: setLeft,  placeholder: d.pasteOriginal },
          { label: d.modified, value: right, set: setRight, placeholder: d.pasteModified }
        ].map(panel => (
          <label key={panel.label} className="flex flex-col gap-2">
            <span className="text-sm font-semibold text-fg">{panel.label}</span>
            <textarea value={panel.value} onChange={e => panel.set(e.target.value)} spellCheck={false} placeholder={panel.placeholder}
              className="h-36 resize-y rounded-card border border-line-subtle bg-surface p-3.5 font-mono text-sm text-fg outline-none placeholder:text-fg-muted focus:border-accent" />
          </label>
        ))}
      </div>

      {/* What changed */}
      <div className="flex flex-wrap items-center gap-2">
        {diff.length > 0 && (
          <>
            <Badge color="danger">{d.removedCount.replace('{n}', String(removed))}</Badge>
            <Badge color="success">{d.addedCount.replace('{n}', String(added))}</Badge>
          </>
        )}
        <Checkbox checked={ignoreSpaces} onChange={setIgnoreSpaces} className="ml-auto text-sm">{d.ignoreSpaces}</Checkbox>
      </div>

      {diff.length === 0 ? (
        <EmptyState title={d.noInput} />
      ) : view === 'split' ? (
        <div className="grid min-h-0 gap-4 lg:grid-cols-2">
          <Lines lines={diff.filter(x => x.type !== 'add')} side="left" label={`${d.result} · ${d.original}`} />
          <Lines lines={diff.filter(x => x.type !== 'remove')} side="right" label={`${d.result} · ${d.modified}`} />
        </div>
      ) : (
        <Lines lines={diff} side="both" label={d.result} />
      )}
    </Page>
  )
}
