import { useMemo, useState } from 'react'
import { Trash2 } from 'lucide-react'
import { useI18n } from '@renderer/i18n/I18nContext'
import { cn } from '@renderer/lib/cn'
import Button from '@renderer/components/ui/Button'
import Card from '@renderer/components/ui/Card'
import { Textarea } from '@renderer/components/ui/Input'
import { Page, PageHeader, SectionTitle } from '@renderer/components/ui/Page'
import { computeDiff, type DiffType } from './diff'
import ToolHelp from '@renderer/components/ui/ToolHelp'
import { DIFF_EXAMPLE } from '../examples'

const LINE_STYLE: Record<DiffType, { row: string; prefix: string; text: string; sign: string }> = {
  add:    { row: 'bg-success-soft', prefix: 'bg-success/15 text-success', text: 'text-success',        sign: '+' },
  remove: { row: 'bg-danger-soft',  prefix: 'bg-danger/15 text-danger',   text: 'text-danger',         sign: '-' },
  equal:  { row: '',                prefix: 'text-fg-muted',              text: 'text-fg-secondary',   sign: ' ' }
}

export default function DiffPage() {
  const { t } = useI18n()
  const [left,  setLeft]  = useState('')
  const [right, setRight] = useState('')

  const diff    = useMemo(() => (left || right ? computeDiff(left, right) : []), [left, right])
  const added   = diff.filter(d => d.type === 'add').length
  const removed = diff.filter(d => d.type === 'remove').length

  return (
    <Page className="h-full max-w-none gap-4">
      <PageHeader
        title={t.diff.title}
        subtitle={t.diff.subtitle}
        actions={(left || right) && (
          <Button variant="secondary" size="sm" onClick={() => { setLeft(''); setRight('') }}>
            <Trash2 size={13} /> {t.diff.clear}
          </Button>
        )}
      />
      <ToolHelp id="diff" what={t.toolHelp.diff.what} how={t.toolHelp.diff.how}
        examples={[{ label: t.toolHelp.diff.sample, onPick: () => { setLeft(DIFF_EXAMPLE.left); setRight(DIFF_EXAMPLE.right) } }]} />

      <div className="grid shrink-0 grid-cols-2 gap-3">
        {[
          { label: t.diff.original, value: left,  set: setLeft,  placeholder: t.diff.pasteOriginal },
          { label: t.diff.modified, value: right, set: setRight, placeholder: t.diff.pasteModified }
        ].map(panel => (
          <div key={panel.label} className="flex flex-col gap-1.5">
            <SectionTitle>{panel.label}</SectionTitle>
            <Textarea
              value={panel.value}
              onChange={e => panel.set(e.target.value)}
              spellCheck={false}
              placeholder={panel.placeholder}
              className="h-44 resize-none rounded-xl bg-surface"
            />
          </div>
        ))}
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-1.5">
        <div className="flex shrink-0 items-center justify-between">
          <SectionTitle>{t.diff.result}</SectionTitle>
          {diff.length > 0 && (
            <div className="flex gap-3 text-sm font-semibold">
              <span className="text-success">+{added} {t.diff.added}</span>
              <span className="text-danger">-{removed} {t.diff.removed}</span>
            </div>
          )}
        </div>
        <Card className="flex-1 overflow-y-auto font-mono text-sm leading-relaxed">
          {diff.length === 0 ? (
            <div className="flex h-full items-center justify-center font-sans text-fg-muted">{t.diff.noInput}</div>
          ) : diff.map((line, i) => {
            const s = LINE_STYLE[line.type]
            return (
              <div key={i} className={cn('flex min-h-6 items-stretch', s.row)}>
                <span className={cn('flex w-7 shrink-0 select-none items-center justify-center border-r border-line-subtle font-bold', s.prefix)}>
                  {s.sign}
                </span>
                <span className={cn('flex-1 whitespace-pre-wrap break-all px-3 py-0.5', s.text)}>{line.text || ' '}</span>
              </div>
            )
          })}
        </Card>
      </div>
    </Page>
  )
}
