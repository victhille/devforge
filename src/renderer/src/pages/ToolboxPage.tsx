import { useState } from 'react'
import { Copy, Check, Trash2 } from 'lucide-react'
import { useI18n } from '../i18n/I18nContext'
import styles from './ToolboxPage.module.css'

type Tab = 'json' | 'base64' | 'jwt' | 'regex' | 'uuid' | 'hash'

function copyToClipboard(text: string, setCopied: (v: boolean) => void) {
  navigator.clipboard.writeText(text)
  setCopied(true)
  setTimeout(() => setCopied(false), 1500)
}

// ── JSON ─────────────────────────────────────────────────────────────────────

function JsonTool({ t }: { t: ReturnType<typeof useI18n>['t']['toolbox'] }) {
  const [input, setInput]   = useState('')
  const [output, setOutput] = useState('')
  const [error, setError]   = useState('')
  const [copied, setCopied] = useState(false)

  function format() {
    try { setOutput(JSON.stringify(JSON.parse(input), null, 2)); setError('') }
    catch { setError(t.invalid); setOutput('') }
  }
  function minify() {
    try { setOutput(JSON.stringify(JSON.parse(input))); setError('') }
    catch { setError(t.invalid); setOutput('') }
  }

  return (
    <div className={styles.tool}>
      <div className={styles.panels}>
        <div className={styles.panel}>
          <div className={styles.panelHeader}>
            <span>{t.input}</span>
            <button className={styles.iconBtn} onClick={() => { setInput(''); setOutput(''); setError('') }}><Trash2 size={13} /></button>
          </div>
          <textarea className={styles.textarea} value={input} onChange={e => setInput(e.target.value)} placeholder='{"key": "value"}' spellCheck={false} />
        </div>
        <div className={styles.panel}>
          <div className={styles.panelHeader}>
            <span>{t.output}</span>
            {output && <button className={styles.iconBtn} onClick={() => copyToClipboard(output, setCopied)}>{copied ? <Check size={13} /> : <Copy size={13} />}</button>}
          </div>
          <textarea className={styles.textarea} value={error || output} readOnly spellCheck={false} style={error ? { color: 'var(--danger)' } : {}} />
        </div>
      </div>
      <div className={styles.actions}>
        <button className={styles.btn} onClick={format}>{t.format}</button>
        <button className={styles.btn} onClick={minify}>{t.minify}</button>
      </div>
    </div>
  )
}

// ── Base64 ────────────────────────────────────────────────────────────────────

function Base64Tool({ t }: { t: ReturnType<typeof useI18n>['t']['toolbox'] }) {
  const [input, setInput]   = useState('')
  const [output, setOutput] = useState('')
  const [copied, setCopied] = useState(false)

  return (
    <div className={styles.tool}>
      <div className={styles.panels}>
        <div className={styles.panel}>
          <div className={styles.panelHeader}><span>{t.input}</span></div>
          <textarea className={styles.textarea} value={input} onChange={e => setInput(e.target.value)} placeholder="Text to encode / base64 to decode..." spellCheck={false} />
        </div>
        <div className={styles.panel}>
          <div className={styles.panelHeader}>
            <span>{t.output}</span>
            {output && <button className={styles.iconBtn} onClick={() => copyToClipboard(output, setCopied)}>{copied ? <Check size={13} /> : <Copy size={13} />}</button>}
          </div>
          <textarea className={styles.textarea} value={output} readOnly spellCheck={false} />
        </div>
      </div>
      <div className={styles.actions}>
        <button className={styles.btn} onClick={() => setOutput(btoa(unescape(encodeURIComponent(input))))}>{t.encode}</button>
        <button className={styles.btn} onClick={() => { try { setOutput(decodeURIComponent(escape(atob(input)))) } catch { setOutput(t.invalid) } }}>{t.decode}</button>
      </div>
    </div>
  )
}

// ── JWT ───────────────────────────────────────────────────────────────────────

