import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { ArrowLeft, ArrowUp, List, Sparkles, Wrench, Dot, type LucideIcon } from 'lucide-react'
import { parseChangelog, type ChangeType, type ChangelogVersion, type VersionKind } from '@shared/lib/changelog'
import { useI18n } from '@renderer/i18n/I18nContext'
import type { Translations } from '@renderer/i18n/translations'
import { cn } from '@renderer/lib/cn'
import Card from '@renderer/components/ui/Card'

/** Icon, colour and label of each kind of change (colour never alone: icon + label) */
export const CHANGE_META: Record<ChangeType, { icon: LucideIcon; tone: string; dot: string; label: (n: Translations['settings']['notes']) => string }> = {
  new: { icon: Sparkles, tone: 'text-accent', dot: 'bg-accent', label: n => n.typeNew },
  better: { icon: ArrowUp, tone: 'text-success', dot: 'bg-success', label: n => n.typeBetter },
  fix: { icon: Wrench, tone: 'text-forgy', dot: 'bg-forgy', label: n => n.typeFix },
  other: { icon: Dot, tone: 'text-fg-muted', dot: 'bg-fg-muted', label: n => n.typeOther }
}

const KIND_STYLE: Record<VersionKind, string> = {
  major: 'bg-forgy-soft text-forgy',
  minor: 'bg-accent-soft text-accent',
  patch: 'bg-active text-fg-secondary',
  pre: 'bg-warning-soft text-warning'
}

/** **bold**, _muted_ and [text](url) inside a changelog line */
export function Inline({ text }: { text: string }) {
  const parts: React.ReactNode[] = []
  const re = /\*\*(.+?)\*\*|\[([^\]]+)\]\((https?:\/\/[^)]+)\)|_(.+?)_/g
  let last = 0
  for (const m of text.matchAll(re)) {
    if (m.index > last) parts.push(text.slice(last, m.index))
    if (m[1]) parts.push(<strong key={m.index} className="font-semibold text-fg">{m[1]}</strong>)
    else if (m[2]) { const url = m[3]; parts.push(<button key={m.index} onClick={() => window.devforge.openExternal(url)} className="text-accent hover:underline">{m[2]}</button>) }
    else if (m[4]) parts.push(<em key={m.index} className="text-fg-muted">{m[4]}</em>)
    last = m.index + m[0].length
  }
  if (last < text.length) parts.push(text.slice(last))
  return <>{parts}</>
}

export const changelog = (lang: string): ChangelogVersion[] => parseChangelog(__CHANGELOGS__[lang as 'fr' | 'en'] || __CHANGELOGS__.fr)

type Filter = 'all' | 'new' | 'better' | 'fix'

