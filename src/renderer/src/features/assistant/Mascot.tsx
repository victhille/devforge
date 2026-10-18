import { useEffect, useId, useRef, useState } from 'react'
import { useI18n } from '@renderer/i18n/I18nContext'
import './mascot.css'

export type MascotMood = 'idle' | 'listening' | 'thinking' | 'searching' | 'working' | 'happy' | 'sad' | 'sleeping'

interface Props {
  mood: MascotMood
  size?: number
  /** Eyes follow the mouse (off for the tiny title-bar version) */
  followCursor?: boolean
  className?: string
}

/** LED colour of the visor eyes and the antenna, per mood */
const LED: Record<MascotMood, string> = {
  idle: '#FF9A3C', listening: '#FFB25C', thinking: '#FFC857', searching: '#5CC8FF',
  working: '#FF9A3C', happy: '#FFD166', sad: '#E0645A', sleeping: '#8A6A50'
}

/**
 * Forgy, the assistant mascot: a small glossy robot head with a dark visor,
 * LED eyes and a forge-orange antenna light. Its face and motion show what
 * the assistant is doing. Pure SVG + CSS animations (mascot.css).
 *
 * Performance: animating SVG parts costs a style + layout pass per frame on
 * the main thread, so at rest (idle, sleeping) nothing in the SVG animates.
 * Blinks are a timer, the large version floats through a composited HTML
 * wrapper, and the eyes follow the mouse without a React render.
 */

