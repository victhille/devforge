import { useEffect, useState } from 'react'
import { Code2, Globe, Plus, TerminalSquare, Trash2, FolderOpen } from 'lucide-react'
import type { Project, Stack, StackStep, StackStepType } from '@shared/types'
import { useI18n } from '@renderer/i18n/I18nContext'
import { cn } from '@renderer/lib/cn'
import Button from '@renderer/components/ui/Button'
import IconButton from '@renderer/components/ui/IconButton'
import Modal from '@renderer/components/ui/Modal'
import { Field, Input, Select } from '@renderer/components/ui/Input'
import { CONNECTION_COLORS } from '@renderer/features/ssh/components/ConnectionForm'

export const STEP_ICON: Record<StackStepType, typeof Code2> = { command: TerminalSquare, vscode: Code2, url: Globe }

const newStep = (type: StackStepType, extra: Partial<StackStep> = {}): StackStep =>
  ({ id: crypto.randomUUID(), type, label: '', ...extra })

interface Props {
  initial?: Stack
  onSave: (stack: Stack) => void
  onClose: () => void
}

export default function StackEditor({ initial, onSave, onClose }: Props) {
  const { t } = useI18n()
  const s = t.stacks
  const [name, setName] = useState(initial?.name ?? '')
  const [color, setColor] = useState(initial?.color ?? CONNECTION_COLORS[0])
  const [steps, setSteps] = useState<StackStep[]>(initial?.steps ?? [])
  const [projects, setProjects] = useState<Project[]>([])

  useEffect(() => { window.devforge.getProjects().then(setProjects) }, [])

  const patch = (id: string, p: Partial<StackStep>) => setSteps(list => list.map(x => (x.id === id ? { ...x, ...p } : x)))

  /** One click: the project's dev script + VS Code */
  async function addProject(path: string) {
    const project = projects.find(p => p.path === path)
    if (!project) return
    const scripts = await window.devforge.getProjectScripts(project.path).catch(() => ({} as Record<string, string>))
    const script = ['dev', 'start', 'serve'].find(k => k in scripts)
    const pm = project.packageManager === 'npm' ? 'npm run' : project.packageManager
    setSteps(list => [
      ...list,
      ...(script ? [newStep('command', { label: project.name, command: `${pm} ${script}`, cwd: project.path })] : []),
      newStep('vscode', { label: `VS Code — ${project.name}`, cwd: project.path })
    ])
    if (!name) setName(project.name)
  }

  async function browse(id: string) {
    const dir = await window.devforge.selectDirectory()
    if (dir) patch(id, { cwd: dir })
  }

  const valid = name.trim() && steps.length > 0 && steps.every(st =>
    st.type === 'url' ? /^https?:\/\//.test(st.url ?? '') : st.type === 'vscode' ? !!st.cwd : !!st.command && !!st.cwd)

  return (
    <Modal
      title={initial ? s.editTitle : s.newTitle}
      onClose={onClose}
      className="max-w-2xl"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>{t.common.cancel}</Button>
          <Button
            disabled={!valid}
            onClick={() => onSave({ id: initial?.id ?? crypto.randomUUID(), name: name.trim(), color, steps: steps.map(st => ({ ...st, label: st.label || st.command || st.url || 'VS Code' })) })}
          >
            {t.common.save}
          </Button>
        </>
      }
    >
      <div className="flex gap-3">
        <Field label={s.name} className="flex-1">
          <Input value={name} onChange={e => setName(e.target.value)} placeholder={s.namePlaceholder} autoFocus />
        </Field>
        <Field label={s.color}>
          <div className="flex h-9 items-center gap-1.5">
            {CONNECTION_COLORS.slice(0, 6).map(c => (
              <button key={c} type="button" aria-label={c} onClick={() => setColor(c)} style={{ background: c }}
                className={cn('size-5 rounded-full', color === c && 'ring-2 ring-fg ring-offset-2 ring-offset-surface')} />
            ))}
          </div>
        </Field>
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-xs font-medium text-fg-secondary">{s.steps}</span>
        {steps.length === 0 && <p className="rounded-lg border border-dashed border-line p-4 text-center text-sm text-fg-muted">{s.noSteps}</p>}
        {steps.map(st => {
          const Icon = STEP_ICON[st.type]
          return (
            <div key={st.id} className="flex flex-col gap-2 rounded-lg border border-line-subtle bg-elevated p-3">
              <div className="flex items-center gap-2">
                <Icon size={15} className="shrink-0 text-accent" />
                <Input value={st.label} onChange={e => patch(st.id, { label: e.target.value })} placeholder={s.labelPlaceholder} className="h-8 flex-1" />
                <IconButton tone="danger" title={t.common.delete} onClick={() => setSteps(l => l.filter(x => x.id !== st.id))}><Trash2 size={13} /></IconButton>
              </div>
              {st.type === 'command' && (
                <Input value={st.command ?? ''} onChange={e => patch(st.id, { command: e.target.value })} placeholder="npm run dev" className="h-8 font-mono text-sm" />
              )}
              {st.type === 'url' ? (
                <div className="flex gap-2">
                  <Input value={st.url ?? ''} onChange={e => patch(st.id, { url: e.target.value })} placeholder="http://localhost:5173" className="h-8 flex-1 font-mono text-sm" />
                  <Input type="number" min={0} step={500} value={st.delayMs ?? 0} onChange={e => patch(st.id, { delayMs: Number(e.target.value) })} className="h-8 w-28" title={s.delay} />
                </div>
              ) : (
                <div className="flex gap-2">
                  <Input value={st.cwd ?? ''} onChange={e => patch(st.id, { cwd: e.target.value })} placeholder={s.folder} className="h-8 flex-1 font-mono text-xs" />
                  <IconButton title={t.common.browse} onClick={() => browse(st.id)}><FolderOpen size={14} /></IconButton>
                </div>
              )}
            </div>
          )
        })}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button variant="secondary" size="sm" onClick={() => setSteps(l => [...l, newStep('command')])}><TerminalSquare size={13} /> {s.addCommand}</Button>
        <Button variant="secondary" size="sm" onClick={() => setSteps(l => [...l, newStep('vscode')])}><Code2 size={13} /> VS Code</Button>
        <Button variant="secondary" size="sm" onClick={() => setSteps(l => [...l, newStep('url', { url: 'http://localhost:', delayMs: 3000 })])}><Globe size={13} /> URL</Button>
        <Select value="" onChange={e => addProject(e.target.value)} className="ml-auto h-8 w-56 text-sm">
          <option value="">{s.addFromProject}</option>
          {projects.map(p => <option key={p.id} value={p.path}>{p.name}</option>)}
        </Select>
      </div>
      <p className="-mt-2 flex items-center gap-1 text-xs text-fg-muted"><Plus size={11} /> {s.addFromProjectHint}</p>
    </Modal>
  )
}
