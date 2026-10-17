import { useState } from 'react'
import { Send, Plus, Trash2, Copy, Check } from 'lucide-react'
import { useI18n } from '@renderer/i18n/I18nContext'
import styles from './ApiTesterPage.module.css'

type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
type ReqTab  = 'headers' | 'body'

interface Header { key: string; value: string }
interface Response {
  status:  number
  statusText: string
  time:    number
  size:    number
  body:    string
  headers: Record<string, string>
}

const METHOD_COLORS: Record<Method, string> = {
  GET:    '#3DD68C',
  POST:   '#4F8EF7',
  PUT:    '#F5A623',
  PATCH:  '#A78BFA',
  DELETE: '#F87171'
}

export default function ApiTesterPage() {
  const { t } = useI18n()
  const [method,   setMethod]   = useState<Method>('GET')
  const [url,      setUrl]      = useState('')
  const [headers,  setHeaders]  = useState<Header[]>([{ key: 'Content-Type', value: 'application/json' }])
  const [body,     setBody]     = useState('')
  const [reqTab,   setReqTab]   = useState<ReqTab>('headers')
  const [response, setResponse] = useState<Response | null>(null)
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState('')
  const [copied,   setCopied]   = useState(false)

  function addHeader() {
    setHeaders(h => [...h, { key: '', value: '' }])
  }

  function updateHeader(i: number, field: 'key' | 'value', val: string) {
    setHeaders(h => h.map((hdr, idx) => idx === i ? { ...hdr, [field]: val } : hdr))
  }

  function removeHeader(i: number) {
    setHeaders(h => h.filter((_, idx) => idx !== i))
  }

  async function send() {
    if (!url) return
    setLoading(true)
    setError('')
    setResponse(null)
    const start = Date.now()
    try {
      const hdrs: Record<string, string> = {}
      headers.filter(h => h.key).forEach(h => { hdrs[h.key] = h.value })
      const res = await fetch(url, {
        method,
        headers: hdrs,
        body: ['GET', 'HEAD'].includes(method) ? undefined : body || undefined
      })
      const text = await res.text()
      const elapsed = Date.now() - start
      const respHeaders: Record<string, string> = {}
      res.headers.forEach((v, k) => { respHeaders[k] = v })
      setResponse({
        status:     res.status,
        statusText: res.statusText,
        time:       elapsed,
        size:       new Blob([text]).size,
        body:       (() => { try { return JSON.stringify(JSON.parse(text), null, 2) } catch { return text } })(),
        headers:    respHeaders
      })
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t.apiTester.error)
    } finally {
      setLoading(false)
    }
  }

  function statusColor(s: number) {
    if (s < 300) return '#3DD68C'
    if (s < 400) return '#F5A623'
    return '#F87171'
  }

  function formatSize(bytes: number) {
    if (bytes < 1024) return `${bytes} B`
    return `${(bytes / 1024).toFixed(1)} KB`
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>{t.apiTester.title}</h1>
        <p className={styles.subtitle}>{t.apiTester.subtitle}</p>
      </div>

      {/* ── Request bar ── */}
      <div className={styles.requestBar}>
        <select
          className={styles.methodSelect}
          value={method}
          onChange={e => setMethod(e.target.value as Method)}
          style={{ color: METHOD_COLORS[method] }}
        >
          {(['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as Method[]).map(m => (
            <option key={m} value={m} style={{ color: METHOD_COLORS[m] }}>{m}</option>
          ))}
        </select>
        <input
          className={styles.urlInput}
          value={url}
          onChange={e => setUrl(e.target.value)}
          placeholder={t.apiTester.urlPlaceholder}
          onKeyDown={e => e.key === 'Enter' && send()}
        />
        <button className={styles.sendBtn} onClick={send} disabled={loading || !url}>
          <Send size={14} />
          {loading ? t.apiTester.sending : t.apiTester.send}
        </button>
      </div>

      <div className={styles.body}>
        {/* ── Request config ── */}
        <div className={styles.requestPanel}>
          <div className={styles.tabs}>
            {(['headers', 'body'] as ReqTab[]).map(tab => (
              <button
                key={tab}
                className={`${styles.tab} ${reqTab === tab ? styles.activeTab : ''}`}
                onClick={() => setReqTab(tab)}
              >
                {tab === 'headers' ? t.apiTester.tabHeaders : t.apiTester.tabBody}
              </button>
            ))}
          </div>

          {reqTab === 'headers' && (
            <div className={styles.headersPanel}>
              {headers.map((h, i) => (
                <div key={i} className={styles.headerRow}>
                  <input className={styles.headerInput} value={h.key}   onChange={e => updateHeader(i, 'key',   e.target.value)} placeholder={t.apiTester.key} />
                  <input className={styles.headerInput} value={h.value} onChange={e => updateHeader(i, 'value', e.target.value)} placeholder={t.apiTester.value} />
                  <button className={styles.iconBtn} onClick={() => removeHeader(i)}><Trash2 size={13} /></button>
                </div>
              ))}
              <button className={styles.addBtn} onClick={addHeader}><Plus size={13} /> {t.apiTester.addHeader}</button>
            </div>
          )}

          {reqTab === 'body' && (
            <textarea
              className={styles.bodyTextarea}
              value={body}
              onChange={e => setBody(e.target.value)}
              placeholder={t.apiTester.bodyPlaceholder}
              spellCheck={false}
            />
          )}
        </div>

        {/* ── Response ── */}
        <div className={styles.responsePanel}>
          {error && (
            <div className={styles.errorMsg}>{error}</div>
          )}
          {!response && !error && (
            <div className={styles.empty}>{t.apiTester.noResponse}</div>
          )}
          {response && (
            <>
              <div className={styles.responseMeta}>
                <span className={styles.statusBadge} style={{ color: statusColor(response.status), background: `${statusColor(response.status)}20`, borderColor: `${statusColor(response.status)}40` }}>
                  {response.status} {response.statusText}
                </span>
                <span className={styles.metaItem}>{t.apiTester.time}: <strong>{response.time}ms</strong></span>
                <span className={styles.metaItem}>{t.apiTester.size}: <strong>{formatSize(response.size)}</strong></span>
                <button className={styles.iconBtn} style={{ marginLeft: 'auto' }} onClick={() => { navigator.clipboard.writeText(response.body); setCopied(true); setTimeout(() => setCopied(false), 1500) }}>
                  {copied ? <Check size={13} /> : <Copy size={13} />}
                </button>
              </div>
              <pre className={styles.responseBody}>{response.body}</pre>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
