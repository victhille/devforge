import { useEffect, useRef, useState, type DragEvent } from 'react'
import { Check, GripVertical, Plus, Trash2 } from 'lucide-react'
import type { NoteTask, ProjectNotes } from '@shared/types'
import { useI18n } from '@renderer/i18n/I18nContext'
import { cn } from '@renderer/lib/cn'
import Card from '@renderer/components/ui/Card'
import IconButton from '@renderer/components/ui/IconButton'
import Spinner from '@renderer/components/ui/Spinner'
import Markdown from '@renderer/features/assistant/Markdown'

/** The notes are saved this long after the last key */
const SAVE_DELAY = 600

/**
 * v3.8 lot 1 (piste A): a project's tasks and notes side by side. Kept in
 * DevForge's data, saved as they change; the open tasks show on the card.
 */
export default function NotesPanel({ projectId, onCount }: { projectId: string; onCount?: (open: number) => void }) {
  const { t } = useI18n()
  const k = t.notes
  const [data, setData] = useState<ProjectNotes | null>(null)
  const [draft, setDraft] = useState('')
  const [hideDone, setHideDone] = useState(false)
  const [editing, setEditing] = useState<string | null>(null)
  const [preview, setPreview] = useState(true)
  const [dragged, setDragged] = useState<string | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout>>()
  const latest = useRef<ProjectNotes | null>(null)

  useEffect(() => {
    let alive = true
    window.devforge.notes.get(projectId).then(n => { if (alive) { setData(n); latest.current = n; setPreview(!!n.notes.trim()) } }).catch(() => {})
    return () => { alive = false }
  }, [projectId])

  // Leaving the tab keeps what was typed
  useEffect(() => () => { if (timer.current) { clearTimeout(timer.current); if (latest.current) void window.devforge.notes.save(projectId, latest.current) } }, [projectId])

  function change(next: ProjectNotes, delay = 0) {
    setData(next)
    latest.current = next
    onCount?.(next.tasks.filter(x => !x.done).length)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => { timer.current = undefined; void window.devforge.notes.save(projectId, next) }, delay)
  }

  if (!data) return <Spinner />

  const setTasks = (tasks: NoteTask[]) => change({ ...data, tasks })
  const add = () => {
    const text = draft.trim()
    if (!text) return
    setTasks([...data.tasks, { id: crypto.randomUUID(), text, done: false, createdAt: new Date().toISOString() }])
    setDraft('')
  }
  const toggle = (id: string) => setTasks(data.tasks.map(x => (x.id === id ? { ...x, done: !x.done, doneAt: !x.done ? new Date().toISOString() : undefined } : x)))
  const rename = (id: string, text: string) => { if (text.trim()) setTasks(data.tasks.map(x => (x.id === id ? { ...x, text: text.trim() } : x))); setEditing(null) }
  const drop = (target: string) => {
    if (!dragged || dragged === target) return
    const list = [...data.tasks]
    const from = list.findIndex(x => x.id === dragged)
    const [moved] = list.splice(from, 1)
    list.splice(list.findIndex(x => x.id === target), 0, moved)
    setTasks(list)
    setDragged(null)
  }
  const open = data.tasks.filter(x => !x.done).length
  const shown = hideDone ? data.tasks.filter(x => !x.done) : data.tasks

  return (
    <div className="flex flex-wrap items-start gap-4">
      <Card className="min-w-[300px] flex-[1_1_380px] overflow-hidden" data-testid="tasks">
        <div className="flex items-center gap-2 border-b border-line-subtle px-4 py-3">
          <h2 className="text-md font-semibold text-fg">{k.tasks}</h2>
          <span className="text-xs text-fg-muted">{k.open.replace('{n}', String(open))}</span>
          <button aria-pressed={hideDone} onClick={() => setHideDone(v => !v)}
            className={cn('ml-auto h-7 rounded-full border px-3 text-xs', hideDone ? 'border-accent/40 bg-active text-fg' : 'border-line text-fg-secondary hover:text-fg')}>{k.hideDone}</button>
        </div>
        <ul>
          {shown.map(task => (
            <li key={task.id} draggable={editing !== task.id}
              onDragStart={() => setDragged(task.id)} onDragOver={(e: DragEvent) => e.preventDefault()} onDrop={() => drop(task.id)}
              className={cn('group flex items-center gap-2.5 border-b border-line-subtle px-4 py-2 text-sm', dragged === task.id && 'opacity-50')}>
              <button role="checkbox" aria-checked={task.done} aria-label={task.text} onClick={() => toggle(task.id)}
                className={cn('flex size-4 shrink-0 items-center justify-center rounded border', task.done ? 'border-success bg-success text-white' : 'border-line bg-elevated hover:border-accent')}>
                {task.done && <Check size={11} strokeWidth={3} />}
              </button>
              {editing === task.id
                ? <input autoFocus defaultValue={task.text} aria-label={k.editTask}
                    onKeyDown={e => { if (e.key === 'Enter') rename(task.id, e.currentTarget.value); if (e.key === 'Escape') setEditing(null) }}
                    onBlur={e => rename(task.id, e.currentTarget.value)}
                    className="min-w-0 flex-1 rounded border border-accent bg-canvas px-1.5 py-0.5 text-sm text-fg outline-none" />
                : <span onDoubleClick={() => setEditing(task.id)} className={cn('min-w-0 flex-1 break-words', task.done ? 'text-fg-muted line-through' : 'text-fg')}>{task.text}</span>}
              {task.done && task.doneAt && <span className="shrink-0 text-2xs text-fg-muted">{k.doneOn.replace('{date}', new Date(task.doneAt).toLocaleDateString())}</span>}
              <IconButton size="sm" tone="danger" title={k.remove} onClick={() => setTasks(data.tasks.filter(x => x.id !== task.id))} className="opacity-0 group-hover:opacity-100 focus:opacity-100"><Trash2 size={12} /></IconButton>
              <GripVertical size={13} className="shrink-0 cursor-grab text-fg-muted" aria-hidden />
            </li>
          ))}
        </ul>
        <div className="flex items-center gap-2 px-4 py-2">
          <Plus size={14} className="shrink-0 text-fg-muted" aria-hidden />
          <input value={draft} onChange={e => setDraft(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') add() }}
            placeholder={k.addPlaceholder} aria-label={k.addPlaceholder}
            className="min-w-0 flex-1 bg-transparent py-1 text-sm text-fg outline-none placeholder:text-fg-muted" />
        </div>
      </Card>

      <Card className="min-w-[320px] flex-[1.2_1_460px] overflow-hidden" data-testid="notes">
        <div className="flex items-center gap-2 border-b border-line-subtle px-4 py-3">
          <h2 className="text-md font-semibold text-fg">{k.notes}</h2>
          <span role="group" aria-label={k.view} className="ml-auto flex rounded-full border border-line p-0.5 text-xs">
            {[false, true].map(v => (
              <button key={String(v)} aria-pressed={preview === v} onClick={() => setPreview(v)}
                className={cn('rounded-full px-3 py-1', preview === v ? 'bg-active text-fg' : 'text-fg-secondary hover:text-fg')}>{v ? k.preview : k.edit}</button>
            ))}
          </span>
        </div>
        {preview
          ? <div className="min-h-[220px] px-5 py-4">{data.notes.trim() ? <Markdown text={data.notes} asDocument /> : <p className="text-sm text-fg-muted">{k.empty}</p>}</div>
          : <textarea value={data.notes} onChange={e => change({ ...data, notes: e.target.value }, SAVE_DELAY)} aria-label={k.notes} placeholder={k.notesPlaceholder} spellCheck
              className="block min-h-[320px] w-full resize-y bg-canvas px-5 py-4 font-mono text-[12.5px] leading-relaxed text-fg outline-none placeholder:text-fg-muted" />}
      </Card>
    </div>
  )
}