/** Settings → release notes: every version as a card, filtered by kind of change */
export default function ReleaseNotes({ focus, onBack }: { focus?: string | null; onBack: () => void }) {
  const { t, lang } = useI18n()
  const n = t.settings.notes
  const versions = useMemo(() => changelog(lang), [lang])
  const [filter, setFilter] = useState<Filter>('all')
  const date = (d: string | null) => d ? new Intl.DateTimeFormat(lang, { dateStyle: 'medium' }).format(new Date(d)) : ''
  const anchor = (v: string) => `v-${v.replace(/\W/g, '-')}`

  // ?notes=<version> scrolls to that version
  useEffect(() => {
    if (focus) requestAnimationFrame(() => document.getElementById(anchor(focus))?.scrollIntoView({ block: 'start' }))
  }, [focus])

  const count = (f: Filter) => versions.reduce((sum, v) => sum + v.items.filter(i => f === 'all' || i.type === f).length, 0)
  const filters: { id: Filter; label: string; icon: LucideIcon; tone: string }[] = [
    { id: 'all', label: n.all, icon: List, tone: 'text-fg-secondary' },
    { id: 'new', label: n.filterNew, icon: CHANGE_META.new.icon, tone: CHANGE_META.new.tone },
    { id: 'better', label: n.filterBetter, icon: CHANGE_META.better.icon, tone: CHANGE_META.better.tone },
    { id: 'fix', label: n.filterFix, icon: CHANGE_META.fix.icon, tone: CHANGE_META.fix.tone }
  ]

  return (
    <div className="flex flex-col gap-[22px]">
      <div className="df-rise flex flex-wrap items-end gap-3">
        <div className="min-w-[220px] flex-1">
          <button onClick={onBack} className="flex items-center gap-1 text-[12.5px] text-accent hover:underline"><ArrowLeft size={13} /> {n.back}</button>
          <h1 className="mt-1.5 text-[26px] font-semibold tracking-tight text-fg">{t.settings.releaseNotes}</h1>
        </div>
        <div role="radiogroup" aria-label={t.settings.releaseNotes} className="flex flex-wrap gap-1.5">
          {filters.map(f => (
            <button key={f.id} role="radio" aria-checked={filter === f.id} onClick={() => setFilter(f.id)}
              className={cn('flex h-[30px] items-center gap-1.5 rounded-full border px-3 text-[12.5px] font-medium transition-colors',
                filter === f.id ? 'border-accent/50 bg-accent-soft text-fg' : 'border-line bg-surface text-fg-secondary hover:text-fg')}>
              <f.icon size={13} className={f.tone} aria-hidden />{f.label}<span className="font-mono text-[11px] text-fg-muted">{count(f.id)}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-start gap-7">
        <nav aria-label={n.versions} className="df-rise relative hidden max-w-[200px] flex-[1_1_170px] flex-col pl-3.5 lg:flex">
          <span aria-hidden className="absolute top-3 bottom-3 left-[18px] w-0.5 bg-line-subtle" />
          {versions.map(v => {
            const current = v.version === __APP_VERSION__
            return (
              <a key={v.version} href={`#${anchor(v.version)}`}
                onClick={e => { e.preventDefault(); document.getElementById(anchor(v.version))?.scrollIntoView({ behavior: 'smooth', block: 'start' }) }}
                className="relative flex items-center gap-3 rounded-lg px-2 py-1.5 text-fg-secondary transition-colors hover:bg-surface hover:text-fg">
                <span className={cn('relative size-2.5 rounded-full border-2', current ? 'border-accent bg-accent' : 'border-fg-disabled bg-canvas')} />
                <span>
                  <span className={cn('block font-mono text-[13px] font-medium', current && 'text-fg')}>{v.version}</span>
                  <span className="block text-[11.5px] text-fg-muted">{date(v.date)}</span>
                </span>
              </a>
            )
          })}
        </nav>

        <section className="flex min-w-0 max-w-[860px] flex-[999_1_520px] flex-col gap-[18px]">
          {versions.map((v, i) => {
            const items = v.items.filter(it => filter === 'all' || it.type === filter)
            const current = v.version === __APP_VERSION__
            return (
              <Card key={v.version} id={anchor(v.version)} className={cn('df-rise scroll-mt-4 overflow-hidden', current && 'border-accent/40')} style={{ '--i': Math.min(i, 6) } as CSSProperties}>
                <div className="flex flex-wrap items-center gap-x-3.5 gap-y-2.5 px-5 pt-[18px] pb-3">
                  <h2 className="font-mono text-xl font-semibold tracking-tight text-fg">{v.version}</h2>
                  <span className={cn('rounded-full px-2 py-0.5 font-mono text-[11px] font-medium', KIND_STYLE[v.kind])}>{n[v.kind]}</span>
                  {current && <span className="rounded-full bg-success-soft px-2 py-0.5 font-mono text-[11px] font-medium text-success">{t.settings.installed}</span>}
                  <span className="ml-auto text-[12.5px] text-fg-muted">{date(v.date)}</span>
                </div>
                {v.summary && <p className="px-5 pb-3.5 text-sm leading-relaxed text-fg-secondary">{v.summary}</p>}
                <div className="flex flex-col gap-1 px-3 pb-3.5">
                  {items.map((it, j) => {
                    const meta = CHANGE_META[it.type]
                    return (
                      <div key={j} className="flex items-start gap-3 rounded-[10px] px-2 py-2.5 transition-colors hover:bg-hover">
                        <span className={cn('mt-0.5 flex w-[122px] shrink-0 items-center gap-1.5 font-mono text-[11px] font-medium', meta.tone)}>
                          <meta.icon size={13} aria-hidden />{meta.label(n)}
                        </span>
                        <span className="min-w-0 flex-1 text-[13.5px] leading-normal text-fg">
                          {it.scope && <b className="font-semibold">{it.scope} · </b>}<Inline text={it.text} />
                        </span>
                        {it.sha && it.url && (
                          <button onClick={() => window.devforge.openExternal(it.url!)} className="mt-0.5 shrink-0 font-mono text-[11.5px] text-fg-muted hover:text-accent">{it.sha}</button>
                        )}
                      </div>
                    )
                  })}
                  {!items.length && <p className="px-2 py-1.5 text-[13px] text-fg-muted">{n.noneOfType}</p>}
                </div>
                {v.note && filter === 'all' && <div className="border-t border-line-subtle px-5 py-2.5 text-xs text-fg-muted">{v.note}</div>}
              </Card>
            )
          })}
        </section>
      </div>
    </div>
  )
}