function JwtTool({ t }: { t: ReturnType<typeof useI18n>['t']['toolbox'] }) {
  const [input, setInput]   = useState('')
  const [output, setOutput] = useState('')

  function decode() {
    try {
      const parts = input.trim().split('.')
      if (parts.length !== 3) throw new Error('Invalid JWT')
      const header  = JSON.parse(atob(parts[0].replace(/-/g, '+').replace(/_/g, '/')))
      const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')))
      setOutput(JSON.stringify({ header, payload }, null, 2))
    } catch {
      setOutput(t.invalid)
    }
  }

  return (
    <div className={styles.tool}>
      <div className={styles.panels}>
        <div className={styles.panel}>
          <div className={styles.panelHeader}><span>JWT Token</span></div>
          <textarea className={styles.textarea} value={input} onChange={e => setInput(e.target.value)} placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." spellCheck={false} />
        </div>
        <div className={styles.panel}>
          <div className={styles.panelHeader}><span>Decoded</span></div>
          <textarea className={styles.textarea} value={output} readOnly spellCheck={false} />
        </div>
      </div>
      <div className={styles.actions}>
        <button className={styles.btn} onClick={decode}>{t.decode}</button>
      </div>
    </div>
  )
}

// ── Regex ─────────────────────────────────────────────────────────────────────

function RegexTool({ t }: { t: ReturnType<typeof useI18n>['t']['toolbox'] }) {
  const [pattern, setPattern] = useState('')
  const [flags, setFlags]     = useState('g')
  const [text, setText]       = useState('')
  const [result, setResult]   = useState<{ count: number; highlighted: string } | null>(null)

  function test() {
    try {
      const re = new RegExp(pattern, flags)
      const matches = [...text.matchAll(new RegExp(pattern, flags.includes('g') ? flags : flags + 'g'))]
      const highlighted = text.replace(re, m => `__MATCH__${m}__ENDMATCH__`)
      setResult({ count: matches.length, highlighted })
    } catch {
      setResult({ count: 0, highlighted: t.invalid })
    }
  }

  return (
    <div className={styles.tool}>
      <div className={styles.regexBar}>
        <span className={styles.slash}>/</span>
        <input className={styles.regexInput} value={pattern} onChange={e => setPattern(e.target.value)} placeholder={t.pattern} spellCheck={false} />
        <span className={styles.slash}>/</span>
        <input className={styles.flagsInput} value={flags} onChange={e => setFlags(e.target.value)} placeholder={t.flags} spellCheck={false} />
      </div>
      <div className={styles.panels}>
        <div className={styles.panel}>
          <div className={styles.panelHeader}><span>{t.input}</span></div>
          <textarea className={styles.textarea} value={text} onChange={e => setText(e.target.value)} placeholder="Text to test against..." spellCheck={false} />
        </div>
        <div className={styles.panel}>
          <div className={styles.panelHeader}>
            <span>{t.output}</span>
            {result && <span className={styles.matchCount}>{result.count} {t.matches}</span>}
          </div>
          <div className={styles.regexResult}>
            {result ? result.highlighted.split('__MATCH__').map((part, i) => {
              if (i === 0) return <span key={i}>{part}</span>
              const [match, rest] = part.split('__ENDMATCH__')
              return <span key={i}><mark className={styles.match}>{match}</mark>{rest}</span>
            }) : <span className={styles.muted}>{t.noMatch}</span>}
          </div>
        </div>
      </div>
      <div className={styles.actions}>
        <button className={styles.btn} onClick={test}>{t.test}</button>
      </div>
    </div>
  )
}

// ── UUID ──────────────────────────────────────────────────────────────────────

