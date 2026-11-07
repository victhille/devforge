import { useEffect, useState } from 'react'
import type { Project, TemplatePreview } from '@shared/types'
import { DEFAULT_EXCLUDE, parseExclude } from '@shared/lib/userTemplates'
import { useI18n } from '@renderer/i18n/I18nContext'
import { useToast } from '@renderer/app/ToastContext'
import { formatSize } from '@renderer/lib/format'
import Button from '@renderer/components/ui/Button'
import Modal from '@renderer/components/ui/Modal'
import { Field, Input, Textarea } from '@renderer/components/ui/Input'
import { errorText } from '@renderer/lib/errors'

/** v3.8 lot 5: a project saved as a template, with what is left out and what will be copied */
export default function SaveTemplateDialog({ project, onClose }: { project: Project; onClose: () => void }) {
  const { t } = useI18n()
  const m = t.templates
  const toast = useToast()
  const [name, setName] = useState(project.name)
  const [description, setDescription] = useState('')
  const [exclude, setExclude] = useState(DEFAULT_EXCLUDE.join('\n'))
  const [preview, setPreview] = useState<TemplatePreview | null>(null)
  const [busy, setBusy] = useState(false)

  // What will be copied, again when the list changes
  useEffect(() => {
    setPreview(null)
    const timer = setTimeout(() => {
      window.devforge.templates.preview(project.path, parseExclude(exclude)).then(setPreview).catch(() => {})
    }, 400)
    return () => clearTimeout(timer)
  }, [project.path, exclude])

  async function save() {
    setBusy(true)
    try {
      await window.devforge.templates.save({ projectPath: project.path, name, description, framework: project.framework, packageManager: project.packageManager, exclude: parseExclude(exclude) })
      toast.show({ tone: 'success', title: m.saved, description: name })
      onClose()
    } catch (err) {
      toast.show({ tone: 'error', title: m.saveFailed, description: errorText(err) === 'TOO_BIG' ? m.tooBig : errorText(err) })
      setBusy(false)
    }
  }

  return (
    <Modal title={m.saveTitle.replace('{name}', project.name)} onClose={onClose} className="max-w-xl"
      footer={<>
        <Button variant="ghost" onClick={onClose}>{t.common.cancel}</Button>
        <Button loading={busy} disabled={!name.trim() || !preview || preview.tooBig} onClick={save}>{m.save}</Button>
      </>}>
      <div className="flex flex-col gap-4">
        <Field label={m.name}>
          <Input value={name} onChange={e => setName(e.target.value)} maxLength={80} autoFocus />
        </Field>
        <Field label={m.description}>
          <Input value={description} onChange={e => setDescription(e.target.value)} placeholder={m.descriptionPlaceholder} maxLength={300} />
        </Field>
        <Field label={m.exclude} hint={m.excludeHint}>
          <Textarea value={exclude} onChange={e => setExclude(e.target.value)} rows={6} spellCheck={false} className="font-mono text-xs" />
        </Field>
        <div role="status" className="rounded-xl bg-canvas p-3 text-sm" data-testid="template-preview">
          {!preview ? <span className="text-fg-muted">{m.previewing}</span> : preview.tooBig ? <span className="text-danger">{m.tooBig}</span> : (
            <>
              <div className="font-medium text-fg">{m.preview.replace('{files}', String(preview.files)).replace('{size}', formatSize(preview.bytes))}</div>
              {preview.skipped.length > 0 && <div className="mt-1 text-xs text-fg-muted">{m.skipped.replace('{list}', preview.skipped.join(', '))}</div>}
            </>
          )}
        </div>
      </div>
    </Modal>
  )
}
