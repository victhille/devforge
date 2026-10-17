import { useState } from 'react'
import { Copy, Check, RefreshCw } from 'lucide-react'
import { useI18n } from '@renderer/i18n/I18nContext'
import styles from './GeneratorPage.module.css'

function useCopy() {
  const [copied, setCopied] = useState<string | null>(null)
  function copy(text: string, key: string) {
    navigator.clipboard.writeText(text)
    setCopied(key)
    setTimeout(() => setCopied(null), 1500)
  }
  return { copied, copy }
}

// ── Password ─────────────────────────────────────────────────────────────────

const UPPER   = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
const LOWER   = 'abcdefghijklmnopqrstuvwxyz'
const NUMBERS = '0123456789'
const SYMBOLS = '!@#$%^&*()_+-=[]{}|;:,.<>?'

function generatePassword(length: number, upper: boolean, lower: boolean, nums: boolean, syms: boolean) {
  let chars = ''
  if (upper)  chars += UPPER
  if (lower)  chars += LOWER
  if (nums)   chars += NUMBERS
  if (syms)   chars += SYMBOLS
  if (!chars) chars = LOWER + NUMBERS
  const arr = crypto.getRandomValues(new Uint8Array(length))
  return Array.from(arr).map(b => chars[b % chars.length]).join('')
}

function PasswordSection({ t, k: { copied, copy } }: { t: ReturnType<typeof useI18n>['t']['generator'], k: ReturnType<typeof useCopy> }) {
  const [length,  setLength]  = useState(16)
  const [upper,   setUpper]   = useState(true)
  const [lower,   setLower]   = useState(true)
  const [nums,    setNums]    = useState(true)
  const [syms,    setSyms]    = useState(false)
  const [result,  setResult]  = useState('')

  function gen() {
    setResult(generatePassword(length, upper, lower, nums, syms))
  }

  return (
    <div className={styles.section}>
      <h2 className={styles.sectionTitle}>{t.sectionPass}</h2>
      <div className={styles.controls}>
        <div className={styles.field}>
          <label className={styles.label}>{t.length}: <strong>{length}</strong></label>
          <input type="range" min={8} max={64} value={length} onChange={e => setLength(Number(e.target.value))} className={styles.slider} />
        </div>
        <div className={styles.checkboxes}>
          {[
            { label: t.uppercase, value: upper, set: setUpper },
            { label: t.lowercase, value: lower, set: setLower },
            { label: t.numbers,   value: nums,  set: setNums },
            { label: t.symbols,   value: syms,  set: setSyms },
          ].map(({ label, value, set }) => (
            <label key={label} className={styles.checkbox}>
              <input type="checkbox" checked={value} onChange={e => set(e.target.checked)} />
              {label}
            </label>
          ))}
        </div>
      </div>
      <div className={styles.resultRow}>
        <div className={styles.resultBox}>{result || <span className={styles.placeholder}>Click Generate</span>}</div>
        <button className={styles.iconBtn} onClick={gen}><RefreshCw size={14} /></button>
        {result && (
          <button className={styles.iconBtn} onClick={() => copy(result, 'pass')}>
            {copied === 'pass' ? <Check size={14} /> : <Copy size={14} />}
          </button>
        )}
        <button className={styles.btn} onClick={gen}>{t.generate}</button>
      </div>
    </div>
  )
}

// ── Secret / Token ────────────────────────────────────────────────────────────

type SecretFormat = 'hex' | 'base64' | 'alpha'

function SecretSection({ t, k: { copied, copy } }: { t: ReturnType<typeof useI18n>['t']['generator'], k: ReturnType<typeof useCopy> }) {
  const [bytes,  setBytes]  = useState(32)
  const [format, setFormat] = useState<SecretFormat>('hex')
  const [result, setResult] = useState('')

  function gen() {
    const arr = crypto.getRandomValues(new Uint8Array(bytes))
    if (format === 'hex') {
      setResult(Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join(''))
    } else if (format === 'base64') {
      setResult(btoa(String.fromCharCode(...arr)).replace(/=/g, ''))
    } else {
      const alpha = LOWER + NUMBERS
      setResult(Array.from(arr).map(b => alpha[b % alpha.length]).join(''))
    }
  }

  return (
    <div className={styles.section}>
      <h2 className={styles.sectionTitle}>{t.sectionSecret}</h2>
      <div className={styles.controls}>
        <div className={styles.field}>
          <label className={styles.label}>{t.bytes}: <strong>{bytes}</strong></label>
          <input type="range" min={8} max={64} value={bytes} onChange={e => setBytes(Number(e.target.value))} className={styles.slider} />
        </div>
        <div className={styles.field}>
          <label className={styles.label}>{t.format}</label>
          <div className={styles.formatBtns}>
            {(['hex', 'base64', 'alpha'] as SecretFormat[]).map(f => (
              <button key={f} className={`${styles.formatBtn} ${format === f ? styles.activeFormat : ''}`} onClick={() => setFormat(f)}>
                {f === 'hex' ? t.formatHex : f === 'base64' ? t.formatBase64 : t.formatAlpha}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className={styles.resultRow}>
        <div className={`${styles.resultBox} ${styles.mono}`}>{result || <span className={styles.placeholder}>Click Generate</span>}</div>
        <button className={styles.iconBtn} onClick={gen}><RefreshCw size={14} /></button>
        {result && (
          <button className={styles.iconBtn} onClick={() => copy(result, 'secret')}>
            {copied === 'secret' ? <Check size={14} /> : <Copy size={14} />}
          </button>
        )}
        <button className={styles.btn} onClick={gen}>{t.generate}</button>
      </div>
    </div>
  )
}

// ── UUID ──────────────────────────────────────────────────────────────────────

function UuidSection({ t, k: { copied, copy } }: { t: ReturnType<typeof useI18n>['t']['generator'], k: ReturnType<typeof useCopy> }) {
  const [results, setResults] = useState<string[]>([])

  function gen() {
    const uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = crypto.getRandomValues(new Uint8Array(1))[0] & 15
      return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16)
    })
    setResults(prev => [uuid, ...prev.slice(0, 9)])
  }

  return (
    <div className={styles.section}>
      <h2 className={styles.sectionTitle}>{t.sectionUuid}</h2>
      <div className={styles.actions}>
        <button className={styles.btn} onClick={gen}>{t.generate}</button>
      </div>
      <div className={styles.uuidList}>
        {results.map((u, i) => (
          <div key={i} className={styles.uuidItem}>
            <span className={styles.uuidText}>{u}</span>
            <button className={styles.iconBtn} onClick={() => copy(u, `uuid-${i}`)}>
              {copied === `uuid-${i}` ? <Check size={13} /> : <Copy size={13} />}
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function GeneratorPage() {
  const { t } = useI18n()
  const copyState = useCopy()

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>{t.generator.title}</h1>
        <p className={styles.subtitle}>{t.generator.subtitle}</p>
      </div>
      <div className={styles.grid}>
        <PasswordSection t={t.generator} k={copyState} />
        <SecretSection   t={t.generator} k={copyState} />
        <UuidSection     t={t.generator} k={copyState} />
      </div>
    </div>
  )
}
