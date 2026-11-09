import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { LinesSkeleton } from '@renderer/components/ui/Skeleton'
import { Code2, Eye, SquareArrowOutUpRight, X } from 'lucide-react'
import type { DefaultIDE, FileChangeStatus, FileEntry, FilePreview as Preview } from '@shared/types'
import { codeLanguage } from '@shared/lib/codeLanguage'
import { HIGHLIGHT_LIMIT, useHighlighted } from '@renderer/lib/useHighlighted'
import { useI18n } from '@renderer/i18n/I18nContext'
import { useToast } from '@renderer/app/ToastContext'
import { usePreferredIde } from '@renderer/lib/ide'
import { formatSize } from '@renderer/lib/format'
import IconButton from '@renderer/components/ui/IconButton'
import Spinner from '@renderer/components/ui/Spinner'
import CopyButton from '@renderer/components/ui/CopyButton'
import Markdown from '@renderer/features/assistant/Markdown'
import { cn } from '@renderer/lib/cn'
import { DiffView, TONE } from './GitMarks'
import { errorText } from '@renderer/lib/errors'

// pdf.js is heavy: loaded with the first PDF only
const PdfView = lazy(() => import('./PdfView'))

/** v3.5.3: code in colours, as in an IDE (highlight.js loaded with the first one) */
function CodeView({ text, name, line }: { text: string; name: string; line?: number }) {
  const language = text.length <= HIGHLIGHT_LIMIT ? codeLanguage(name) : null
  const html = useHighlighted(text, language)
  const pre = useRef<HTMLPreElement>(null)
  const [band, setBand] = useState<{ top: number; height: number } | null>(null)
  // v3.6: a search result's line, highlighted and brought into view
  useEffect(() => {
    const el = pre.current
    if (!el || !line) { setBand(null); return }
    const style = getComputedStyle(el)
    const height = parseFloat(style.lineHeight) || 19.5
    const top = parseFloat(style.paddingTop) + (line - 1) * height
    setBand({ top, height })
    const box = el.parentElement
    if (box) box.scrollTop = Math.max(0, top - box.clientHeight / 3)
  }, [line, html, text])
  return (
    <pre ref={pre} data-language={language ?? undefined} className="df-code relative min-w-max p-4 font-mono text-xs leading-relaxed text-fg-secondary">
      {band && <span aria-hidden data-testid="line-band" className="pointer-events-none absolute right-0 left-0 bg-warning-soft" style={{ top: band.top, height: band.height }} />}
      {/* highlight.js escapes the code: only its own <span> tags are added */}
      {html !== null ? <code className="relative" dangerouslySetInnerHTML={{ __html: html }} /> : <code className="relative">{text}</code>}
    </pre>
  )
}

/**
 * v3.5.1: the file picked in the tree. Markdown is shown formatted (its
 * source one click away), images and PDFs as such, other text in a fixed
 * font, in colours (v3.5.3). The project's IDE opens it.
 */
