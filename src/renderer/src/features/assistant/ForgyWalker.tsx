import { useEffect, useRef, useState } from 'react'
import { useI18n } from '@renderer/i18n/I18nContext'
import { useAssistant } from './AssistantContext'
import Mascot from './Mascot'
import './forgyWalker.css'

type Pose = 'stand' | 'walk' | 'run' | 'wave' | 'sit' | 'sleep'

interface Scene {
  pose: Pose
  /** Positions in px from the left of the stage */
  x: number
  dogX: number
  /** 1 faces right, -1 faces left */
  dir: 1 | -1
  /** Duration of the current move in ms (0: no slide) */
  dur: number
  hello: boolean
}

/** Walking and running speeds in px/s */
const SPEED = { walk: 55, run: 150 }
const FIGURE = 48

const pick = <T,>(items: [T, number][]): T => {
  let r = Math.random() * items.reduce((n, [, w]) => n + w, 0)
  for (const [v, w] of items) if ((r -= w) <= 0) return v
  return items[0][0]
}

/**
 * Forgy strolls along the bottom of the content area: walks, stops to wave,
 * sits down, plays chase with Boulon and falls asleep with the assistant.
 * Purely decorative: aria-hidden, clicks go through, sitting still while
 * the window is hidden or in the background. Shown only when the assistant
 * panel is closed. Walking costs about 3 % of the main thread, resting nothing.
 */
export default function ForgyWalker() {
  const { walker, walkerDog, open, mood } = useAssistant()
  if (!walker || open) return null
  return <Stroll dog={walkerDog} sleeping={mood === 'sleeping'} />
}

function Stroll({ dog, sleeping }: { dog: boolean; sleeping: boolean }) {
  const { t } = useI18n()
  const stageRef = useRef<HTMLDivElement>(null)
  const width = useRef(800)
  const scene = useRef<Scene>({ pose: 'wave', x: 40, dogX: -10, dir: 1, dur: 0, hello: true })
  const [view, setView] = useState<Scene>(scene.current)

  useEffect(() => {
    const el = stageRef.current
    if (!el) return
    const ro = new ResizeObserver(() => { width.current = el.clientWidth })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    const show = (next: Scene) => { scene.current = next; setView(next) }
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    if (sleeping || reduced) {
      show({ ...scene.current, pose: sleeping ? 'sleep' : 'sit', dur: 0, hello: false })
      return
    }

    let timer: ReturnType<typeof setTimeout>
    const after = (ms: number) => { timer = setTimeout(step, ms) }

    function step() {
      const cur = scene.current
      // Nobody is looking: sit down (no animation) and check again later
      if (document.hidden || !document.hasFocus()) {
        if (cur.pose !== 'sit') show({ ...cur, pose: 'sit', dur: 0, hello: false })
        after(3000)
        return
      }
      const max = Math.max(FIGURE, width.current - FIGURE - 16)

      if (cur.pose === 'walk' || cur.pose === 'run') {
        // Arrived: take a break
        const pose = pick<Pose>([['stand', 4], ['wave', 2], ['sit', 3]])
        const hold = pose === 'stand' ? 1400 : pose === 'wave' ? 2800 : 5500
        show({ ...cur, pose, dur: 0, hello: false })
        after(hold)
        return
      }

      // Set off somewhere at least a short way off; sometimes a chase with Boulon
      const run = dog && Math.random() < 0.3
      let target = 16 + Math.random() * (max - 16)
      if (Math.abs(target - cur.x) < 120) target = cur.x > max / 2 ? Math.max(16, cur.x - 220) : Math.min(max, cur.x + 220)
      const dir: 1 | -1 = target >= cur.x ? 1 : -1
      const dur = Math.round((Math.abs(target - cur.x) / (run ? SPEED.run : SPEED.walk)) * 1000)
      // Boulon trots behind, or runs ahead during a chase
      const dogX = Math.min(max + 20, Math.max(-10, run ? target + 58 * dir : target - 50 * dir))
      show({ pose: run ? 'run' : 'walk', x: target, dogX, dir, dur, hello: false })
      after(dur)
    }

    // A first hello (on start or when waking up), then off he goes
    show({ ...scene.current, pose: 'wave', dur: 0, hello: true })
    after(2800)
    return () => clearTimeout(timer)
  }, [sleeping, dog])

  const { pose, x, dogX, dir, dur, hello } = view
  const slide = { transitionDuration: `${dur}ms` }

  return (
    <div ref={stageRef} className="fw-stage" aria-hidden="true">
      {dog && (
        <div className="fw-mover" style={{ ...slide, transform: `translateX(${dogX}px)` }}>
          <div className="fw-face" data-dir={dir}>
            <div className="fw-dog" data-pose={pose}>
              <div className="fw-dog-leg a1" /><div className="fw-dog-leg b1" />
              <div className="fw-dog-leg a2" /><div className="fw-dog-leg b2" />
              <div className="fw-dog-up">
                <div className="fw-dog-tail" />
                <div className="fw-dog-body" />
                <div className="fw-dog-collar" />
                <div className="fw-dog-head"><div className="fw-dog-visor" /></div>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="fw-mover" style={{ ...slide, transform: `translateX(${x}px)` }}>
        {pose === 'wave' && hello && <span className="fw-bubble">{t.assistant.walkerHello}</span>}
        <div className="fw-face" data-dir={dir}>
          <div className="fw-forgy" data-pose={pose}>
            <div className="fw-leg l" /><div className="fw-leg r" />
            <div className="fw-up">
              <div className="fw-arm l" /><div className="fw-arm r" />
              <div className="fw-torso"><span className="fw-core" /></div>
              <div className="fw-head">
                <Mascot mood={pose === 'sleep' ? 'sleeping' : pose === 'wave' ? 'happy' : 'idle'} size={44} followCursor={false} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
