import { useCallback, useEffect, useRef, useState } from 'react'
import { errorText } from '@renderer/lib/errors'

export type DictationState =
  | { phase: 'idle' }
  | { phase: 'recording'; since: number }
  | { phase: 'download'; pct: number | null }
  | { phase: 'transcribing' }
  | { phase: 'error'; reason: 'mic' | 'failed'; message?: string }

/**
 * Voice typing: records the microphone, then Whisper (on this PC, in the main
 * process) turns it into text. Click to start, click again to stop.
 */
export function useDictation(onText: (text: string) => void, maxSeconds = 60): { state: DictationState; toggle: () => void; cancel: () => void } {
  const [state, setState] = useState<DictationState>({ phase: 'idle' })
  const recorder = useRef<MediaRecorder | null>(null)
  const chunks = useRef<Blob[]>([])
  const stopTimer = useRef<ReturnType<typeof setTimeout>>()
  const cancelled = useRef(false)
  const textRef = useRef(onText)
  textRef.current = onText

  // First use: the model downloads, with its progress
  useEffect(() => window.devforge.dictation.onProgress(p => {
    setState(s => (s.phase === 'transcribing' || s.phase === 'download' ? { phase: 'download', pct: p.total ? Math.round((p.loaded / p.total) * 100) : null } : s))
  }), [])

  const finish = useCallback(async (blob: Blob) => {
    setState({ phase: 'transcribing' })
    try {
      // Whisper wants 16 kHz mono samples
      const ctx = new AudioContext({ sampleRate: 16_000 })
      const decoded = await ctx.decodeAudioData(await blob.arrayBuffer())
      void ctx.close()
      const text = await window.devforge.dictation.transcribe(decoded.getChannelData(0))
      if (!cancelled.current && text) textRef.current(text)
      setState({ phase: 'idle' })
    } catch (err) {
      setState({ phase: 'error', reason: 'failed', message: errorText(err) })
    }
  }, [])

  const start = useCallback(async () => {
    cancelled.current = false
    let stream: MediaStream
    try { stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true } }) }
    catch { setState({ phase: 'error', reason: 'mic' }); return }
    const rec = new MediaRecorder(stream)
    chunks.current = []
    rec.ondataavailable = e => { if (e.data.size) chunks.current.push(e.data) }
    rec.onstop = () => {
      stream.getTracks().forEach(t => t.stop())
      clearTimeout(stopTimer.current)
      if (cancelled.current) { setState({ phase: 'idle' }); return }
      void finish(new Blob(chunks.current, { type: rec.mimeType }))
    }
    rec.start()
    recorder.current = rec
    setState({ phase: 'recording', since: Date.now() })
    stopTimer.current = setTimeout(() => rec.state === 'recording' && rec.stop(), maxSeconds * 1000)
    // Warms the model up while the user speaks
    void window.devforge.dictation.prepare().catch(() => {})
  }, [finish, maxSeconds])

  const toggle = useCallback(() => {
    if (recorder.current?.state === 'recording') { recorder.current.stop(); return }
    if (state.phase === 'idle' || state.phase === 'error') void start()
  }, [start, state.phase])

  const cancel = useCallback(() => {
    cancelled.current = true
    if (recorder.current?.state === 'recording') recorder.current.stop()
    setState({ phase: 'idle' })
  }, [])

  useEffect(() => () => { cancelled.current = true; if (recorder.current?.state === 'recording') recorder.current.stop() }, [])

  return { state, toggle, cancel }
}