export default function FilePreview({ file, line, root, ide: own, onClose, change, rel, startOnChanges, stats }: {
  file: FileEntry; line?: number; root?: string; ide?: DefaultIDE; onClose: () => void
  /** v3.7: what Git says of this file, its path in the project; the changes shown first */
  change?: FileChangeStatus; rel?: string; startOnChanges?: boolean
  /** Lines added and removed since the last commit */
  stats?: { add: number | null; del: number | null }
}) {
  const { t, lang } = useI18n()
  const f = t.files
  const toast = useToast()
  const ide = usePreferredIde()
  const ideLabel = ide.labelFor(own)
  const [preview, setPreview] = useState<Preview | null>(null)
  const [source, setSource] = useState(false)
  // A deleted file has nothing else to show
  const [diffMode, setDiffMode] = useState(false)
  useEffect(() => { setDiffMode(!!change && (change === 'deleted' || !!startOnChanges)) }, [file.path, change, startOnChanges])
  const showDiff = !!change && !!root && !!rel && diffMode

  useEffect(() => {
    let alive = true
    setPreview(null)
    // At a line (a search result): the source, where the line is
    setSource(!!line)
    window.devforge.previewFile(file.path).then(p => { if (alive) setPreview(p) }).catch(() => { if (alive) setPreview({ kind: 'unreadable', size: 0 }) })
    return () => { alive = false }
  }, [file.path, line])

  const text = preview && (preview.kind === 'markdown' || preview.kind === 'text') ? preview.text : null

  async function openInIde() {
    try { await ide.openFile(file.path, own, root, line) }
    catch (err) { toast.show({ tone: 'error', title: errorText(err) }) }
  }

  return (
    <section aria-label={f.previewOf.replace('{name}', file.name)} className="flex min-h-0 min-w-0 flex-1 flex-col">
      {/* As in the mock-up: the file's path in the project, its changes counted */}
      <header className="flex min-h-12 shrink-0 flex-wrap items-center gap-2 border-b border-line-subtle px-4 py-2">
        <span className="min-w-0 truncate font-mono text-sm font-semibold text-fg" title={file.path}>{rel || file.name}</span>
        {stats?.add != null && stats.add > 0 && <span className="shrink-0 font-mono text-xs text-success">+{stats.add}</span>}
        {stats?.del != null && stats.del > 0 && <span className="shrink-0 font-mono text-xs text-danger">−{stats.del}</span>}
        {preview && preview.size > 0 && <span className="shrink-0 font-mono text-2xs text-fg-muted">{formatSize(preview.size, lang)}</span>}
        {change && <span className={cn('shrink-0 font-mono text-2xs', TONE[change].replace('line-through', ''))}>{f.gitStatus[change]}</span>}
        <span className="ml-auto flex items-center gap-1">
          {change && change !== 'deleted' && (
            <span role="group" aria-label={f.viewLabel} className="mr-1 flex rounded-md border border-line p-px text-xs">
              {[false, true].map(v => (
                <button key={String(v)} aria-pressed={diffMode === v} onClick={() => setDiffMode(v)}
                  className={cn('rounded px-2 py-0.5', diffMode === v ? 'bg-active text-fg' : 'text-fg-secondary hover:text-fg')}>{v ? f.viewChanges : f.viewFile}</button>
              ))}
            </span>
          )}
          {preview?.kind === 'markdown' && !showDiff && (
            <IconButton size="sm" title={source ? f.formatted : f.source} aria-pressed={source} onClick={() => setSource(s => !s)}>
              {source ? <Eye size={13} /> : <Code2 size={13} />}
            </IconButton>
          )}
          {text !== null && <CopyButton text={text} title={f.copy} />}
          {ideLabel && <IconButton size="sm" title={f.openInIde.replace('{ide}', ideLabel)} onClick={openInIde}><SquareArrowOutUpRight size={13} /></IconButton>}
          <IconButton size="sm" title={f.closePreview} onClick={onClose}><X size={13} /></IconButton>
        </span>
      </header>
      {/* Scrollable: reachable with the keyboard too */}
      <div className="min-h-0 flex-1 overflow-auto" data-testid="file-preview" tabIndex={0}>
        {showDiff ? <DiffView root={root!} rel={rel!} />
          : !preview ? <LinesSkeleton lines={8} plain className="p-5" />
          : preview.kind === 'markdown' && !source ? <div className="max-w-[860px] px-5 py-4 text-sm leading-relaxed text-fg-secondary"><Markdown text={preview.text} asDocument /></div>
          : text !== null ? <CodeView text={text} name={file.name} line={line} />
          : preview.kind === 'image' ? <div className="flex min-h-full items-center justify-center bg-[repeating-conic-gradient(var(--color-elevated)_0%_25%,transparent_0%_50%)] bg-[length:16px_16px] p-4"><img src={preview.dataUrl} alt={file.name} className="max-h-full max-w-full object-contain" /></div>
          : preview.kind === 'pdf' ? <Suspense fallback={<Spinner className="m-6" />}><PdfView bytes={preview.bytes} /></Suspense>
          : <p className="p-4 text-sm text-fg-muted">{preview.kind === 'binary' ? f.binary : preview.kind === 'tooBig' ? f.tooBig : f.unreadable}</p>}
      </div>
    </section>
  )
}
