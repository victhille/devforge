import { useRef, useState, type ReactNode } from 'react'
import { Check, Eye, EyeOff, Pencil, RefreshCw, Trash2, X } from 'lucide-react'
import type { EnvProject } from '@shared/types'
import { useI18n } from '@renderer/i18n/I18nContext'
import Badge from '@renderer/components/ui/Badge'
import CopyButton from '@renderer/components/ui/CopyButton'
import IconButton from '@renderer/components/ui/IconButton'
import { Input } from '@renderer/components/ui/Input'
import { isExample, isPlainValue, isRegenerable } from '@shared/lib/envKeys'

interface Props {
  env: EnvProject
  /** The file on show (one tab per file) */
  file: string
  onChange: (fileName: string, key: string, value: string | null) => Promise<void>
  /** Draw a new random value for a secret key */
  onRegenerate?: (fileName: string, key: string) => void
  /** The row that adds a key, first under the header */
  addRow?: ReactNode
}

/**
 * As in the mock-up: one file's keys, their value (secrets masked, an eye
 * shows one), whether the template has them, and the actions of each.
 * A value is changed in place (the pencil, or a double click).
 */
export default function EnvFileTable({ env, file, onChange, onRegenerate, addRow }: Props) {
  const { t } = useI18n()
  const e = t.envFiles
  const [shown, setShown] = useState<Set<string>>(new Set())
  const [editing, setEditing] = useState<{ key: string; value: string } | null>(null)
  const box = useRef<HTMLDivElement>(null)

  /** Out of the field (saved or not): the keyboard goes on from the row's pencil */
  function stopEditing(key: string) {
    setEditing(null)
    requestAnimationFrame(() => box.current?.querySelector<HTMLElement>(`[data-edit="${CSS.escape(key)}"]`)?.focus())
  }

  const current = env.files.find(f => f.name === file)
  const example = env.files.find(f => isExample(f.name))
  const withTemplate = !!example && !isExample(file)
  const keys = Object.keys(current?.values ?? {})

  async function commit() {
    if (!editing) return
    await onChange(file, editing.key, editing.value)
    stopEditing(editing.key)
  }
  const toggle = (key: string) => setShown(prev => { const next = new Set(prev); if (next.has(key)) next.delete(key); else next.add(key); return next })

  return (
    <div ref={box} className="df-rise overflow-x-auto rounded-card border border-line-subtle bg-surface">
      {/* Fixed widths: the value takes what the key, the template and the actions leave */}
      <table className="w-full min-w-[640px] table-fixed border-collapse text-sm">
        <caption className="sr-only">{e.keysOf.replace('{file}', file)}</caption>
        <colgroup>
          <col className="w-[28%]" />
          <col />
          {withTemplate && <col className="w-[124px]" />}
          <col className="w-[160px]" />
        </colgroup>
        <thead>
          <tr className="border-b border-line-subtle">
            <th scope="col" className="h-10 px-4 text-left text-xs font-semibold text-fg-muted">{e.key}</th>
            <th scope="col" className="h-10 px-4 text-left text-xs font-semibold text-fg-muted">{e.value}</th>
            {withTemplate && <th scope="col" className="h-10 w-px px-4 text-left text-xs font-semibold whitespace-nowrap text-fg-muted">{e.inTemplate.replace('{file}', example!.name)}</th>}
            <th scope="col" className="h-10 w-px px-4 text-right text-xs font-semibold text-fg-muted">{e.actions}</th>
          </tr>
        </thead>
        <tbody>
          {addRow}
          {keys.map(key => {
            const value = current!.values[key]
            const plain = isPlainValue(key, value)
            const visible = plain || shown.has(key)
            const isEditing = editing?.key === key
            return (
              <tr key={key} className="group border-b border-line-subtle last:border-0 hover:bg-elevated">
                <td className="truncate px-4 py-2.5 font-mono font-bold text-fg" title={key}>{key}</td>
                <td className="px-4 py-2" onDoubleClick={() => setEditing({ key, value })}>
                  {isEditing ? (
                    <div className="flex items-center gap-1">
                      <Input autoFocus aria-label={e.valueOf.replace('{key}', key)} value={editing.value}
                        onChange={ev => setEditing({ key, value: ev.target.value })}
                        onKeyDown={ev => { if (ev.key === 'Enter') commit(); if (ev.key === 'Escape') stopEditing(key) }}
                        className="h-8 font-mono text-sm" />
                      <IconButton size="sm" title={t.common.save} onClick={commit}><Check size={13} /></IconButton>
                      <IconButton size="sm" title={t.common.cancel} onClick={() => stopEditing(key)}><X size={13} /></IconButton>
                    </div>
                  ) : !value ? (
                    <span className="text-fg-muted italic">{e.empty}</span>
                  ) : visible ? (
                    <span className="block truncate font-mono text-fg-secondary" title={value}>{value}</span>
                  ) : (
                    <>
                      <span aria-hidden className="block truncate font-mono tracking-[.2em] text-fg-muted">{'•'.repeat(Math.min(Math.max(value.length, 8), 20))}</span>
                      <span className="sr-only">{e.masked}</span>
                    </>
                  )}
                </td>
                {withTemplate && (
                  <td className="w-px px-4 py-2 whitespace-nowrap">
                    {key in example!.values ? <Badge color="success">{e.yes}</Badge> : <Badge>{e.no}</Badge>}
                  </td>
                )}
                <td className="w-px px-4 py-2 whitespace-nowrap">
                  <span className="flex items-center justify-end gap-0.5">
                    {/* Less used: shown on hover or with the keyboard */}
                    <span className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100">
                      <IconButton size="sm" data-edit={key} title={e.editKey.replace('{key}', key)} onClick={() => setEditing({ key, value })}><Pencil size={13} /></IconButton>
                      <IconButton size="sm" tone="danger" title={e.deleteKey.replace('{key}', key)} onClick={() => onChange(file, key, null)}><Trash2 size={13} /></IconButton>
                    </span>
                    {onRegenerate && !isExample(file) && isRegenerable(key) && (
                      <IconButton size="sm" title={e.regenerateKey.replace('{key}', key)} onClick={() => onRegenerate(file, key)}><RefreshCw size={13} /></IconButton>
                    )}
                    {/* The eye and the copy keep their place on every row: the columns of icons line up */}
                    {value && !plain
                      ? (
                        <IconButton size="sm" title={(shown.has(key) ? e.hideValue : e.showValue).replace('{key}', key)} onClick={() => toggle(key)}>
                          {shown.has(key) ? <EyeOff size={13} /> : <Eye size={13} />}
                        </IconButton>
                      )
                      : <span aria-hidden className="size-7 shrink-0" />}
                    {value ? <CopyButton text={value} title={e.copyValue.replace('{key}', key)} /> : <span aria-hidden className="size-7 shrink-0" />}
                  </span>
                </td>
              </tr>
            )
          })}
          {keys.length === 0 && !addRow && (
            <tr><td colSpan={withTemplate ? 4 : 3} className="px-4 py-6 text-center text-sm text-fg-muted">{e.noKeys}</td></tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
