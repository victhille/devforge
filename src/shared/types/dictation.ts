// ─── Voice typing (Whisper on this PC) ────────────────────────────────────────

/** base: ~75 MB, fast; small: ~250 MB, better with technical words */
export type DictationModel = 'base' | 'small'

export interface DictationStatus {
  model: DictationModel
  /** Model files are on disk */
  downloaded: boolean
  /** Bytes on disk */
  size: number
  /** In memory, ready to answer at once */
  loaded: boolean
}

/** First-use download, all files together */
export interface DictationProgress {
  loaded: number
  total: number
}

export interface DictationAPI {
  status: () => Promise<DictationStatus>
  /** Downloads and loads the model chosen in Settings */
  prepare: () => Promise<DictationStatus>
  onProgress: (cb: (p: DictationProgress) => void) => () => void
  /** 16 kHz mono samples → text ('' for silence) */
  transcribe: (audio: Float32Array) => Promise<string>
  remove: () => Promise<DictationStatus>
}
