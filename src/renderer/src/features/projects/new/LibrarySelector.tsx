import { useState } from 'react'
import { ArrowLeft, Check, Search } from 'lucide-react'
import type { Framework } from '@shared/types'
import { PROJECT_LIBRARIES, type LibraryCategory } from '@shared/data/projectLibraries'
import { useI18n } from '@renderer/i18n/I18nContext'
import { libraryDescription } from '@shared/data/projectLibraries.fr'
import { cn } from '@renderer/lib/cn'
import Button from '@renderer/components/ui/Button'
import { Input } from '@renderer/components/ui/Input'
import { PageHeader } from '@renderer/components/ui/Page'

type NewProjectT = ReturnType<typeof useI18n>['t']['newProject']

const CAT_LABEL_KEY: Record<LibraryCategory, keyof NewProjectT> = {
  'styling':       'libCatStyling',
  'state':         'libCatState',
  'data-fetching': 'libCatFetching',
  'routing':       'libCatRouting',
  'forms':         'libCatForms',
  'validation':    'libCatValidation',
  'ui':            'libCatUi',
  'animation':     'libCatAnimation',
  'utils':         'libCatUtils',
  'i18n':          'libCatI18n',
  'testing':       'libCatTesting',
  'database':      'libCatDatabase',
  'auth':          'libCatAuth',
  'api':           'libCatApi'
}

interface Props {
  framework: Framework
  onBack:    () => void
  onSubmit:  (packages: string[], devPackages: string[]) => void
}

/** Step 3 (JS only): pick extra libraries to install. */
export default function LibrarySelector({ framework, onBack, onSubmit }: Props) {
  const { t, lang } = useI18n()
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [search,   setSearch]   = useState('')
  const [category, setCategory] = useState<LibraryCategory | 'all'>('all')

  const available = PROJECT_LIBRARIES.filter(lib =>
    lib.frameworks === 'all' || (lib.frameworks as Framework[]).includes(framework)
  )
  const categories = Array.from(new Set(available.map(l => l.category)))
  const q = search.toLowerCase()
  const filtered = available.filter(lib =>
    (category === 'all' || lib.category === category) &&
    (!q || lib.name.toLowerCase().includes(q) || libraryDescription(lib, lang).toLowerCase().includes(q))
  )

  function toggle(id: string) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  function create() {
    const libs = PROJECT_LIBRARIES.filter(l => selected.has(l.id))
    onSubmit(libs.flatMap(l => l.packages), libs.flatMap(l => l.devPackages ?? []))
  }

  const n = selected.size
  const createLabel = n === 0
    ? t.newProject.libCreate
    : t.newProject.libCreateWith.replace('{n}', String(n)).replace('{s}', n > 1 ? 's' : '')

  const chip = (active: boolean) => cn(
    'shrink-0 rounded-full border px-3 py-1 text-sm transition-colors',
    active ? 'border-accent bg-accent-soft text-accent' : 'border-line-subtle text-fg-secondary hover:border-line hover:text-fg'
  )

  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 flex-col gap-4 border-b border-line-subtle px-8 pt-6 pb-4">
        <div>
          <Button variant="ghost" size="sm" onClick={onBack}><ArrowLeft size={14} /> {t.newProject.back}</Button>
        </div>
        <PageHeader title={t.newProject.libTitle} subtitle={t.newProject.libSubtitle} />
        <div className="relative">
          <Search size={13} className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-fg-muted" />
          <Input
            className="pl-8"
            placeholder={t.newProject.libSearch}
            value={search}
            onChange={e => { setSearch(e.target.value); setCategory('all') }}
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          <button className={chip(category === 'all')} onClick={() => setCategory('all')}>{t.newProject.libCatAll}</button>
          {categories.map(cat => (
            <button key={cat} className={chip(category === cat)} onClick={() => setCategory(cat)}>
              {t.newProject[CAT_LABEL_KEY[cat]] as string}
            </button>
          ))}
        </div>
      </div>

      <div className="grid flex-1 auto-rows-min grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-2.5 overflow-y-auto px-8 py-5">
        {filtered.map(lib => {
          const on = selected.has(lib.id)
          return (
            <button
              key={lib.id}
              onClick={() => toggle(lib.id)}
              className={cn(
                'flex flex-col items-start gap-1 rounded-xl border p-3.5 text-left transition-colors',
                on ? 'border-accent bg-accent-soft' : 'border-line-subtle bg-surface hover:border-line hover:bg-elevated'
              )}
            >
              <div className="flex w-full items-center justify-between">
                <span className="size-2.5 rounded-full" style={{ background: lib.color }} />
                {on && (
                  <span className="flex size-4 items-center justify-center rounded-full bg-accent text-white">
                    <Check size={10} strokeWidth={3} />
                  </span>
                )}
              </div>
              <span className="font-semibold text-fg">{lib.name}</span>
              <span className="text-sm leading-snug text-fg-secondary">{libraryDescription(lib, lang)}</span>
              <span className="mt-1 font-mono text-2xs text-fg-muted">{lib.packages[0] ?? lib.devPackages?.[0] ?? ''}</span>
            </button>
          )
        })}
        {filtered.length === 0 && (
          <p className="col-span-full py-10 text-center text-fg-muted">No libraries found for "{search}"</p>
        )}
      </div>

      <div className="flex shrink-0 justify-end gap-2 border-t border-line-subtle bg-surface px-8 py-3">
        <Button variant="ghost" onClick={() => onSubmit([], [])}>{t.newProject.libSkip}</Button>
        <Button size="lg" onClick={create}>{createLabel}</Button>
      </div>
    </div>
  )
}
