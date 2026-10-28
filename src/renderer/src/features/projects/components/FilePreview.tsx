import { lazy, Suspense, useEffect, useState } from 'react'
import { Code2, Eye, X } from 'lucide-react'
import type { FileEntry, FilePreview as Preview } from '@shared/types'
import { useI18n } from '@renderer/i18n/I18nContext'
import { formatSize } from '@renderer/lib/format'
import { cn } from '@renderer/lib/cn'
import IconButton from '@renderer/components/ui/IconButton'
import Spinner from '@renderer/components/ui/Spinner'
import CopyButton from '@renderer/components/ui/CopyButton'
import Markdown from '@renderer/features/assistant/Markdown'

// pdf.js is heavy: loaded with the first PDF only
const PdfView = lazy(() => import('./PdfView'))

/**
 * v3.5.1: the file picked in the tree. Markdown is shown formatted (its
 * source one click away), images and PDFs as such, other text in a fixed font.
 */
export default function FilePreview({ file, onClose }: { file: FileEntry; onClose: () => void }) {
  const { t } = useI18n()
  const f = t.files
  const [preview, setPreview] = useState<Preview | null>(null)
  const [source, setSource] = useState(false)

  useEffect(() => {
    let alive = true
    setPreview(null)
    setSource(false)
    window.devforge.previewFile(file.path).then(p => { if (alive) setPreview(p) }).catch(() => { if (alive) setPreview({ kind: 'unreadable', size: 0 }) })
    return () => { alive = false }
  }, [file.path])

  const text = preview && (preview.kind === 'markdown' || preview.kind === 'text') ? preview.text : null

  return (
    <section aria-label={f.previewOf.replace('{name}', file.name)} className="flex min-h-0 min-w-0 flex-1 flex-col border-l border-line-subtle">
      <header className="flex h-10 shrink-0 items-center gap-2 border-b border-line-subtle px-3">
        <span className="truncate font-mono text-[12.5px] font-medium text-fg" title={file.path}>{file.name}</span>
        {preview && preview.size > 0 && <span className="shrink-0 font-mono text-2xs text-fg-muted">{formatSize(preview.size)}</span>}
        <span className="ml-auto flex items-center gap-1">
          {preview?.kind === 'markdown' && (
            <IconButton size="sm" title={source ? f.formatted : f.source} aria-pressed={source} onClick={() => setSource(s => !s)}>
              {source ? <Eye size={13} /> : <Code2 size={13} />}
            </IconButton>
          )}
          {text !== null && <CopyButton text={text} title={f.copy} />}
          <IconButton size="sm" title={f.closePreview} onClick={onClose}><X size={13} /></IconButton>
        </span>
      </header>
      <div className="min-h-0 flex-1 overflow-auto" data-testid="file-preview">
        {!preview ? <Spinner className="m-6" />
          : preview.kind === 'markdown' && !source ? <div className="max-w-[860px] px-5 py-4 text-sm leading-relaxed text-fg-secondary"><Markdown text={preview.text} asDocument /></div>
          : text !== null ? <pre className={cn('min-w-max p-4 font-mono text-xs leading-relaxed text-fg-secondary')}>{text}</pre>
          : preview.kind === 'image' ? <div className="flex min-h-full items-center justify-center bg-[repeating-conic-gradient(var(--color-elevated)_0%_25%,transparent_0%_50%)] bg-[length:16px_16px] p-4"><img src={preview.dataUrl} alt={file.name} className="max-h-full max-w-full object-contain" /></div>
          : preview.kind === 'pdf' ? <Suspense fallback={<Spinner className="m-6" />}><PdfView bytes={preview.bytes} /></Suspense>
          : <p className="p-4 text-sm text-fg-muted">{preview.kind === 'binary' ? f.binary : preview.kind === 'tooBig' ? f.tooBig : f.unreadable}</p>}
      </div>
    </section>
  )
}
