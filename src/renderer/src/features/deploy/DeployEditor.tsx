import { useEffect, useState } from 'react'
import type { DeployTarget, Project, SSHConnection } from '@shared/types'
import { useI18n } from '@renderer/i18n/I18nContext'
import Button from '@renderer/components/ui/Button'
import Checkbox from '@renderer/components/ui/Checkbox'
import Modal from '@renderer/components/ui/Modal'
import { Field, Input, Select, Textarea } from '@renderer/components/ui/Input'

/** Ready-made scripts for common setups */
export const PRESETS: { id: string; label: string; script: string }[] = [
  { id: 'node-pm2', label: 'Node.js + PM2', script: 'git pull\nnpm ci\nnpm run build\npm2 restart ecosystem.config.js --update-env' },
  { id: 'compose',  label: 'Docker Compose', script: 'git pull\ndocker compose pull\ndocker compose up -d --build\ndocker image prune -f' },
  { id: 'static',   label: 'Static site (build)', script: 'git pull\nnpm ci\nnpm run build' },
  { id: 'symfony',  label: 'PHP / Symfony', script: 'git pull\ncomposer install --no-dev --optimize-autoloader\nphp bin/console doctrine:migrations:migrate --no-interaction\nphp bin/console cache:clear --env=prod' },
  { id: 'laravel',  label: 'Laravel', script: 'git pull\ncomposer install --no-dev --optimize-autoloader\nphp artisan migrate --force\nphp artisan config:cache\nphp artisan route:cache' }
]

interface Props {
  initial?: DeployTarget
  onSave: (t: DeployTarget) => void
  onClose: () => void
}

export default function DeployEditor({ initial, onSave, onClose }: Props) {
  const { t } = useI18n()
  const d = t.deploy
  const [connections, setConnections] = useState<SSHConnection[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [form, setForm] = useState<DeployTarget>(initial ?? {
    id: crypto.randomUUID(), name: '', connectionId: '', remotePath: '/var/www/', script: PRESETS[0].script, pushFirst: false
  })

  useEffect(() => {
    window.devforge.getSshConnections().then(list => {
      setConnections(list)
      setForm(f => (f.connectionId ? f : { ...f, connectionId: list[0]?.id ?? '' }))
    })
    window.devforge.getProjects().then(setProjects)
  }, [])

  const set = <K extends keyof DeployTarget>(k: K, v: DeployTarget[K]) => setForm(f => ({ ...f, [k]: v }))
  const valid = form.name.trim() && form.connectionId && form.remotePath.trim() && form.script.trim()

  return (
    <Modal
      title={initial ? d.editTitle : d.newTitle}
      onClose={onClose}
      className="max-w-2xl"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>{t.common.cancel}</Button>
          <Button disabled={!valid} onClick={() => onSave({ ...form, name: form.name.trim(), remotePath: form.remotePath.trim() })}>{t.common.save}</Button>
        </>
      }
    >
      <div className="flex gap-3">
        <Field label={d.name} className="flex-1">
          <Input value={form.name} onChange={e => set('name', e.target.value)} placeholder="Production" autoFocus />
        </Field>
        <Field label={d.server} className="flex-1">
          <Select value={form.connectionId} onChange={e => set('connectionId', e.target.value)}>
            {connections.length === 0 && <option value="">{d.noServer}</option>}
            {connections.map(c => <option key={c.id} value={c.id}>{c.name} — {c.username}@{c.host}</option>)}
          </Select>
        </Field>
      </div>

      <Field label={d.remotePath} hint={d.remotePathHint}>
        <Input value={form.remotePath} onChange={e => set('remotePath', e.target.value)} className="font-mono" placeholder="/var/www/my-app" />
      </Field>

      <Field label={d.script} hint={d.scriptHint}>
        <Textarea value={form.script} onChange={e => set('script', e.target.value)} rows={7} spellCheck={false} />
      </Field>
      <div className="-mt-2 flex flex-wrap gap-1.5">
        {PRESETS.map(p => (
          <button key={p.id} type="button" onClick={() => set('script', p.script)}
            className="rounded-full border border-line-subtle px-2.5 py-0.5 text-xs text-fg-secondary hover:border-line hover:text-fg">
            {p.label}
          </button>
        ))}
      </div>

      <div className="flex items-end gap-3 rounded-lg border border-line-subtle p-3">
        <Field label={d.localProject} className="flex-1">
          <Select value={form.projectPath ?? ''} onChange={e => set('projectPath', e.target.value || undefined)}>
            <option value="">{d.none}</option>
            {projects.map(p => <option key={p.id} value={p.path}>{p.name}</option>)}
          </Select>
        </Field>
        <Checkbox checked={!!form.pushFirst} onChange={v => set('pushFirst', v)} className="h-9">
          {d.pushFirst}
        </Checkbox>
      </div>
    </Modal>
  )
}