/** Moods with motion inside the SVG (the assistant is busy or reacting) */
const ANIMATED: MascotMood[] = ['listening', 'thinking', 'searching', 'working', 'happy', 'sad']
/** Fixed gaze of some moods; the others follow the cursor */
const GAZE: Partial<Record<MascotMood, { x: number; y: number }>> = { thinking: { x: 3, y: -2.5 }, sad: { x: 0, y: 2 }, searching: { x: 0, y: 0 } }
export default function Mascot({ mood, size = 40, followCursor = true, className }: Props) {
  const { t } = useI18n()
  const svgRef = useRef<SVGSVGElement>(null)
  const eyesRef = useRef<SVGGElement>(null)
  const [blink, setBlink] = useState(false)
  const id = useId().replace(/:/g, '')
  const led = LED[mood]
  const animated = ANIMATED.includes(mood)

  // Eyes: a fixed direction for some moods, else the cursor. Written straight
  // to the element: a React render per mouse move would cost a layout each time
  useEffect(() => {
    const set = (x: number, y: number) => { if (eyesRef.current) eyesRef.current.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)` }
    const fixed = GAZE[mood]
    if (fixed || !followCursor) { set(fixed?.x ?? 0, fixed?.y ?? 0); return }
    let frame = 0
    let last = ''
    const onMove = (e: MouseEvent) => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        const r = svgRef.current?.getBoundingClientRect()
        if (!r) return
        const dx = e.clientX - (r.left + r.width / 2)
        const dy = e.clientY - (r.top + r.height / 2)
        const d = Math.hypot(dx, dy) || 1
        const k = Math.min(1, d / 300)
        const x = (dx / d) * 4 * k, y = (dy / d) * 2.4 * k
        const key = `${x.toFixed(1)},${y.toFixed(1)}`
        if (key !== last) { last = key; set(x, y) }
      })
    }
    window.addEventListener('mousemove', onMove, { passive: true })
    return () => { window.removeEventListener('mousemove', onMove); cancelAnimationFrame(frame) }
  }, [followCursor, mood])

  // Blink now and then while at rest (one short render, not a running animation)
  useEffect(() => {
    if (mood !== 'idle' && mood !== 'listening') return
    let off: ReturnType<typeof setTimeout>
    const tick = setInterval(() => { setBlink(true); off = setTimeout(() => setBlink(false), 130) }, 4200 + Math.random() * 1600)
    return () => { clearInterval(tick); clearTimeout(off) }
  }, [mood])

  const eyes = (() => {
    switch (mood) {
      case 'happy':
        return <g stroke={led} strokeWidth="4" strokeLinecap="round" fill="none"><path d="M33 58 Q39 50 45 58" /><path d="M55 58 Q61 50 67 58" /></g>
      case 'sad':
        return <g stroke={led} strokeWidth="4" strokeLinecap="round" fill="none"><path d="M33 59 L45 54" /><path d="M67 59 L55 54" /></g>
      case 'sleeping':
        return <g stroke={led} strokeWidth="4" strokeLinecap="round"><path d="M33 58 H45" /><path d="M55 58 H67" /></g>
      case 'working':
        // Focused: narrowed LEDs
        return <g fill={led}><rect x="32" y="54" width="14" height="5" rx="2.5" /><rect x="54" y="54" width="14" height="5" rx="2.5" /></g>
      default: {
        const h = mood === 'listening' ? 14 : 12
        return (
          <g className="m-scan">
            <g className="m-eyes" ref={eyesRef}>
              <rect className="m-led" x="34" y={57 - h / 2} width="9" height={h} rx="4.5" fill={led} style={blink ? { transform: 'scaleY(0.12)' } : undefined} />
              <rect className="m-led" x="57" y={57 - h / 2} width="9" height={h} rx="4.5" fill={led} style={blink ? { transform: 'scaleY(0.12)' } : undefined} />
            </g>
          </g>
        )
      }
    }
  })()

  return (
    // The large version floats at rest: an HTML wrapper animates on the compositor, not the main thread
    <span className={`inline-flex ${size >= 60 && !animated ? 'mascot-float' : ''} ${className ?? ''}`}>
    <svg ref={svgRef} viewBox="0 0 100 100" width={size} height={size} data-mood={mood} data-anim={animated ? 'on' : 'off'}
      className="mascot" role="img" aria-label={`${t.assistant.mascotName} — ${t.assistant.moods[mood]}`}>
      <defs>
        {/* Glossy white shell: light from the top left */}
        <radialGradient id={`${id}-shell`} cx="0.35" cy="0.3" r="0.85">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="55%" stopColor="#E6E8EE" />
          <stop offset="100%" stopColor="#B9BECB" />
        </radialGradient>
        <linearGradient id={`${id}-visor`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#2A3042" />
          <stop offset="100%" stopColor="#141824" />
        </linearGradient>
        <radialGradient id={`${id}-glow`} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0%" stopColor={led} stopOpacity="0.9" />
          <stop offset="100%" stopColor={led} stopOpacity="0" />
        </radialGradient>
        <clipPath id={`${id}-visor-clip`}><rect x="24" y="42" width="52" height="30" rx="14" /></clipPath>
      </defs>

      <g className="m-body">
        {/* Antenna */}
        <g className="m-antenna">
          <rect x="48.5" y="14" width="3" height="16" rx="1.5" fill="#AEB3C0" />
          <circle cx="50" cy="13" r="9" fill={`url(#${id}-glow)`} className="m-halo" />
          <circle cx="50" cy="13" r="4.6" fill={led} className="m-bulb" />
        </g>

        {/* Ear bolts */}
        <rect x="8" y="50" width="9" height="16" rx="4" fill="#C9CDD8" />
        <rect x="83" y="50" width="9" height="16" rx="4" fill="#C9CDD8" />

        {/* Head */}
        <rect x="14" y="28" width="72" height="62" rx="26" fill={`url(#${id}-shell)`} />
        {/* Shine */}
        <ellipse cx="34" cy="38" rx="12" ry="5" fill="#fff" opacity="0.8" transform="rotate(-18 34 38)" />

        {/* Visor with LED face */}
        <rect x="24" y="42" width="52" height="30" rx="14" fill={`url(#${id}-visor)`} />
        <g clipPath={`url(#${id}-visor-clip)`}>
          {eyes}
          {mood === 'searching' && <rect className="m-sweep" x="24" y="42" width="6" height="30" fill={led} opacity="0.35" />}
          {mood === 'thinking' && (
            <g fill={led}>
              <circle className="m-dot" cx="44" cy="67" r="1.8" /><circle className="m-dot" cx="50" cy="67" r="1.8" /><circle className="m-dot" cx="56" cy="67" r="1.8" />
            </g>
          )}
          {mood === 'working' && (
            <g fill={led} opacity="0.85">
              <rect className="m-bar" x="40" y="62" width="3" height="6" rx="1.5" />
              <rect className="m-bar" x="45" y="62" width="3" height="6" rx="1.5" />
              <rect className="m-bar" x="50" y="62" width="3" height="6" rx="1.5" />
              <rect className="m-bar" x="55" y="62" width="3" height="6" rx="1.5" />
            </g>
          )}
        </g>
        {/* Visor reflection */}
        <path d="M30 46 Q50 42 70 46" stroke="#fff" strokeOpacity="0.12" strokeWidth="2" fill="none" strokeLinecap="round" />
      </g>

      {mood === 'happy' && (
        <g fill="#FFD166">
          <path className="m-star" d="M12 24 l2.5 6 6 2.5 -6 2.5 -2.5 6 -2.5 -6 -6 -2.5 6 -2.5 Z" />
          <path className="m-star" d="M88 22 l2 5 5 2 -5 2 -2 5 -2 -5 -5 -2 5 -2 Z" />
        </g>
      )}
      {mood === 'sleeping' && (
        <g fill="currentColor" className="text-fg-muted" fontSize="14" fontWeight="700" fontFamily="sans-serif">
          <text className="m-z" x="72" y="22">z</text><text className="m-z" x="80" y="14">z</text>
        </g>
      )}
    </svg>
    </span>
  )
}
