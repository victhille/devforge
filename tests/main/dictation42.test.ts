import { existsSync, mkdirSync, writeFileSync } from 'fs'
import { join } from 'path'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { userData } from '../helpers'

/** v4.2 lot 4: voice typing — silence left out, Whisper's loops cut, the model on disk (Whisper itself faked) */

const whisper = vi.hoisted(() => ({ loads: 0, calls: [] as Record<string, unknown>[], answer: '' as string | { text: string }[], fail: false }))
vi.mock('@huggingface/transformers', () => ({
  env: {},
  pipeline: async () => {
    whisper.loads++
    if (whisper.fail) throw new Error('offline')
    return async (_audio: Float32Array, opts: Record<string, unknown>) => {
      whisper.calls.push(opts)
      return typeof whisper.answer === 'string' ? { text: whisper.answer } : whisper.answer
    }
  }
}))

const { cleanTranscript, dictationStatus, removeModel, rms, SILENCE_RMS, transcribe } = await import('../../src/main/services/dictation/whisper')

/** A tone loud enough to be speech, `seconds` long at 16 kHz */
const voice = (seconds: number) => Float32Array.from({ length: Math.round(16_000 * seconds) }, (_, i) => 0.2 * Math.sin(i / 8))

beforeEach(() => { whisper.calls = []; whisper.answer = ''; whisper.fail = false })

describe('cleanTranscript', () => {
  it('keeps the first pass of a loop of words', () => {
    expect(cleanTranscript('une question qui une question qui une question qui une question qui')).toBe('une question qui')
    expect(cleanTranscript('Ouvre   le projet\n boutique')).toBe('Ouvre le projet boutique')
  })

  it('drops what Whisper makes up on silence or music', () => {
    expect(cleanTranscript('[Musique]')).toBe('')
    expect(cleanTranscript('Sous-titrage ST’ 501')).toBe('')
    expect(cleanTranscript('Thanks for watching!')).toBe('')
    expect(cleanTranscript('Lance les tests du projet')).toBe('Lance les tests du projet')
  })
})

describe('transcribe', () => {
  it('measures silence', () => {
    expect(rms(new Float32Array(0))).toBe(0)
    expect(rms(Float32Array.from([0.5, -0.5]))).toBeCloseTo(0.5)
    expect(rms(new Float32Array(16_000).fill(0.001))).toBeLessThan(SILENCE_RMS)
  })

  it('gives nothing for silence or a click, without loading the model', async () => {
    expect(await transcribe(new Float32Array(16_000), 'base', 'fr', () => {})).toBe('')
    expect(await transcribe(voice(0.1), 'base', 'fr', () => {})).toBe('')
    expect(whisper.loads).toBe(0)
    await expect(transcribe('not audio', 'base', 'fr', () => {})).rejects.toThrow('Invalid audio')
  })

  it('asks Whisper in the language chosen, cleans what it says, and loads the model once', async () => {
    whisper.answer = ' Crée  une branche '
    expect(await transcribe(voice(2), 'base', 'fr', () => {})).toBe('Crée une branche')
    whisper.answer = [{ text: 'Run the' }, { text: 'tests' }]
    expect(await transcribe(voice(2), 'base', 'en', () => {})).toBe('Run the tests')
    expect(whisper.calls.map(c => c.language)).toEqual(['french', 'english'])
    expect(whisper.calls[0].chunk_length_s).toBeUndefined()
    expect(whisper.loads).toBe(1)
  })

  it('reads a long recording by windows, cut at two minutes', async () => {
    whisper.answer = 'long'
    await transcribe(voice(150), 'base', 'fr', () => {})
    expect(whisper.calls[0]).toMatchObject({ chunk_length_s: 30, stride_length_s: 5 })
  })

  it('tries the download again after a failure', async () => {
    whisper.fail = true
    await expect(transcribe(voice(1), 'small', 'fr', () => {})).rejects.toThrow('offline')
    whisper.fail = false
    whisper.answer = 'encore'
    expect(await transcribe(voice(1), 'small', 'fr', () => {})).toBe('encore')
  })
})

describe('the model on disk', () => {
  it('is ready once its ONNX files are there, and removed to free the space', () => {
    expect(dictationStatus('base')).toMatchObject({ model: 'base', downloaded: false, size: 0 })
    const dir = join(userData(), 'models', 'onnx-community', 'whisper-base', 'onnx')
    mkdirSync(dir, { recursive: true })
    writeFileSync(join(dir, 'encoder_model_quantized.onnx'), Buffer.alloc(2048))
    writeFileSync(join(dir, '..', 'config.json'), '{}')
    const ready = dictationStatus('base')
    expect(ready.downloaded).toBe(true)
    expect(ready.size).toBe(2050)
    expect(removeModel('base')).toMatchObject({ downloaded: false, loaded: false })
    expect(existsSync(dir)).toBe(false)
  })
})
