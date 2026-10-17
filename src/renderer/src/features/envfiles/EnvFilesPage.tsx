import { useCallback, useEffect, useState } from 'react'
import { FileKey2, FilePlus2, History, Plus, ShieldCheck } from 'lucide-react'
import type { EnvBackupInfo, EnvProject, Project } from '@shared/types'
import { useI18n } from '@renderer/i18n/I18nContext'
import { useToast } from '@renderer/app/ToastContext'
import { cn } from '@renderer/lib/cn'
import { formatRelative } from '@renderer/lib/format'
import Badge from '@renderer/components/ui/Badge'
import Button from '@renderer/components/ui/Button'
import EmptyState from '@renderer/components/ui/EmptyState'
import { Input, Select } from '@renderer/components/ui/Input'
import { SectionTitle } from '@renderer/components/ui/Page'
import ProjectIcon from '@renderer/features/projects/components/ProjectIcon'
import EnvMatrix from './EnvMatrix'

const isExample = (name: string) => /example|sample|dist|template/i.test(name)

/** Keys present in the template but missing from .env */
function missingInEnv(env: EnvProject): string[] {
  const example = env.files.find(f => isExample(f.name))
  if (!example) return []
  const main = env.files.find(f => f.name === '.env')
  return Object.keys(example.values).filter(k => !main || !(k in main.values))
}

export default function EnvFilesPage() {
  const { t, lang } = useI18n()
  const e = t.envFiles
  const toast = useToast()
  const [projects, setProjects] = useState<Project[]>([])
  const [envs, setEnvs] = useState<Record<string, EnvProject>>({})
  const [selected, setSelected] = useState<string | null>(null)
  const [backup, setBackup] = useState<EnvBackupInfo | null>(null)
  const [newKey, setNewKey] = useState({ key: '', value: '', file: '.env' })

  // Read every project's env files once, to show warnings in the list
  useEffect(() => {
    window.devforge.getProjects().then(async list => {
      setProjects(list)
      const entries = await Promise.all(list.map(p => window.devforge.env.read(p.path).then(env => [p.path, env] as const, () => [p.path, { projectPath: p.path, files: [] }] as const)))
      const map = Object.fromEntries(entries)
      setEnvs(map)
      setSelected(prev => prev ?? list.find(p => map[p.path]?.files.length)?.path ?? null)
    })
  }, [])

  const reload = useCallback(async (path: string) => {
    const env = await window.devforge.env.read(path)
    setEnvs(prev => ({ ...prev, [path]: env }))
  }, [])

  useEffect(() => {
    if (selected) window.devforge.env.backupInfo(selected).then(setBackup).catch(() => setBackup(null))
  }, [selected])

  const env = selected ? envs[selected] : undefined
  const missing = env ? missingInEnv(env) : []
  const withEnv = projects.filter(p => envs[p.path]?.files.length)

  async function change(fileName: string, key: string, value: string | null) {
    if (!selected) return
    try {
      await window.devforge.env.write(selected, fileName, { [key]: value })
      await reload(selected)
    } catch (err) {
      toast.show({ tone: 'error', title: e.saveFailed, description: String(err) })
    }
  }

  async function fillFromExample() {
    if (!selected || !env) return
    const example = env.files.find(f => isExample(f.name))!
    await window.devforge.env.write(selected, '.env', Object.fromEntries(missing.map(k => [k, example.values[k]])))
    await reload(selected)
    toast.show({ tone: 'success', title: e.filled.replace('{n}', String(missing.length)) })
  }

  async function addKey() {
    if (!newKey.key.trim()) return
    await change(newKey.file, newKey.key.trim(), newKey.value)
    setNewKey(k => ({ ...k, key: '', value: '' }))
  }

  async function doBackup() {
    if (!selected) return
    try {
      setBackup(await window.devforge.env.backup(selected))
      toast.show({ tone: 'success', title: e.backupDone })
    } catch (err) {
      toast.show({ tone: 'error', title: e.backupFailed, description: String(err) })
    }
  }

  async function doRestore() {
    if (!selected || !window.confirm(e.restoreConfirm)) return
    const files = await window.devforge.env.restore(selected)
    await reload(selected)
    toast.show({ tone: 'success', title: e.restored.replace('{files}', files.join(', ')) })
  }

  return (
    <div className="flex h-full">
      {/* Projects */}
      <aside className="flex w-64 shrink-0 flex-col border-r border-line-subtle bg-surface">
        <div className="flex h-11 shrink-0 items-center border-b border-line-subtle px-4">
          <SectionTitle>{e.projects}</SectionTitle>
        </div>
        <div className="flex-1 overflow-y-auto p-1.5">
          {withEnv.length === 0 && <p className="p-4 text-sm text-fg-muted">{e.noneFound}</p>}
          {withEnv.map(p => {
            const m = missingInEnv(envs[p.path]).length
            return (
              <button
                key={p.id}
                onClick={() => setSelected(p.path)}
                className={cn('flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left', selected === p.path ? 'bg-active' : 'hover:bg-hover')}
              >
                <ProjectIcon framework={p.framework} size="sm" />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate font-medium text-fg">{p.name}</span>
                  <span className="text-2xs text-fg-muted">{envs[p.path].files.length} {e.files}</span>
                </span>
                {m > 0 && <Badge color="danger">{m}</Badge>}
              </button>
            )
          })}
        </div>
      </aside>

      {/* Detail */}
      <section className="flex min-w-0 flex-1 flex-col gap-5 overflow-y-auto p-8">
        {!env || env.files.length === 0 ? (
          <EmptyState icon={<FileKey2 size={32} />} title={e.emptyTitle} description={e.emptyHint} />
        ) : (
          <>
            <header className="flex items-start justify-between gap-4">
              <div>
                <h1 className="text-xl font-semibold text-fg">{projects.find(p => p.path === selected)?.name}</h1>
                <p className="mt-0.5 font-mono text-xs text-fg-muted">{selected}</p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Button variant="secondary" onClick={doBackup}><ShieldCheck size={14} /> {e.backup}</Button>
                <Button variant="ghost" onClick={doRestore} disabled={!backup?.savedAt}><History size={14} /> {e.restore}</Button>
              </div>
            </header>

            {backup?.savedAt && (
              <p className="-mt-3 text-xs text-fg-muted">{e.lastBackup.replace('{when}', formatRelative(backup.savedAt, lang))}</p>
            )}

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

            <div className="flex items-end gap-2">
              <Input placeholder="NEW_KEY" value={newKey.key} onChange={ev => setNewKey(k => ({ ...k, key: ev.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, '_') }))} className="w-56 font-mono" />
              <Input placeholder={e.value} value={newKey.value} onChange={ev => setNewKey(k => ({ ...k, value: ev.target.value }))} className="font-mono" onKeyDown={ev => ev.key === 'Enter' && addKey()} />
              <Select value={newKey.file} onChange={ev => setNewKey(k => ({ ...k, file: ev.target.value }))} className="w-48 font-mono">
                {Array.from(new Set(['.env', ...env.files.map(f => f.name)])).map(n => <option key={n}>{n}</option>)}
              </Select>
              <Button onClick={addKey} disabled={!newKey.key.trim()}><Plus size={14} /> {e.add}</Button>
            </div>
          </>
        )}
      </section>
    </div>
  )
}