function UuidTool({ t }: { t: ReturnType<typeof useI18n>['t']['toolbox'] }) {
  const [uuids, setUuids]   = useState<string[]>([])
  const [count, setCount]   = useState(5)
  const [copied, setCopied] = useState<number | null>(null)

  function generate() {
    const list: string[] = []
    for (let i = 0; i < count; i++) {
      list.push('xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
        const r = crypto.getRandomValues(new Uint8Array(1))[0] & 15
        return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16)
      }))
    }
    setUuids(list)
  }

  return (
    <div className={styles.tool}>
      <div className={styles.uuidControls}>
        <label className={styles.label}>Count</label>
        <input type="number" className={styles.numberInput} value={count} min={1} max={20} onChange={e => setCount(Number(e.target.value))} />
        <button className={styles.btn} onClick={generate}>{t.generate}</button>
      </div>
      <div className={styles.uuidList}>
        {uuids.map((u, i) => (
          <div key={i} className={styles.uuidItem}>
            <span className={styles.uuidText}>{u}</span>
            <button className={styles.iconBtn} onClick={() => { copyToClipboard(u, () => {}); setCopied(i); setTimeout(() => setCopied(null), 1500) }}>
              {copied === i ? <Check size={13} /> : <Copy size={13} />}
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Hash ──────────────────────────────────────────────────────────────────────

function HashTool({ t }: { t: ReturnType<typeof useI18n>['t']['toolbox'] }) {
  const [input, setInput]   = useState('')
  const [algo, setAlgo]     = useState('SHA-256')
  const [output, setOutput] = useState('')
  const [copied, setCopied] = useState(false)

  async function hash() {
    const enc = new TextEncoder()
    const buf = await crypto.subtle.digest(algo, enc.encode(input))
    const hex = Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('')
    setOutput(hex)
  }

  return (
    <div className={styles.tool}>
      <div className={styles.hashControls}>
        <label className={styles.label}>{t.algorithm}</label>
        <select className={styles.select} value={algo} onChange={e => setAlgo(e.target.value)}>
          {['SHA-1', 'SHA-256', 'SHA-384', 'SHA-512'].map(a => <option key={a}>{a}</option>)}
        </select>
      </div>
      <div className={styles.panels}>
        <div className={styles.panel}>
          <div className={styles.panelHeader}><span>{t.input}</span></div>
          <textarea className={styles.textarea} value={input} onChange={e => setInput(e.target.value)} placeholder="Text to hash..." spellCheck={false} />
        </div>
        <div className={styles.panel}>
          <div className={styles.panelHeader}>
            <span>{t.output}</span>
            {output && <button className={styles.iconBtn} onClick={() => copyToClipboard(output, setCopied)}>{copied ? <Check size={13} /> : <Copy size={13} />}</button>}
          </div>
          <textarea className={styles.textarea} value={output} readOnly spellCheck={false} style={{ fontFamily: 'var(--font-mono)', fontSize: '11px' }} />
        </div>
      </div>
      <div className={styles.actions}>
        <button className={styles.btn} onClick={hash}>{t.generate}</button>
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

const TABS: { id: Tab; labelKey: keyof ReturnType<typeof useI18n>['t']['toolbox'] }[] = [
  { id: 'json',   labelKey: 'tabJson' },
  { id: 'base64', labelKey: 'tabBase64' },
  { id: 'jwt',    labelKey: 'tabJwt' },
  { id: 'regex',  labelKey: 'tabRegex' },
  { id: 'uuid',   labelKey: 'tabUuid' },
  { id: 'hash',   labelKey: 'tabHash' },
]

export default function ToolboxPage() {
  const { t } = useI18n()
  const [activeTab, setActiveTab] = useState<Tab>('json')

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>{t.toolbox.title}</h1>
        <p className={styles.subtitle}>{t.toolbox.subtitle}</p>
      </div>

      <div className={styles.tabs}>
        {TABS.map(tab => (
          <button
            key={tab.id}
            className={`${styles.tab} ${activeTab === tab.id ? styles.activeTab : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {t.toolbox[tab.labelKey] as string}
          </button>
        ))}
      </div>

      <div className={styles.content}>
        {activeTab === 'json'   && <JsonTool   t={t.toolbox} />}
        {activeTab === 'base64' && <Base64Tool t={t.toolbox} />}
        {activeTab === 'jwt'    && <JwtTool    t={t.toolbox} />}
        {activeTab === 'regex'  && <RegexTool  t={t.toolbox} />}
        {activeTab === 'uuid'   && <UuidTool   t={t.toolbox} />}
        {activeTab === 'hash'   && <HashTool   t={t.toolbox} />}
      </div>
    </div>
  )
}
