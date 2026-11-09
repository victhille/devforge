import { useCallback, useEffect, useRef, useState } from 'react'
import { LinesSkeleton } from '@renderer/components/ui/Skeleton'
import { NotebookPen, Pin, Plus, Trash2 } from 'lucide-react'
import type { NoteSummary, ProjectNote } from '@shared/types'
import { countOpen } from '@shared/lib/notesFormat'
import { useI18n } from '@renderer/i18n/I18nContext'
import { cn } from '@renderer/lib/cn'
import { setLive, useLive } from '@renderer/lib/live'
import { formatRelative } from '@renderer/lib/format'
import { errorText } from '@renderer/lib/errors'
import { NOTE_COUNTS } from '@renderer/hooks/useLiveData'
import { confirmDialog } from '@renderer/app/ConfirmContext'
import { useToast } from '@renderer/app/ToastContext'
import Button from '@renderer/components/ui/Button'
import Card from '@renderer/components/ui/Card'
import EmptyState from '@renderer/components/ui/EmptyState'
import ErrorState from '@renderer/components/ui/ErrorState'
import IconButton from '@renderer/components/ui/IconButton'
import RichNotes from './RichNotes'

/** A note is saved this long after the last key */
const SAVE_DELAY = 600

type Draft = { title: string; pinned: boolean; body: string }
/** The open note's file: a rename moves it, and the saves on their way follow */
type Target = { id: string }

const byOrder = (a: NoteSummary, b: NoteSummary) => Number(b.pinned) - Number(a.pinned) || b.updatedAt.localeCompare(a.updatedAt) || a.title.localeCompare(b.title)
const summary = (n: ProjectNote): NoteSummary => ({ id: n.id, title: n.title, pinned: n.pinned, updatedAt: n.updatedAt, open: countOpen(n.body) })

/**
 * A project's notes, as in the mock-up: the list on the left (pinned ones
 * first), the open note on the right with its toolbar. Each note is a file of
 * the project (.devforge/notes), saved as it is typed; its checkboxes are the
 * project's tasks, counted on its card and on this tab.
 */
