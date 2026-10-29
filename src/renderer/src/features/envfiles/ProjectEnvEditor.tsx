import { useCallback, useEffect, useState } from 'react'
import { FileKey2, FilePlus2, History, Plus, ShieldCheck } from 'lucide-react'
import type { EnvBackupInfo, EnvProject } from '@shared/types'
import { useI18n } from '@renderer/i18n/I18nContext'
import { useToast } from '@renderer/app/ToastContext'
import { formatRelative } from '@renderer/lib/format'
import Button from '@renderer/components/ui/Button'
import EmptyState from '@renderer/components/ui/EmptyState'
import { Input, Select } from '@renderer/components/ui/Input'
import EnvMatrix from './EnvMatrix'

const isExample = (name: string) => /example|sample|dist|template/i.test(name)

/** Keys present in the template but missing from .env */
export function missingInEnv(env: EnvProject): string[] {
  const example = env.files.find(f => isExample(f.name))
  if (!example) return []
  const main = env.files.find(f => f.name === '.env')
  return Object.keys(example.values).filter(k => !main || !(k in main.values))
}

/**
 * The .env files of one project: values side by side, missing keys, new key,
 * encrypted backup. Used by the Env variables page and the project page.
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
  const [newKey, setNewKey] = useState({ key: '', value: '', file: '.env' })

  const reload = useCallback(async () => {
    const next = await window.devforge.env.read(projectPath).catch(() => ({ projectPath, files: [] }))
    setEnv(next)
    onEnvChange?.(next)
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

  async function change(fileName: string, key: string, value: string | null) {
    try {
      await window.devforge.env.write(projectPath, fileName, { [key]: value })
      await reload()
    } catch (err) {
      toast.show({ tone: 'error', title: e.saveFailed, description: String(err) })
    }
  }

  async function fillFromExample() {
    const example = env!.files.find(f => isExample(f.name))!
    await window.devforge.env.write(projectPath, '.env', Object.fromEntries(missing.map(k => [k, example.values[k]])))
    await reload()
    toast.show({ tone: 'success', title: e.filled.replace('{n}', String(missing.length)) })
  }

  async function addKey() {
    if (!newKey.key.trim()) return
    await change(newKey.file, newKey.key.trim(), newKey.value)
    setNewKey(k => ({ ...k, key: '', value: '' }))
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
    if (!window.confirm(e.restoreConfirm)) return
    const files = await window.devforge.env.restore(projectPath)
    await reload()
    toast.show({ tone: 'success', title: e.restored.replace('{files}', files.join(', ')) })
  }

  if (env.files.length === 0) return <EmptyState icon={<FileKey2 size={32} />} title={e.emptyTitle} description={e.emptyHint} />

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          {title && <h1 className="text-[26px] leading-tight font-semibold tracking-[-.02em] text-fg">{title}</h1>}
          <p className="mt-0.5 font-mono text-xs text-fg-muted">{projectPath}</p>
          {backup?.savedAt && <p className="mt-0.5 text-xs text-fg-muted">{e.lastBackup.replace('{when}', formatRelative(backup.savedAt, lang))}</p>}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button variant="secondary" onClick={doBackup}><ShieldCheck size={14} /> {e.backup}</Button>
          <Button variant="ghost" onClick={doRestore} disabled={!backup?.savedAt}><History size={14} /> {e.restore}</Button>
        </div>
      </header>

      {missing.length > 0 && (
        <div className="flex items-center gap-3 rounded-xl border border-danger/30 bg-danger-soft px-4 py-3">
          <span className="flex-1 text-sm text-fg">
            {e.missingBanner.replace('{n}', String(missing.length))}{' '}
            <span className="font-mono text-xs text-fg-secondary">{missing.slice(0, 6).join(', ')}{missing.length > 6 ? '…' : ''}</span>
          </span>
          <Button size="sm" onClick={fillFromExample}><FilePlus2 size={13} /> {e.fillFromExample}</Button>
        </div>
      )}

      <EnvMatrix env={env} onChange={change} />

      <div className="flex flex-wrap items-end gap-2">
        <Input placeholder="NEW_KEY" aria-label={e.newKeyLabel} value={newKey.key} onChange={ev => setNewKey(k => ({ ...k, key: ev.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, '_') }))} className="w-56 font-mono" />
        <Input placeholder={e.value} aria-label={e.value} value={newKey.value} onChange={ev => setNewKey(k => ({ ...k, value: ev.target.value }))} className="min-w-40 flex-1 font-mono" onKeyDown={ev => ev.key === 'Enter' && addKey()} />
        <Select aria-label={e.fileLabel} value={newKey.file} onChange={ev => setNewKey(k => ({ ...k, file: ev.target.value }))} className="w-48 font-mono">
          {Array.from(new Set(['.env', ...env.files.map(f => f.name)])).map(n => <option key={n}>{n}</option>)}
        </Select>
        <Button onClick={addKey} disabled={!newKey.key.trim()}><Plus size={14} /> {e.add}</Button>
      </div>
    </div>
  )
}
