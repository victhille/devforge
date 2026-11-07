import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { Maximize2, Minus, Plus } from 'lucide-react'
import { useI18n } from '@renderer/i18n/I18nContext'
import IconButton from '@renderer/components/ui/IconButton'

/**
 * v4.1: a picture of a model to look at like the editor's canvas: the wheel
 * zooms where the pointer is, a drag moves it, − / + / Fit in the corner.
 * Fitted whole when the picture changes.
 */
export default function ZoomView({ src, label }: { src: string; label: string }) {
  const { t } = useI18n()
  const e = t.modeling.editor
  const box = useRef<HTMLDivElement>(null)
  const [natural, setNatural] = useState({ w: 0, h: 0 })
  const [view, setView] = useState({ x: 0, y: 0, k: 1 })
  const drag = useRef<{ sx: number; sy: number; ox: number; oy: number } | null>(null)

  const fit = (w = natural.w, h = natural.h) => {
    const el = box.current
    if (!el || !w || !h) return
    const k = Math.min(2, (el.clientWidth - 24) / w, (el.clientHeight - 24) / h)
    setView({ k, x: (el.clientWidth - w * k) / 2, y: (el.clientHeight - h * k) / 2 })
  }
  const zoom = (factor: number, cx?: number, cy?: number) => {
    const el = box.current
    if (!el) return
    const px = cx ?? el.clientWidth / 2, py = cy ?? el.clientHeight / 2
    setView(v => {
      const k = Math.min(3, Math.max(0.05, v.k * factor))
      return { k, x: px - (px - v.x) * (k / v.k), y: py - (py - v.y) * (k / v.k) }
    })
  }
  // The wheel: a native listener, React's is passive and cannot stop the page from scrolling
  const zoomAt = useRef(zoom)
  zoomAt.current = zoom
  useEffect(() => {
    const el = box.current
    if (!el) return
    const onWheel = (ev: WheelEvent) => { ev.preventDefault(); const r = el.getBoundingClientRect(); zoomAt.current(Math.exp(-ev.deltaY * 0.0015), ev.clientX - r.left, ev.clientY - r.top) }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  const down = (ev: ReactPointerEvent) => { ev.currentTarget.setPointerCapture(ev.pointerId); drag.current = { sx: ev.clientX, sy: ev.clientY, ox: view.x, oy: view.y } }
  const move = (ev: ReactPointerEvent) => { const d = drag.current; if (d) setView(v => ({ ...v, x: d.ox + ev.clientX - d.sx, y: d.oy + ev.clientY - d.sy })) }
  const up = () => { drag.current = null }

  return (
    <div className="relative h-full w-full">
      <div ref={box} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}
        className="h-full w-full cursor-grab touch-none overflow-hidden active:cursor-grabbing" data-zoom={view.k.toFixed(2)}>
        <img src={src} alt={label} draggable={false} className="pointer-events-none absolute top-0 left-0 max-w-none origin-top-left select-none"
          style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.k})` }}
          onLoad={ev => { const w = ev.currentTarget.naturalWidth, h = ev.currentTarget.naturalHeight; setNatural({ w, h }); fit(w, h) }} />
      </div>
      <div className="absolute right-2 bottom-2 flex items-center gap-0.5 rounded-lg border border-line bg-surface p-0.5 shadow-pop">
        <IconButton size="sm" title={e.zoomOut} onClick={() => zoom(1 / 1.25)}><Minus size={13} /></IconButton>
        <span className="w-12 text-center font-mono text-xs text-fg-secondary" aria-live="polite">{Math.round(view.k * 100)} %</span>
        <IconButton size="sm" title={e.zoomIn} onClick={() => zoom(1.25)}><Plus size={13} /></IconButton>
        <IconButton size="sm" title={e.fit} onClick={() => fit()}><Maximize2 size={13} /></IconButton>
      </div>
    </div>
  )
}