export default function NotesPanel({ projectId, projectPath }: { projectId: string; projectPath: string }) {
  const { t, lang } = useI18n()
  const k = t.notes
  const toast = useToast()
  const key = `notes:${projectId}`
  const { data: list, error, reload } = useLive<NoteSummary[]>(key, () => window.devforge.notes.list(projectId), { topic: 'notes', scope: projectPath })

  /** The open note as read: it fills the editor (a new editor each round) */
  const [note, setNote] = useState<ProjectNote | null>(null)
  const [round, setRound] = useState(0)
  const [openId, setOpenId] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [pinned, setPinned] = useState(false)
  const [state, setState] = useState<'saved' | 'saving' | 'failed'>('saved')
  const [savedAt, setSavedAt] = useState('')
  const [readError, setReadError] = useState('')
  const [, setClock] = useState(0)

  const target = useRef<Target | null>(null)
  const draft = useRef<Draft | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout>>()
  /** Saves sent and not answered yet */
  const pending = useRef(0)
  const savedRef = useRef('')
  const queue = useRef<Promise<unknown>>(Promise.resolve())
  const titleRef = useRef<HTMLInputElement>(null)
  const cardRef = useRef<HTMLDivElement>(null)
  const newRef = useRef<HTMLButtonElement>(null)
  const listRef = useRef(list)
  listRef.current = list

  /** One at a time, in order: a note is saved before the next one is read */
  const enqueue = useCallback(<T,>(task: () => Promise<T>): Promise<T> => {
    const p = queue.current.then(task)
    queue.current = p.catch(() => {})
    return p
  }, [])

  const flush = useCallback(() => {
    if (!timer.current) return
    clearTimeout(timer.current)
    timer.current = undefined
    const to = target.current
    const d = draft.current
    if (!to || !d) return
    pending.current++
    void enqueue(async () => {
      const saved = await window.devforge.notes.save(projectId, { id: to.id, ...d })
      const before = to.id
      to.id = saved.id
      if (target.current === to) savedRef.current = saved.updatedAt
      setLive<NoteSummary[]>(key, l => [...(l ?? []).filter(n => n.id !== before && n.id !== saved.id), summary(saved)].sort(byOrder))
      return saved
    }).then(saved => {
      pending.current--
      if (target.current !== to) return
      setOpenId(saved.id)
      setSavedAt(saved.updatedAt)
      if (!timer.current && !pending.current) setState('saved')
    }, () => {
      pending.current--
      if (target.current === to) setState('failed')
    })
  }, [enqueue, key, projectId])

  // Leaving the tab keeps what was typed
  useEffect(() => () => flush(), [flush])
  // « il y a 2 min » moves on
  useEffect(() => { const i = setInterval(() => setClock(c => c + 1), 30_000); return () => clearInterval(i) }, [])

  /** The tab's count follows the boxes at once (the main process confirms it after the save) */
  const tellCount = (body: string) => {
    const others = (listRef.current ?? []).filter(n => n.id !== target.current?.id).reduce((sum, n) => sum + n.open, 0)
    setLive<Record<string, number>>(NOTE_COUNTS, c => ({ ...c, [projectId]: others + countOpen(body) }))
  }

  const change = (patch: Partial<Draft>, delay = SAVE_DELAY) => {
    if (!draft.current) return
    draft.current = { ...draft.current, ...patch }
    if (patch.body !== undefined) tellCount(patch.body)
    setState('saving')
    clearTimeout(timer.current)
    timer.current = setTimeout(flush, delay)
  }

  const show = (n: ProjectNote) => {
    target.current = { id: n.id }
    draft.current = { title: n.title, pinned: n.pinned, body: n.body }
    savedRef.current = n.updatedAt
    setNote(n)
    setOpenId(n.id)
    setTitle(n.title)
    setPinned(n.pinned)
    setSavedAt(n.updatedAt)
    setState('saved')
    setReadError('')
    setRound(r => r + 1)
  }

  const openNote = useCallback((id: string) => {
    flush()
    return enqueue(() => window.devforge.notes.read(projectId, id)).then(show, err => setReadError(errorText(err)))
  }, [enqueue, flush, projectId])

  // The first note opens; one changed by Forgy or the Modeling page (or on disk, seen when the list is read again) opens again,
  // unless something typed here is still waiting to be saved
  useEffect(() => {
    if (!list) return
    const to = target.current
    const busy = !!timer.current || pending.current > 0
    const shown = to && list.find(n => n.id === to.id)
    if (shown) {
      if (shown.updatedAt !== savedRef.current && !busy) void openNote(shown.id)
      return
    }
    // Being saved (maybe under a new name): the list will follow
    if (to && busy) return
    if (list.length) void openNote(list[0].id)
    else { target.current = null; draft.current = null; setNote(null); setOpenId(null) }
  }, [list, openNote])

  const create = () => {
    flush()
    void enqueue(() => window.devforge.notes.save(projectId, { title: k.untitled, pinned: false, body: '' })).then(saved => {
      show(saved)
      setLive<NoteSummary[]>(key, l => [...(l ?? []).filter(n => n.id !== saved.id), summary(saved)].sort(byOrder))
      // Named at once: its title is selected
      setTimeout(() => { titleRef.current?.focus(); titleRef.current?.select() }, 0)
    }, err => toast.show({ tone: 'error', title: k.createFailed, description: errorText(err) }))
  }

  const remove = async () => {
    const to = target.current
    if (!to) return
    const ok = await confirmDialog(k.removeConfirm.replace('{title}', title.trim() || k.untitled), { title: k.removeTitle, confirmLabel: k.removeAction, danger: true })
    if (!ok) return
    clearTimeout(timer.current)
    timer.current = undefined
    target.current = null
    draft.current = null
    try {
      await enqueue(() => window.devforge.notes.remove(projectId, to.id))
      setLive<NoteSummary[]>(key, l => (l ?? []).filter(n => n.id !== to.id))
      // The button that had the focus is gone with the note: back to "New note"
      newRef.current?.focus()
    } catch (err) {
      toast.show({ tone: 'error', title: k.removeFailed, description: errorText(err) })
      void openNote(to.id)
    }
  }

  const togglePin = () => {
    setPinned(!pinned)
    change({ pinned: !pinned }, 0)
  }

  if (!list) return error ? <ErrorState error={errorText(error)} onRetry={() => void reload()} /> : <LinesSkeleton lines={5} />

  const where = k.storedIn.split('{path}')
  const storedIn = (
    <p className="px-2.5 py-1.5 text-xs text-fg-muted">
      {where[0]}<span className="font-mono">.devforge/notes</span>{where[1]}
    </p>
  )

  if (!list.length && !note) {
    return (
      <div className="flex flex-col gap-1.5">
        <EmptyState icon={<NotebookPen />} title={k.empty} description={k.emptyHint}
          action={<Button size="sm" onClick={create}><Plus size={13} aria-hidden /> {k.newNote}</Button>} />
        {storedIn}
      </div>
    )
  }

  const status = state === 'saving' ? k.saving : state === 'failed' ? k.saveFailed : k.saved.replace('{when}', formatRelative(savedAt, lang))

  return (
    <div className="grid grid-cols-12 gap-4">
      <aside aria-label={k.list} className="col-span-12 flex min-w-0 flex-col gap-1.5 md:col-span-3">
        <Button ref={newRef} variant="secondary" size="sm" onClick={create}><Plus size={13} aria-hidden /> {k.newNote}</Button>
        <ul aria-label={k.list} className="flex flex-col gap-1.5">
          {list.map(n => {
            const on = n.id === openId
            const shownPinned = on ? pinned : n.pinned
            return (
              <li key={n.id}>
                {/* 9 px corners and 34 px rows: the mock-up's .sel */}
                <button type="button" aria-current={on || undefined} title={(on ? title : n.title).trim() || k.untitled} onClick={() => { if (!on) void openNote(n.id) }}
                  className={cn('flex h-8.5 w-full items-center gap-2.5 rounded-[9px] px-2.5 text-left transition-colors duration-150',
                    on ? 'bg-accent-soft font-semibold text-fg' : 'text-fg-secondary hover:bg-elevated hover:text-fg')}>
                  {shownPinned && <Pin size={13} className="shrink-0 text-accent" aria-hidden />}
                  <span className="min-w-0 flex-1 truncate">{(on ? title : n.title).trim() || k.untitled}</span>
                  {shownPinned && <span className="sr-only">{` ${k.pinned}`}</span>}
                </button>
              </li>
            )
          })}
        </ul>
        {storedIn}
      </aside>

      <div ref={cardRef} className="col-span-12 min-w-0 md:col-span-9">
      <Card className="flex flex-col p-4.5" data-testid="note">
        {readError ? <ErrorState error={readError} onRetry={() => { if (openId) void openNote(openId) }} />
          : !note ? <LinesSkeleton lines={6} plain className="p-4" />
          : (
            <RichNotes key={round} value={note.body} onChange={body => change({ body })}
              aside={<>
                <span role={state === 'failed' ? 'alert' : undefined} className={cn('text-xs', state === 'failed' ? 'text-danger' : 'text-fg-muted')}>{status}</span>
                <IconButton size="sm" title={k.pin} aria-pressed={pinned} active={pinned} onClick={togglePin}><Pin size={14} /></IconButton>
                <IconButton size="sm" tone="danger" title={k.remove} onClick={() => void remove()}><Trash2 size={14} /></IconButton>
              </>}
              header={
                <input ref={titleRef} value={title} aria-label={k.noteTitle} placeholder={k.untitled} maxLength={200}
                  onChange={e => { setTitle(e.target.value); change({ title: e.target.value }) }}
                  onKeyDown={e => {
                    // Enter goes on to the text
                    if (e.key === 'Enter') { e.preventDefault(); cardRef.current?.querySelector<HTMLElement>('[contenteditable]')?.focus() }
                  }}
                  className="mb-1.5 w-full bg-transparent font-display text-xl font-bold tracking-[-.01em] text-fg outline-none placeholder:text-fg-muted" />
              } />
          )}
      </Card>
      </div>
    </div>
  )
}
