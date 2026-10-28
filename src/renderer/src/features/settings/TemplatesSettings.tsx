import { useEffect, useState } from 'react'
import { Pencil, RefreshCw, Trash2 } from 'lucide-react'
import type { UserTemplate } from '@shared/types'
import { useI18n } from '@renderer/i18n/I18nContext'
import { useToast } from '@renderer/app/ToastContext'
import { formatSize } from '@renderer/lib/format'
import Button from '@renderer/components/ui/Button'
import IconButton from '@renderer/components/ui/IconButton'
import { Input } from '@renderer/components/ui/Input'
import ProjectIcon from '@renderer/features/projects/components/ProjectIcon'
import { SettingsCard } from './parts'

const errorText = (err: unknown) => String(err instanceof Error ? err.message : err).replace(/^Error invoking remote method '[^']+': (Error: )?/, '')

/** v3.8 lot 5: Settings › Templates: rename, update from the project, delete */
export default function TemplatesSettings() {
  const { t, lang } = useI18n()
  const m = t.templates
  const toast = useToast()
  const [list, setList] = useState<UserTemplate[] | null>(null)
  const [editing, setEditing] = useState<{ id: string; name: string; description: string } | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  const load = () => window.devforge.templates.list().then(setList).catch(() => setList([]))
  useEffect(() => { load() }, [])

  async function refresh(tpl: UserTemplate) {
    setBusy(tpl.id)
    try {
      await window.devforge.templates.refresh(tpl.id)
      toast.show({ tone: 'success', title: m.refreshed, description: tpl.name })
      load()
    } catch (err) {
      const e = errorText(err)
      toast.show({ tone: 'error', title: m.saveFailed, description: e === 'SOURCE_GONE' ? m.sourceGone : e === 'TOO_BIG' ? m.tooBig : e })
    } finally { setBusy(null) }
  }

  async function rename() {
    if (!editing) return
    await window.devforge.templates.rename(editing.id, editing.name, editing.description)
    setEditing(null)
    load()
  }

  async function remove(tpl: UserTemplate) {
    if (!window.confirm(m.removeConfirm.replace('{name}', tpl.name))) return
    await window.devforge.templates.remove(tpl.id)
    load()
  }

  return (
    <SettingsCard title={t.settings.nav.templates} hint={m.settingsHint}>
      {list && list.length === 0 && <p className="border-t border-line-subtle px-5 py-4 text-sm text-fg-muted">{m.none}</p>}
      <ul aria-label={t.settings.nav.templates}>
        {list?.map(tpl => (
          <li key={tpl.id} className="flex flex-wrap items-center gap-3 border-t border-line-subtle px-5 py-3.5">
            <ProjectIcon framework={tpl.framework} />
            {editing?.id === tpl.id ? (
              <form className="flex min-w-0 flex-1 flex-wrap items-center gap-2" onSubmit={e => { e.preventDefault(); rename() }}>
                <Input aria-label={m.name} value={editing.name} onChange={e => setEditing({ ...editing, name: e.target.value })} maxLength={80} className="max-w-[220px]" autoFocus />
                <Input aria-label={m.description} value={editing.description} onChange={e => setEditing({ ...editing, description: e.target.value })} maxLength={300} className="min-w-[200px] flex-1" />
                <Button size="sm" type="submit" disabled={!editing.name.trim()}>{m.saveEdit}</Button>
                <Button size="sm" variant="ghost" type="button" onClick={() => setEditing(null)}>{t.common.cancel}</Button>
              </form>
            ) : (
              <>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13.5px] font-medium text-fg">{tpl.name}</div>
                  {tpl.description && <div className="truncate text-[12.5px] text-fg-secondary">{tpl.description}</div>}
                  <div className="truncate font-mono text-[11px] text-fg-muted" title={tpl.sourcePath}>
                    {m.files.replace('{n}', String(tpl.files))} · {formatSize(tpl.bytes)} · {m.updated.replace('{date}', new Date(tpl.updatedAt).toLocaleDateString(lang))} · {m.from.replace('{path}', tpl.sourcePath)}
                  </div>
                </div>
                <Button size="sm" variant="secondary" loading={busy === tpl.id} title={m.refreshHint} onClick={() => refresh(tpl)}>{busy !== tpl.id && <RefreshCw size={13} />} {m.refresh}</Button>
                <IconButton title={m.rename} onClick={() => setEditing({ id: tpl.id, name: tpl.name, description: tpl.description })}><Pencil size={14} /></IconButton>
                <IconButton title={m.remove} tone="danger" onClick={() => remove(tpl)}><Trash2 size={14} /></IconButton>
              </>
            )}
          </li>
        ))}
      </ul>
    </SettingsCard>
  )
}
