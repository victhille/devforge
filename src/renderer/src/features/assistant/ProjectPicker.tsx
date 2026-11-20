import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react'
import { createPortal } from 'react-dom'
import { Check, ChevronDown, CircleSlash, Search } from 'lucide-react'
import type { Project } from '@shared/types'
import { useI18n } from '@renderer/i18n/I18nContext'
import { cn } from '@renderer/lib/cn'
import { folderName } from '@shared/lib/projectFolders'
import ProjectIcon from '@renderer/features/projects/components/ProjectIcon'

interface Row {
  path: string | null
  name: string
  hint: string
  framework: string | null
  group: 'none' | 'favorites' | 'others'
}

const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

/**
 * The project Forgy reads, picked from a searchable list: its icon and its folder, the
 * favorites first, then the most recently opened. A combobox: type to filter, the arrows
 * move, Enter picks, Escape closes. The list opens on the window (above the field when it
 * sits low), so the panel never cuts it. Projects whose folder is gone are left out.
 */
export default function ProjectPicker({ projects, value, onChange }: { projects: Project[]; value: string | null; onChange: (path: string | null) => void }) {
  const { t } = useI18n()
  const a = t.assistant
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const [place, setPlace] = useState<CSSProperties>({})
  const button = useRef<HTMLButtonElement>(null)
  const pop = useRef<HTMLDivElement>(null)
  const listId = useId()

  const current = projects.find(p => p.path === value) ?? null

  const rows = useMemo<Row[]>(() => {
    const q = fold(query.trim())
    const usable = projects.filter(p => !p.missing && (!q || fold(`${p.name} ${p.path}`).includes(q)))
    const byRecent = (x: Project, y: Project) => (y.lastOpenedAt ?? '').localeCompare(x.lastOpenedAt ?? '') || x.name.localeCompare(y.name)
    const row = (p: Project, group: Row['group']): Row => ({
      path: p.path,
      name: p.name,
      hint: folderName(p.path.replace(/[\\/][^\\/]+$/, '')) || p.path,
      framework: p.framework,
      group
    })
    return [
      ...(q ? [] : [{ path: null, name: a.noProject, hint: a.projectNoneHint, framework: null, group: 'none' as const }]),
      ...usable
        .filter(p => p.favorite)
        .sort((x, y) => x.name.localeCompare(y.name))
        .map(p => row(p, 'favorites')),
      ...usable
        .filter(p => !p.favorite)
        .sort(byRecent)
        .map(p => row(p, 'others'))
    ]
  }, [projects, query, a])

  // Opens on the current choice, placed on the window: above the button when there is no room below
  useLayoutEffect(() => {
    if (!open || !button.current) return
    const r = button.current.getBoundingClientRect()
    const width = Math.min(320, window.innerWidth - 16)
    const left = Math.max(8, Math.min(r.left, window.innerWidth - width - 8))
    // Its real height once drawn (a short list fits below even near the bottom)
    const height = Math.min(pop.current?.scrollHeight ?? 380, 380)
    const below = window.innerHeight - r.bottom - 6 >= height + 8
    setPlace({ left, width, ...(below ? { top: r.bottom + 6 } : { bottom: window.innerHeight - r.top + 6 }) })
  }, [open])

  useEffect(() => {
    if (!open) return
    const at = rows.findIndex(r => r.path === value)
    setActive(at >= 0 ? at : 0)
    const close = (e: MouseEvent) => {
      if (!pop.current?.contains(e.target as Node) && !button.current?.contains(e.target as Node)) setOpen(false)
    }
    // A resize, or a scroll that moves the button (not one inside the list), would leave it astray
    const away = (e: Event) => {
      if (e.type === 'scroll' && pop.current?.contains(e.target as Node)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', close)
    window.addEventListener('resize', away)
    window.addEventListener('scroll', away, true)
    return () => {
      document.removeEventListener('mousedown', close)
      window.removeEventListener('resize', away)
      window.removeEventListener('scroll', away, true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- placed on the current choice when it opens, not at each keystroke
  }, [open])

  // The active row stays in view as the arrows move it
  useEffect(() => {
    pop.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [active])

  const pick = (path: string | null) => {
    onChange(path)
    setOpen(false)
    setQuery('')
    button.current?.focus()
  }

  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      if (!rows.length) return
      setActive(i => (i + (e.key === 'ArrowDown' ? 1 : -1) + rows.length) % rows.length)
    } else if (e.key === 'Home' || e.key === 'End') {
      e.preventDefault()
      setActive(e.key === 'Home' ? 0 : rows.length - 1)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const r = rows[active]
      if (r) pick(r.path)
    } else if (e.key === 'Tab') {
      // The list is at the end of the page: back on the button first, so Tab goes on from there
      button.current?.focus()
      setOpen(false)
    }
  }

  // Escape anywhere in the list closes it, and nothing behind it (the panel) closes too
  const onPopKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'Escape') return
    e.preventDefault()
    e.stopPropagation()
    e.nativeEvent.stopImmediatePropagation()
    setOpen(false)
    setQuery('')
    button.current?.focus()
  }

  const optionId = (i: number) => `${listId}-o${i}`
  // The rows by group, each keeping its place in the whole list (the arrows go through all of them)
  const groups = (['none', 'favorites', 'others'] as const)
    .map(key => ({
      key,
      title: key === 'favorites' ? a.projectFavorites : key === 'others' ? a.projectRecent : null,
      rows: rows.map((r, i) => ({ r, i })).filter(x => x.r.group === key)
    }))
    .filter(g => g.rows.length)

  return (
    <>
      <button
        ref={button}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={a.projectPickerLabel.replace('{name}', current?.name ?? a.noProject)}
        title={current?.path}
        onClick={() => setOpen(o => !o)}
        className={cn(
          'flex h-7 max-w-[220px] items-center gap-1.5 rounded-md border bg-surface px-1.5 text-xs transition-colors focus-visible:border-accent',
          open ? 'border-accent text-fg' : 'border-line-strong text-fg-secondary hover:border-fg-muted hover:text-fg'
        )}
      >
        {current ? <ProjectIcon framework={current.framework} size="xs" /> : <CircleSlash size={13} className="mx-0.5 text-fg-muted" aria-hidden />}
        <span className="truncate">{current?.name ?? a.noProject}</span>
        <ChevronDown size={12} className={cn('shrink-0 transition-transform', open && 'rotate-180')} aria-hidden />
      </button>
      {open &&
        createPortal(
          <div
            ref={pop}
            style={place}
            onKeyDown={onPopKey}
            className="df-pop fixed z-50 flex max-h-[380px] flex-col overflow-hidden rounded-card border border-line bg-elevated shadow-pop"
          >
            <div className="flex items-center gap-2 border-b border-line-subtle px-3">
              <Search size={13} className="shrink-0 text-fg-muted" aria-hidden />
              <input
                autoFocus
                role="combobox"
                aria-label={a.projectSearch}
                aria-expanded
                aria-controls={listId}
                aria-activedescendant={rows[active] ? optionId(active) : undefined}
                aria-autocomplete="list"
                value={query}
                onChange={e => {
                  setQuery(e.target.value)
                  setActive(0)
                }}
                onKeyDown={onKey}
                placeholder={a.projectSearch}
                className="h-9 min-w-0 flex-1 bg-transparent text-sm text-fg outline-none placeholder:text-fg-muted"
              />
            </div>
            {/* Said as soon as the search finds nothing */}
            <p role="status" className={cn('px-3 text-center text-sm text-fg-muted', rows.length ? 'sr-only' : 'flex flex-col items-center gap-1.5 py-5')}>
              {!rows.length && (
                <>
                  <Search size={16} aria-hidden />
                  {a.projectNone}
                </>
              )}
            </p>
            {rows.length > 0 && (
              <div id={listId} role="listbox" aria-label={a.projectPicker} className="min-h-0 flex-1 overflow-y-auto p-1">
                {groups.map(g => (
                  // A group is read with its name (Favorites, Other projects); "No project" has none
                  <div key={g.key} role={g.title ? 'group' : undefined} aria-labelledby={g.title ? `${listId}-${g.key}` : undefined}>
                    {g.title && (
                      <div id={`${listId}-${g.key}`} className="px-2.5 pt-2.5 pb-1 text-2xs font-semibold tracking-[.04em] text-fg-muted uppercase">
                        {g.title}
                      </div>
                    )}
                    {g.rows.map(({ r, i }) => {
                      const selected = r.path === value
                      return (
                        <div
                          key={r.path ?? '-'}
                          id={optionId(i)}
                          role="option"
                          aria-selected={selected}
                          data-index={i}
                          title={r.path ?? undefined}
                          onMouseDown={e => e.preventDefault()}
                          onMouseMove={() => setActive(i)}
                          onClick={() => pick(r.path)}
                          className={cn(
                            'flex min-h-[36px] cursor-pointer items-center gap-2.5 rounded-control px-2.5 py-1.5 transition-colors',
                            i === active ? 'bg-active' : ''
                          )}
                        >
                          {r.framework ? (
                            <ProjectIcon framework={r.framework} size="sm" className="size-7" />
                          ) : (
                            <span className="grid size-7 shrink-0 place-items-center rounded-lg border border-line text-fg-muted" aria-hidden>
                              <CircleSlash size={14} />
                            </span>
                          )}
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium text-fg">{r.name}</span>
                            <span className="block truncate text-xs text-fg-muted">{r.hint}</span>
                          </span>
                          {selected && <Check size={14} className="shrink-0 text-accent" aria-hidden />}
                        </div>
                      )
                    })}
                  </div>
                ))}
              </div>
            )}
          </div>,
          document.body
        )}
    </>
  )
}
