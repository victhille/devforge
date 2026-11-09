import { useEffect, useState } from 'react'
import { FlaskConical, Pencil, Plus, Trash2 } from 'lucide-react'
import type { AppSettings, CustomIde } from '@shared/types'
import type { IdeInfo } from '@shared/data/ides'
import { useI18n } from '@renderer/i18n/I18nContext'
import { useToast } from '@renderer/app/ToastContext'
import Button from '@renderer/components/ui/Button'
import IconButton from '@renderer/components/ui/IconButton'
import { Field, Input } from '@renderer/components/ui/Input'
import { SettingRow } from './parts'
import { IDES, useIdes } from '@renderer/hooks/useLiveData'
import { setLive } from '@renderer/lib/live'

const NO_IDES: IdeInfo[] = []
import { errorText } from '@renderer/lib/errors'

const blank = (): CustomIde => ({ id: '', name: '', path: '', args: '{dir}' })

const SELECT = 'h-9 min-w-[220px] rounded-control border border-line bg-canvas px-3 text-base text-fg outline-none focus:border-accent/60'

/** The default IDE among those found on this PC, « Ajouter un IDE » beside it, and the IDEs added by hand under it */
export default function IdeSettings({ settings, update }: { settings: AppSettings; update: (patch: Partial<AppSettings>) => Promise<void> }) {
  const { t } = useI18n()
  const s = t.settings
  const toast = useToast()
  const list: IdeInfo[] = useIdes().data ?? NO_IDES
  const [draft, setDraft] = useState<CustomIde | null>(null)
  const custom = settings.customIdes ?? []
  /** Looks again on the disk (an IDE installed or added by hand): every page showing the IDEs gets the new list */
  const refresh = () => { window.devforge.listIdes(true).then(l => setLive<IdeInfo[]>(IDES, () => l)).catch(() => {}) }
  useEffect(() => { refresh() }, [])

  const found = list.filter(i => i.installed)
  const missing = list.filter(i => !i.installed && !i.custom)
  const set = (k: keyof CustomIde, v: string) => setDraft(d => (d ? { ...d, [k]: v } : d))
  const valid = !!draft?.name.trim() && /\.(exe|cmd|bat)$/i.test(draft.path.trim())

  async function browse() {
    const path = await window.devforge.selectProgram()
    if (path) setDraft(d => (d ? { ...d, path, name: d.name || (path.split(/[\\/]/).pop() ?? '').replace(/\.(exe|cmd|bat)$/i, '') } : d))
  }

  async function tryIt() {
    if (!draft) return
    try { await window.devforge.tryIde({ ...draft, path: draft.path.trim() }) } catch (err) { toast.show({ tone: 'error', title: s.ideTryFailed, description: errorText(err) }) }
  }

  async function save() {
    if (!draft || !valid) return
    const ide = { ...draft, name: draft.name.trim(), path: draft.path.trim(), id: draft.id || `custom-${crypto.randomUUID().slice(0, 8)}` }
    await update({ customIdes: draft.id ? custom.map(c => (c.id === draft.id ? ide : c)) : [...custom, ide] })
    setDraft(null)
    refresh()
  }

  async function remove(c: CustomIde) {
    await update({ customIdes: custom.filter(x => x.id !== c.id), ...(settings.defaultIDE === c.id ? { defaultIDE: 'vscode' } : {}) })
    refresh()
  }

  return (
    <>
      <SettingRow label={s.defaultIDE} hint={s.defaultIDEHint}>
        <div className="flex flex-wrap items-center gap-2">
          <label>
            <span className="sr-only">{s.defaultIDE}</span>
            <select value={settings.defaultIDE} onChange={e => update({ defaultIDE: e.target.value })} className={SELECT}>
              {found.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
              {/* The saved choice, even when not found any more */}
              {!found.some(i => i.id === settings.defaultIDE) && settings.defaultIDE !== 'none' && (
                <option value={settings.defaultIDE}>{list.find(i => i.id === settings.defaultIDE)?.name ?? settings.defaultIDE} ({s.ideMissing})</option>
              )}
              <option value="none">{s.ideNone}</option>
              {missing.length > 0 && (
                <optgroup label={s.ideNotFound}>
                  {missing.filter(i => i.id !== settings.defaultIDE).map(i => <option key={i.id} value={i.id} disabled>{i.name}</option>)}
                </optgroup>
              )}
            </select>
          </label>
          {!draft && <Button size="sm" variant="secondary" onClick={() => setDraft(blank())}><Plus size={13} /> {s.ideAdd}</Button>}
        </div>
        {/* The IDEs added by hand, and the one being added, under the choice */}
        {(custom.length > 0 || draft) && (
          <div className="flex w-full flex-col gap-2">
            <p className="text-sm text-fg-secondary">{s.customIdesHint}</p>
            {custom.map(c => (
              <div key={c.id} className="flex items-center gap-2 rounded-control border border-line bg-canvas px-3 py-2">
                <div className="min-w-0 flex-1">
                  <div className="text-base font-medium text-fg">{c.name}</div>
                  <div className="truncate font-mono text-xs text-fg-muted" title={c.path}>{c.path} {c.args}</div>
                </div>
                {!list.find(i => i.id === c.id)?.installed && list.length > 0 && <span className="text-xs text-warning">{s.ideMissing}</span>}
                <IconButton size="sm" title={s.ideEdit} onClick={() => setDraft(c)}><Pencil size={13} /></IconButton>
                <IconButton size="sm" tone="danger" title={s.ideRemove} onClick={() => remove(c)}><Trash2 size={13} /></IconButton>
              </div>
            ))}
            {draft ? (
              <div className="flex flex-col gap-3 rounded-control border border-accent/40 bg-canvas p-3">
                <Field label={s.ideName}><Input value={draft.name} onChange={e => set('name', e.target.value)} placeholder="Antigravity" /></Field>
                <Field label={s.ideProgram}>
                  <div className="flex gap-2">
                    <Input value={draft.path} onChange={e => set('path', e.target.value)} placeholder="C:\Users\…\Antigravity.exe" spellCheck={false} className="font-mono text-sm" />
                    <Button variant="secondary" onClick={browse}>{s.browse}</Button>
                  </div>
                </Field>
                <Field label={s.ideArgs} hint={s.ideArgsHint}>
                  <Input value={draft.args} onChange={e => set('args', e.target.value)} spellCheck={false} className="font-mono text-sm" />
                </Field>
                <div className="flex flex-wrap gap-2">
                  <Button onClick={save} disabled={!valid}>{s.ideSave}</Button>
                  <Button variant="secondary" onClick={tryIt} disabled={!valid}><FlaskConical size={13} /> {s.ideTry}</Button>
                  <Button variant="ghost" onClick={() => setDraft(null)}>{t.common.cancel}</Button>
                </div>
              </div>
            ) : null}
          </div>
        )}
      </SettingRow>
    </>
  )
}
