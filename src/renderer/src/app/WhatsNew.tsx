import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Activity, Container, Database, FolderOpen, Palette, Rocket, Settings, Sparkles, X, type LucideIcon } from 'lucide-react'
import type { ChangeItem, ChangelogVersion } from '@shared/lib/changelog'
import { useI18n } from '@renderer/i18n/I18nContext'
import { cn } from '@renderer/lib/cn'
import Button from '@renderer/components/ui/Button'
import IconButton from '@renderer/components/ui/IconButton'
import Mascot from '@renderer/features/assistant/Mascot'
import { CHANGE_META, Inline, changelog } from '@renderer/features/settings/ReleaseNotes'
import { useToast } from './ToastContext'

const KEY = 'devforge:last-version'

/** A picture for a highlight, from its scope or its words */
const PICTURES: [RegExp, LucideIcon | 'forgy', string][] = [
  [/assistant|forgy|ia\b|ai\b/i, 'forgy', 'bg-forgy-soft'],
  [/docker|compose|conteneur|container/i, Container, 'bg-accent-soft'],
  [/vps|monitor|surveill|watch|serveur|server/i, Activity, 'bg-warning-soft'],
  [/projet|project|hub/i, FolderOpen, 'bg-success-soft'],
  [/base|database|sql/i, Database, 'bg-accent-soft'],
  [/design|th[eè]me|apparence|appearance|menu/i, Palette, 'bg-forgy-soft'],
  [/param|setting/i, Settings, 'bg-active'],
  [/d[ée]ploi|deploy|vercel|n8n/i, Rocket, 'bg-success-soft']
]
function pictureOf(it: ChangeItem): [LucideIcon | 'forgy', string] {
  const hit = PICTURES.find(([re]) => re.test(`${it.scope ?? ''} ${it.text}`))
  return hit ? [hit[1], hit[2]] : [Sparkles, 'bg-accent-soft']
}

