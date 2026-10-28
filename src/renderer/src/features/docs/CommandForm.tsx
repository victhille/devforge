import { useEffect, useId, useMemo, useState, type KeyboardEvent } from 'react'
import { CircleCheck, Save, TriangleAlert } from 'lucide-react'
import type { CommandCheck, CustomCommand } from '@shared/types'
import { completeCommand } from '@shared/lib/commandComplete'
import { useI18n } from '@renderer/i18n/I18nContext'
import { cn } from '@renderer/lib/cn'
import Button from '@renderer/components/ui/Button'
import Modal from '@renderer/components/ui/Modal'
import { Field, Input, Select } from '@renderer/components/ui/Input'

const NEW = '__new__'

/**
 * v3.5 lot 5: adding or changing a command of the Docs page. The command is
 * completed as it is typed (PATH programs, known sub-commands, the page's own
 * commands) and checked on this PC; a command not found can still be saved.
 */
export default function CommandForm({ initial, categories, commands, defaultCategory, onSave, onClose }: {
  initial?: CustomCommand
  /** The page's references and the categories already made */
  categories: string[]
  /** Every command of the page, for completion */
  commands: string[]
  defaultCategory: string
  onSave: (c: Partial<CustomCommand>) => Promise<void>
  onClose: () => void
}) {
  const { t } = useI18n()
  const d = t.docsCustom
  const listId = useId()
  const [cmd, setCmd] = useState(initial?.cmd ?? '')
  const [desc, setDesc] = useState(initial?.desc ?? '')
  const [category, setCategory] = useState(initial?.category ?? defaultCategory)
  const [newCategory, setNewCategory] = useState('')
  const [programs, setPrograms] = useState<string[]>([])
  const [check, setCheck] = useState<CommandCheck | null>(null)
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  const [busy, setBusy] = useState(false)

  useEffect(() => { window.devforge.docs.programs().then(setPrograms).catch(() => {}) }, [])

  // The program is looked for once typing pauses
  const program = cmd.trim().split(/\s+/)[0] ?? ''
  useEffect(() => {
    if (!program) { setCheck(null); return }
    const id = setTimeout(() => { window.devforge.docs.check(program).then(setCheck).catch(() => setCheck(null)) }, 300)
    return () => clearTimeout(id)
  }, [program])

  const suggestions = useMemo(() => completeCommand(cmd, { programs, commands }), [cmd, programs, commands])
  const shown = open && suggestions.length > 0

  function accept(s: string) {
    // A program or a tool: a space, ready for what follows
    setCmd(/\s/.test(s) ? s : `${s} `)
    setActive(-1)
  }

  function onKey(e: KeyboardEvent<HTMLInputElement>) {
    if (!shown) return
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive(i => (i + 1) % suggestions.length) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(i => (i <= 0 ? suggestions.length - 1 : i - 1)) }
    else if ((e.key === 'Enter' && active >= 0) || (e.key === 'Tab' && !e.shiftKey)) { e.preventDefault(); accept(suggestions[Math.max(active, 0)]) }
    else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); setOpen(false) }
  }

  const finalCategory = category === NEW ? newCategory.trim() : category
  const valid = !!cmd.trim() && !!finalCategory

  async function save() {
    if (!valid) return
    setBusy(true)
    try { await onSave({ id: initial?.id, cmd: cmd.trim(), desc: desc.trim(), category: finalCategory }) } finally { setBusy(false) }
  }

  return (
    <Modal title={initial ? d.editTitle : d.addTitle} onClose={onClose}
      footer={<><Button variant="ghost" onClick={onClose}>{t.common.cancel}</Button><Button onClick={save} disabled={!valid} loading={busy}><Save size={13} /> {t.common.save}</Button></>}>
      <div className="flex flex-col gap-4">
        <Field label={d.cmd}>
          <div className="relative">
            <Input value={cmd} autoFocus spellCheck={false} className="font-mono"
              role="combobox" aria-expanded={shown} aria-controls={listId} aria-autocomplete="list"
              aria-activedescendant={shown && active >= 0 ? `${listId}-${active}` : undefined}
              placeholder="git log --oneline --graph"
              onChange={e => { setCmd(e.target.value); setOpen(true); setActive(-1) }}
              onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 120)} onKeyDown={onKey} />
            {shown && (
              <ul id={listId} role="listbox" aria-label={d.suggestions}
                className="absolute top-full right-0 left-0 z-10 mt-1 max-h-60 overflow-y-auto rounded-lg border border-line bg-elevated p-1 shadow-pop">
                {suggestions.map((s, i) => (
                  <li key={s} id={`${listId}-${i}`} role="option" aria-selected={i === active}
                    onMouseDown={e => { e.preventDefault(); accept(s) }}
                    className={cn('cursor-pointer rounded-md px-2.5 py-1.5 font-mono text-[13px] text-fg', i === active ? 'bg-accent-soft' : 'hover:bg-hover')}>
                    {s}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Field>
        {check && (
          <p role="status" className={cn('-mt-2 flex items-start gap-1.5 text-xs', check.found ? 'text-success' : 'text-warning')}>
            {check.found ? <CircleCheck size={13} className="mt-px shrink-0" /> : <TriangleAlert size={13} className="mt-px shrink-0" />}
            <span className="break-all">{check.found ? d.found.replace('{path}', check.path ?? '') : d.notFound.replace('{program}', check.program)}</span>
          </p>
        )}
        <Field label={d.desc}>
          <Input value={desc} onChange={e => setDesc(e.target.value)} placeholder={d.descHint} />
        </Field>
        <Field label={d.category}>
          <Select value={category} onChange={e => setCategory(e.target.value)}>
            {categories.map(c => <option key={c} value={c}>{c}</option>)}
            <option value={NEW}>{d.newCategory}</option>
          </Select>
        </Field>
        {category === NEW && (
          <Field label={d.newCategoryName}>
            <Input value={newCategory} onChange={e => setNewCategory(e.target.value)} placeholder="Laravel, VPS, Mes scripts…" />
          </Field>
        )}
      </div>
    </Modal>
  )
}
