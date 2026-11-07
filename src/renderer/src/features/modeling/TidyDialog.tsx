import { useMemo, useState } from 'react'
import { ArrowRight, Link2, MoveDiagonal, Pencil, Trash2 } from 'lucide-react'
import type { McdModel, MpdModel } from '@shared/types'
import { checkMcd, mcdSvg } from '@shared/lib/mcd'
import { tidyMcd, type TidyChange } from '@shared/lib/mcdTidy'
import { useI18n } from '@renderer/i18n/I18nContext'
import Button from '@renderer/components/ui/Button'
import Modal from '@renderer/components/ui/Modal'
import { mcdColors, svgUrl } from './colors'
import { fill } from './model'
import ZoomView from './ZoomView'
import Tabs from '@renderer/components/ui/Tabs'

const ICON = { removed: Trash2, linked: Link2, renamed: Pencil, moved: MoveDiagonal } as const

/**
 * v4.1: what the MCD would look like tidy (nothing hidden, one name each, the
 * framework's tables out, keys linked), next to what it is now; the user keeps
 * one or the other. Taking the new one is one step of the editor's history.
 */
export default function TidyDialog({ mcd, mpd, onKeep, onTake }: { mcd: McdModel; mpd?: MpdModel | null; onKeep: () => void; onTake: (next: McdModel) => void }) {
  const { t } = useI18n()
  const d = t.modeling.editor.tidy
  const [shown, setShown] = useState<'new' | 'now'>('new')
  const colors = useMemo(() => mcdColors(), [])
  const proposal = useMemo(() => tidyMcd(mcd, mpd), [mcd, mpd])
  const count = (m: McdModel) => checkMcd(m).length
  const text = (c: TidyChange) => c.code === 'moved' ? fill(d.change.moved, { n: c.count }) : fill(d.change[c.code], { ...c })
  const picture = useMemo(() => svgUrl(mcdSvg(shown === 'new' ? proposal.mcd : mcd, colors, 24)), [shown, proposal, mcd, colors])

  return (
    <Modal title={d.title} onClose={onKeep} className="max-w-5xl"
      footer={proposal.changes.length ? <>
        <Button variant="ghost" onClick={onKeep}>{d.keep}</Button>
        <Button onClick={() => onTake(proposal.mcd)}>{d.take}</Button>
      </> : <Button onClick={onKeep}>{d.close}</Button>}>
      {!proposal.changes.length ? <p className="text-sm text-fg-secondary">{d.nothing}</p> : (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <Tabs<'new' | 'now'> label={d.title} value={shown} onChange={setShown} items={[{ value: 'new', label: d.proposed }, { value: 'now', label: d.current }]} />
            <span className="flex items-center gap-1.5 text-sm text-fg-secondary">
              {fill(d.issues, { n: count(mcd) })} <ArrowRight size={13} /> <span className="font-medium text-fg">{fill(d.issues, { n: count(proposal.mcd) })}</span>
            </span>
          </div>
          {/* The whole MCD first; the wheel zooms, a drag moves it, as in the editor */}
          <div className="h-[56vh] overflow-hidden rounded-lg border border-line-subtle bg-canvas" data-testid="tidy-preview" data-shown={shown}>
            <ZoomView src={picture} label={shown === 'new' ? d.proposed : d.current} />
          </div>
          <div>
            <p className="mb-1.5 text-sm font-medium text-fg">{fill(d.changes, { n: proposal.changes.length })}</p>
            <ul className="flex flex-col gap-1 text-sm text-fg-secondary" aria-label={fill(d.changes, { n: proposal.changes.length })}>
              {proposal.changes.map((c, i) => {
                const Icon = ICON[c.code]
                return <li key={i} className="flex items-start gap-2"><Icon size={14} className="mt-0.5 shrink-0 text-fg-muted" />{text(c)}</li>
              })}
            </ul>
          </div>
        </>
      )}
    </Modal>
  )
}
