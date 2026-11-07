import { existsSync, readdirSync, rmSync, statSync } from 'fs'
import { join } from 'path'
import { app } from 'electron'
import type { DictationModel, DictationProgress, DictationStatus } from '@shared/types'
import { log } from '../../lib/log'

/**
 * Voice typing with Whisper, run on this PC (transformers.js + ONNX Runtime).
 * The model is downloaded once from Hugging Face into userData/models, then
 * everything works offline: the audio never leaves the computer.
 */

const MODELS: Record<DictationModel, string> = {
  base: 'onnx-community/whisper-base',
  small: 'onnx-community/whisper-small'
}
const SAMPLE_RATE = 16_000
/** Longer recordings are cut: the widget is for short requests */
const MAX_SECONDS = 120

const cacheDir = () => join(app.getPath('userData'), 'models')
const modelDir = (m: DictationModel) => join(cacheDir(), ...MODELS[m].split('/'))

type Transcriber = (audio: Float32Array, opts: Record<string, unknown>) => Promise<{ text: string } | { text: string }[]>
const loaded = new Map<DictationModel, Promise<Transcriber>>()

function sizeOf(path: string): number {
  try {
    const st = statSync(path)
    return st.isDirectory() ? readdirSync(path).reduce((n, f) => n + sizeOf(join(path, f)), 0) : st.size
  } catch { return 0 }
}

export function dictationStatus(model: DictationModel): DictationStatus {
  const dir = modelDir(model)
  const ready = existsSync(join(dir, 'onnx')) && readdirSync(join(dir, 'onnx')).some(f => f.endsWith('.onnx'))
  return { model, downloaded: ready, size: ready ? sizeOf(dir) : 0, loaded: loaded.has(model) }
}

/** Loads (and downloads the first time) the model; progress goes to `onProgress` */
function load(model: DictationModel, onProgress: (p: DictationProgress) => void): Promise<Transcriber> {
  let p = loaded.get(model)
  if (!p) {
    p = (async () => {
      const { pipeline, env } = await import('@huggingface/transformers')
      env.cacheDir = cacheDir()
      env.allowLocalModels = false
      const files = new Map<string, { loaded: number; total: number }>()
      const asr = await pipeline('automatic-speech-recognition', MODELS[model], {
        dtype: 'q8',
        device: 'cpu',
        progress_callback: (e: { status: string; file?: string; loaded?: number; total?: number }) => {
          if (e.status !== 'progress' || !e.file) return
          files.set(e.file, { loaded: e.loaded ?? 0, total: e.total ?? 0 })
          const all = [...files.values()]
          onProgress({ loaded: all.reduce((n, f) => n + f.loaded, 0), total: all.reduce((n, f) => n + f.total, 0) })
        }
      })
      log('info', 'dictation', `Whisper ${model} ready`)
      return asr as unknown as Transcriber
    })()
    loaded.set(model, p)
    // A failed download can be retried
    p.catch(() => loaded.delete(model))
  }
  return p
}

export const prepareDictation = (model: DictationModel, onProgress: (p: DictationProgress) => void) => load(model, onProgress).then(() => dictationStatus(model))

/** Root mean square: below this the recording is silence (Whisper invents text on silence) */
export const SILENCE_RMS = 0.006
export function rms(audio: Float32Array): number {
  let sum = 0
  for (let i = 0; i < audio.length; i++) sum += audio[i] * audio[i]
  return audio.length ? Math.sqrt(sum / audio.length) : 0
}

/** Whisper sometimes loops on noise ("une question qui vous donne une question…"): keep the first pass */
export function cleanTranscript(text: string): string {
  let t = text.replace(/\s+/g, ' ').trim()
  const words = t.split(' ')
  for (let n = 2; n <= 8; n++) {
    for (let i = 0; i + n * 3 <= words.length; i++) {
      const gram = words.slice(i, i + n).join(' ')
      let repeats = 1
      while (words.slice(i + repeats * n, i + (repeats + 1) * n).join(' ') === gram) repeats++
      if (repeats >= 3) { t = words.slice(0, i + n).join(' '); return cleanTranscript(t) }
    }
  }
  // Known filler of Whisper on silence or music
  if (/^(\[.*\]|\(.*\)|sous-titr|merci d'avoir regardé|thanks for watching)/i.test(t)) return ''
  return t
}

export async function transcribe(input: unknown, model: DictationModel, language: 'fr' | 'en', onProgress: (p: DictationProgress) => void): Promise<string> {
  if (!(input instanceof Float32Array)) throw new Error('Invalid audio')
  const audio = input.length > SAMPLE_RATE * MAX_SECONDS ? input.subarray(0, SAMPLE_RATE * MAX_SECONDS) : input
  if (audio.length < SAMPLE_RATE / 4 || rms(audio) < SILENCE_RMS) return ''
  const asr = await load(model, onProgress)
  const out = await asr(audio, {
    language: language === 'fr' ? 'french' : 'english',
    task: 'transcribe',
    max_new_tokens: 224,
    // Over 30 s Whisper works by windows
    ...(audio.length > SAMPLE_RATE * 30 ? { chunk_length_s: 30, stride_length_s: 5 } : {})
  })
  const text = Array.isArray(out) ? out.map(o => o.text).join(' ') : out.text
  return cleanTranscript(text)
}

/** Frees the disk space; the model downloads again on next use */
export function removeModel(model: DictationModel): DictationStatus {
  loaded.delete(model)
  rmSync(modelDir(model), { recursive: true, force: true })
  return dictationStatus(model)
}
