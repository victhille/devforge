import { useCallback, useEffect, useState } from 'react'
import { AlertTriangle, FileKey2, History, Plus, ShieldCheck } from 'lucide-react'
import type { EnvBackupInfo, EnvProject } from '@shared/types'
import { useI18n } from '@renderer/i18n/I18nContext'
import { useToast } from '@renderer/app/ToastContext'
import { formatRelative } from '@renderer/lib/format'
import Button from '@renderer/components/ui/Button'
import EmptyState from '@renderer/components/ui/EmptyState'
import { Input } from '@renderer/components/ui/Input'
import MoreMenu from '@renderer/components/ui/MoreMenu'
import Tabs from '@renderer/components/ui/Tabs'
import EnvFileTable from './EnvFileTable'
import { isExample, isKeyName, missingInEnv } from '@shared/lib/envKeys'
import { confirmDialog } from '@renderer/app/ConfirmContext'
import { generateSecret, laravelAppKey } from '@renderer/features/tools/generator/random'


/**
 * The .env files of one project, as in the mock-up: a tab per file, its keys
 * in a table, the template's missing keys said above, a key added in place,
 * the encrypted backup in the menu. Used by the Env variables page and the project page.
 */
export default function ProjectEnvEditor({ projectPath, title, onEnvChange }: {
  projectPath: string
  /** Heading above the editor (the project name), none when the page has one */
  title?: string
  onEnvChange?: (env: EnvProject) => void
}) {
  const { t, lang } = useI18n()
  const e = t.envFiles
  const toast = useToast()
  const [env, setEnv] = useState<EnvProject | null>(null)
  const [backup, setBackup] = useState<EnvBackupInfo | null>(null)
  const [file, setFile] = useState('.env')
  const [adding, setAdding] = useState(false)
  const [newKey, setNewKey] = useState({ key: '', value: '' })

  const reload = useCallback(async () => {
    const next = await window.devforge.env.read(projectPath).catch(() => ({ projectPath, files: [] }))
    setEnv(next)
    onEnvChange?.(next)
    // The file on show stays, unless it is gone: then .env, or the first one
    setFile(f => (next.files.some(x => x.name === f) ? f : next.files.find(x => x.name === '.env')?.name ?? next.files[0]?.name ?? '.env'))
  }, [projectPath, onEnvChange])

  useEffect(() => {
    setEnv(null)
    reload()
    window.devforge.env.backupInfo(projectPath).then(setBackup).catch(() => setBackup(null))
  // onEnvChange may be a new function each render: load once per project
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectPath])

  if (!env) return null
  const missing = missingInEnv(env)
  const example = env.files.find(f => isExample(f.name))

  async function change(fileName: string, key: string, value: string | null) {
    try {
      await window.devforge.env.write(projectPath, fileName, { [key]: value })
      await reload()
    } catch (err) {
      toast.show({ tone: 'error', title: e.saveFailed, description: String(err) })
    }
  }

  async function fillFromExample() {
    await window.devforge.env.write(projectPath, '.env', Object.fromEntries(missing.map(k => [k, example!.values[k]])))
    await reload()
    setFile('.env')
    toast.show({ tone: 'success', title: e.filled.replace('{n}', String(missing.length)) })
  }

  /** A new random secret: Laravel's APP_KEY keeps its "base64:" form */
  async function regenerate(fileName: string, key: string) {
    if (!(await confirmDialog(e.regenerateConfirm.replace('{key}', key).replace('{file}', fileName), { danger: true }))) return
    const value = key === 'APP_KEY' ? laravelAppKey() : generateSecret(32, 'hex')
    try {
      // The old value stays in the encrypted backup: Restore brings it back
      setBackup(await window.devforge.env.backup(projectPath))
      await window.devforge.env.write(projectPath, fileName, { [key]: value })
      await reload()
      toast.show({ tone: 'success', title: e.regenerated.replace('{key}', key).replace('{file}', fileName) })
    } catch (err) {
      toast.show({ tone: 'error', title: e.saveFailed, description: String(err) })
    }
  }

  async function addKey() {
    if (!isKeyName(newKey.key.trim())) return
    try {
      await window.devforge.env.write(projectPath, file, { [newKey.key.trim()]: newKey.value })
      await reload()
      // Emptied only once written: a refused value (maybe a pasted secret) stays in the field
      setNewKey({ key: '', value: '' })
    } catch (err) {
      toast.show({ tone: 'error', title: e.saveFailed, description: String(err) })
    }
  }

  async function doBackup() {
    try {
      setBackup(await window.devforge.env.backup(projectPath))
      toast.show({ tone: 'success', title: e.backupDone })
    } catch (err) {
      toast.show({ tone: 'error', title: e.backupFailed, description: String(err) })
    }
  }

  async function doRestore() {
    if (!(await confirmDialog(e.restoreConfirm, { danger: true }))) return
    const files = await window.devforge.env.restore(projectPath)
    await reload()
    toast.show({ tone: 'success', title: e.restored.replace('{files}', files.join(', ')) })
  }

  if (env.files.length === 0) return <EmptyState icon={<FileKey2 size={32} />} title={e.emptyTitle} description={e.emptyHint} />

  const addRow = adding && (
    <tr className="border-b border-line-subtle bg-accent-soft/40">
      <td className="px-4 py-2">
        <Input autoFocus placeholder="NEW_KEY" aria-label={e.newKeyLabel} value={newKey.key}
          onChange={ev => setNewKey(k => ({ ...k, key: ev.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, '_') }))}
          onKeyDown={ev => { if (ev.key === 'Enter') addKey(); if (ev.key === 'Escape') setAdding(false) }}
          className="h-8 w-56 font-mono text-sm" />
      </td>
      <td className="px-4 py-2" colSpan={example && !isExample(file) ? 2 : 1}>
        <Input placeholder={e.value} aria-label={e.value} value={newKey.value} className="h-8 font-mono text-sm"
          onChange={ev => setNewKey(k => ({ ...k, value: ev.target.value }))}
          onKeyDown={ev => { if (ev.key === 'Enter') addKey(); if (ev.key === 'Escape') setAdding(false) }} />
      </td>
      <td className="px-4 py-2">
        <span className="flex items-center justify-end gap-1.5">
          <Button size="sm" variant="ghost" onClick={() => setAdding(false)}>{t.common.cancel}</Button>
          <Button size="sm" onClick={addKey} disabled={!isKeyName(newKey.key.trim())}><Plus size={13} aria-hidden /> {e.add}</Button>
        </span>
      </td>
    </tr>
  )

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          {title && <p className="mb-1 text-sm text-fg-muted">{t.nav.groupSystem} / {t.nav.envFiles}</p>}
          {title && <h1 className="truncate font-display text-page font-bold tracking-[-.025em] text-fg" title={projectPath}>{title}</h1>}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button onClick={() => setAdding(true)} disabled={adding}><Plus size={14} aria-hidden /> {e.addKey}</Button>
          <MoreMenu label={e.more} items={[
            { label: e.backup, icon: ShieldCheck, onSelect: doBackup },
            ...(backup?.savedAt ? [{ label: e.restore, icon: History, onSelect: doRestore }] : [])
          ]} />
        </div>
      </header>

      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2 border-b border-line-subtle">
        <Tabs<string> variant="underline" value={file} onChange={f => { setFile(f); setAdding(false) }} label={e.files}
          items={env.files.map(f => ({
            value: f.name,
            label: <span className="flex items-center gap-2 font-mono">{f.name}<span className="rounded-md bg-active px-1.5 font-sans text-2xs text-fg-secondary tabular-nums">{Object.keys(f.values).length}</span></span>
          }))} className="-mb-px border-b-0" />
        {backup?.savedAt && <p className="pb-2.5 text-xs text-fg-muted">{e.lastBackup.replace('{when}', formatRelative(backup.savedAt, lang))}</p>}
      </div>

      {missing.length > 0 && (
        <div role="status" className="flex flex-wrap items-center gap-3 rounded-card border border-warning/30 bg-warning-soft px-4 py-3 text-sm text-fg">
          <AlertTriangle size={15} aria-hidden className="shrink-0 text-warning" />
          <p className="min-w-0 flex-1">
            {missing.length === 1
              ? <><span className="font-mono">{missing[0]}</span> {e.missingOne.replace('{example}', example!.name)}</>
              : <>{e.missingMany.replace('{n}', String(missing.length)).replace('{example}', example!.name)} <span className="font-mono text-fg-secondary">{missing.slice(0, 6).join(', ')}{missing.length > 6 ? '…' : ''}</span></>}
          </p>
          <Button size="sm" variant="secondary" onClick={fillFromExample}>{missing.length === 1 ? e.addOne : e.addAll}</Button>
        </div>
      )}

      <EnvFileTable env={env} file={file} onChange={change} onRegenerate={regenerate} addRow={addRow || undefined} />
    </div>
  )
}
