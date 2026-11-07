import { useEffect, useRef, useState } from 'react'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import { useI18n } from '@renderer/i18n/I18nContext'
import Spinner from '@renderer/components/ui/Spinner'

/** Pages drawn at once; the rest on demand */
const FIRST_PAGES = 20

/** v3.5.1: a PDF drawn page by page with pdf.js (loaded on first use) */
export default function PdfView({ bytes }: { bytes: Uint8Array }) {
  const { t } = useI18n()
  const box = useRef<HTMLDivElement>(null)
  const [pages, setPages] = useState<number | null>(null)
  const [shown, setShown] = useState(FIRST_PAGES)
  const [error, setError] = useState(false)

  useEffect(() => {
    let alive = true
    const host = box.current
    if (!host) return
    host.replaceChildren()
    setError(false)
    let task: { destroy: () => Promise<void> } | null = null
    ;(async () => {
      const pdfjs = await import('pdfjs-dist')
      pdfjs.GlobalWorkerOptions.workerSrc = workerUrl
      // pdf.js takes the buffer over: hand it a copy
      const loading = pdfjs.getDocument({ data: bytes.slice() })
      task = loading
      const pdf = await loading.promise
      if (!alive) return
      setPages(pdf.numPages)
      const width = host.clientWidth - 24
      for (let n = 1; n <= Math.min(pdf.numPages, shown) && alive; n++) {
        const page = await pdf.getPage(n)
        const base = page.getViewport({ scale: 1 })
        const viewport = page.getViewport({ scale: (width / base.width) * window.devicePixelRatio })
        const canvas = document.createElement('canvas')
        canvas.width = viewport.width
        canvas.height = viewport.height
        canvas.style.width = `${width}px`
        canvas.className = 'mx-auto mb-3 rounded bg-white shadow'
        canvas.setAttribute('aria-label', t.files.pdfPage.replace('{n}', String(n)))
        if (!alive) return
        host.appendChild(canvas)
        await page.render({ canvas, viewport }).promise
      }
    })().catch(() => { if (alive) setError(true) })
    return () => { alive = false; void task?.destroy() }
  }, [bytes, shown, t])

  if (error) return <p className="p-4 text-sm text-fg-muted">{t.files.unreadable}</p>
  return (
    <div className="p-3">
      {pages === null && <Spinner className="m-4" />}
      <div ref={box} data-testid="pdf-pages" />
      {pages !== null && pages > shown && (
        <button onClick={() => setShown(pages)} className="mx-auto block rounded-lg border border-line bg-elevated px-3 py-1.5 text-xs text-fg hover:bg-hover">
          {t.files.morePages.replace('{n}', String(pages - shown))}
        </button>
      )}
    </div>
  )
}