/** After an update: a short tour of the new version (or a toast when it has no notes) */
export default function WhatsNew() {
  const { t, lang } = useI18n()
  const toast = useToast()
  const navigate = useNavigate()
  const [version, setVersion] = useState<ChangelogVersion | null>(null)

  useEffect(() => {
    let previous: string | null = null
    try {
      previous = localStorage.getItem(KEY)
      localStorage.setItem(KEY, __APP_VERSION__)
    } catch { /* storage unavailable: no notice */ }
    if (!previous || previous === __APP_VERSION__) return
    const notes = changelog(lang).find(v => v.version === __APP_VERSION__)
    window.devforge.getSettings().then(s => {
      if (notes?.items.length && s.showWhatsNew !== false) { setVersion(notes); return }
      toast.show({
        tone: 'info',
        title: t.settings.updatedTo.replace('{v}', __APP_VERSION__),
        description: t.settings.updatedFrom.replace('{v}', previous!),
        action: { label: t.settings.seeWhatsNew, onClick: () => navigate(`/settings?notes=${__APP_VERSION__}`) }
      })
    }).catch(() => {})
  // Once per launch
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (!version) return null
  return <WhatsNewDialog version={version} onClose={() => setVersion(null)} onAllNotes={() => { setVersion(null); navigate(`/settings?notes=${version.version}`) }} />
}

export function WhatsNewDialog({ version, onClose, onAllNotes }: { version: ChangelogVersion; onClose: () => void; onAllNotes: () => void }) {
  const { t, lang } = useI18n()
  const w = t.settings.whatsNew
  const n = t.settings.notes
  // Up to three new features get their own page, the rest is grouped at the end
  const highlights = useMemo(() => version.items.filter(i => i.type === 'new').slice(0, 3), [version])
  const rest = useMemo(() => version.items.filter(i => !highlights.includes(i)), [version, highlights])
  const pages = highlights.length + (rest.length ? 1 : 0)
  const [step, setStep] = useState(0)
  const last = step >= pages - 1

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      else if (e.key === 'ArrowRight') setStep(s => Math.min(pages - 1, s + 1))
      else if (e.key === 'ArrowLeft') setStep(s => Math.max(0, s - 1))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, pages])

  const date = version.date ? new Intl.DateTimeFormat(lang, { dateStyle: 'medium' }).format(new Date(version.date)) : ''
  const highlight = highlights[step]
  const groups = (['new', 'better', 'fix', 'other'] as const).map(type => ({ type, items: rest.filter(i => i.type === type) })).filter(g => g.items.length)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6 backdrop-blur-[2px]" onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}>
      <div role="dialog" aria-modal="true" aria-labelledby="whats-new-title"
        className="df-pop flex max-h-[min(660px,calc(100vh-48px))] w-[min(760px,100%)] flex-col overflow-hidden rounded-[20px] border border-line bg-elevated shadow-2xl">
        <div className="flex items-center gap-3.5 px-[22px] pt-5 pb-4">
          <Mascot mood="happy" size={46} followCursor={false} />
          <div className="min-w-0 flex-1">
            <div className="font-mono text-[11px] font-medium tracking-[.08em] text-forgy">{w.eyebrow.replace('{v}', version.version)}{date && ` · ${date}`}</div>
            <h2 id="whats-new-title" className="mt-0.5 text-[22px] font-semibold tracking-tight text-fg">{w.title.replace('{v}', version.version)}</h2>
          </div>
          <IconButton title={w.close} onClick={onClose}><X size={16} /></IconButton>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-[22px]">
          {highlight ? (
            <div key={step} className="df-rise flex flex-col gap-[18px]">
              <Picture item={highlight} />
              <div>
                <h3 className="text-lg font-semibold text-fg">{highlight.scope ?? n.typeNew}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-fg-secondary"><Inline text={highlight.text} /></p>
                {step === 0 && version.summary && <p className="mt-2 text-[13px] text-fg-muted">{version.summary}</p>}
              </div>
            </div>
          ) : (
            <div key="rest" className="df-rise flex flex-col gap-3.5 pb-1.5">
              <h3 className="text-lg font-semibold text-fg">{highlights.length ? w.andAlso : t.settings.notesOf.replace('{v}', version.version)}</h3>
              {!highlights.length && version.summary && <p className="text-sm text-fg-secondary">{version.summary}</p>}
              {groups.map(g => {
                const meta = CHANGE_META[g.type]
                return (
                  <div key={g.type} className="flex flex-col gap-2">
                    <div className={cn('flex items-center gap-2 font-mono text-[11px] font-medium tracking-[.06em] uppercase', meta.tone)}><meta.icon size={14} aria-hidden />{meta.label(n)}</div>
                    {g.items.map((it, i) => (
                      <div key={i} className="flex gap-2.5 rounded-[10px] bg-surface px-3 py-2.5 text-[13.5px] leading-normal text-fg">
                        <span className={cn('mt-[7px] size-1.5 shrink-0 rounded-full', meta.dot)} />
                        <span>{it.scope && <b className="font-semibold">{it.scope} · </b>}<Inline text={it.text} /></span>
                      </div>
                    ))}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3 px-[22px] pt-4 pb-5">
          {pages > 1 && (
            <div role="tablist" aria-label={w.title.replace('{v}', version.version)} className="flex gap-1.5">
              {Array.from({ length: pages }, (_, i) => (
                <button key={i} role="tab" aria-selected={i === step} aria-label={`${i + 1} / ${pages}`} onClick={() => setStep(i)}
                  className={cn('h-2 rounded-full transition-[width,background-color]', i === step ? 'w-[22px] bg-accent' : 'w-2 bg-active hover:bg-fg-disabled')} />
              ))}
            </div>
          )}
          <button onClick={onAllNotes} className="ml-2 text-[13px] text-accent hover:underline">{w.allNotes}</button>
          <span className="flex-1" />
          {step > 0 && <Button variant="secondary" onClick={() => setStep(step - 1)}>{w.previous}</Button>}
          <Button onClick={() => (last ? onClose() : setStep(step + 1))}>{last ? w.done : w.next}</Button>
        </div>
      </div>
    </div>
  )
}

/** Big picture of a highlight: Forgy for assistant features, else an icon on a tinted panel */
function Picture({ item }: { item: ChangeItem }) {
  const [icon, tint] = pictureOf(item)
  const Icon = icon === 'forgy' ? null : icon
  return (
    <div aria-hidden className={cn('relative flex h-[220px] items-center justify-center overflow-hidden rounded-[14px] border border-line-subtle', tint)}>
      <div className="absolute -top-10 -left-10 size-48 rounded-full bg-white/[.04]" />
      <div className="absolute -right-8 -bottom-16 size-64 rounded-full bg-white/[.04]" />
      {Icon ? (
        <div className="df-pop flex size-24 items-center justify-center rounded-[26px] border border-line bg-surface shadow-xl"><Icon size={44} className="text-fg" strokeWidth={1.6} /></div>
      ) : <Mascot mood="happy" size={120} followCursor={false} />}
    </div>
  )
}
