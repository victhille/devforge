import { useEffect, useState } from 'react'
import { Loader2, Mic, Square } from 'lucide-react'
import { useI18n } from '@renderer/i18n/I18nContext'
import { cn } from '@renderer/lib/cn'
import { useDictation, type DictationState } from '@renderer/hooks/useDictation'

/** Line under the input while dictating (or why it failed) */
export function dictationLine(state: DictationState, t: ReturnType<typeof useI18n>['t'], seconds: number): string | null {
  const d = t.dictation
  switch (state.phase) {
    case 'recording': return d.recording.replace('{s}', String(seconds))
    case 'download': return state.pct === null ? d.downloadingNoPct : d.downloading.replace('{p}', String(state.pct))
    case 'transcribing': return d.transcribing
    case 'error': return state.reason === 'mic' ? d.micDenied : d.failed.replace('{e}', state.message ?? '')
    default: return null
  }
}

/**
 * Microphone button: click to talk, click again to get the text.
 * `onStatus` receives the line to show near the input (null when idle).
 */
export default function DictateButton({ onText, onStatus, className }: { onText: (text: string) => void; onStatus: (line: string | null) => void; className?: string }) {
  const { t } = useI18n()
  const d = t.dictation
  const { state, toggle } = useDictation(onText)
  const [seconds, setSeconds] = useState(0)

  useEffect(() => {
    if (state.phase !== 'recording') { setSeconds(0); return }
    const id = setInterval(() => setSeconds(Math.round((Date.now() - state.since) / 1000)), 250)
    return () => clearInterval(id)
  }, [state])
  useEffect(() => { onStatus(dictationLine(state, t, seconds)) }, [state, seconds, t, onStatus])

  const recording = state.phase === 'recording'
  const working = state.phase === 'download' || state.phase === 'transcribing'
  return (
    <button type="button" onClick={toggle} disabled={working} aria-pressed={recording}
      title={recording ? d.stop : `${d.start} — ${d.hint}`} aria-label={recording ? d.stop : d.start}
      className={cn('relative flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] border transition-colors disabled:cursor-wait',
        recording ? 'border-danger/50 bg-danger-soft text-danger' : 'border-line bg-elevated text-fg-secondary hover:text-fg', className)}>
      {recording && <span aria-hidden className="absolute inset-0 animate-ping rounded-[10px] bg-danger/20 [animation-duration:1.6s]" />}
      {working ? <Loader2 size={16} className="animate-spin" /> : recording ? <Square size={13} fill="currentColor" /> : <Mic size={16} />}
    </button>
  )
}
