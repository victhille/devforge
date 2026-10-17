import { useState, useEffect } from 'react'
import { Plus, Trash2, Copy, Check, Search } from 'lucide-react'
import { useI18n } from '../i18n/I18nContext'
import styles from './SnippetsPage.module.css'

interface Snippet {
  id:       string
  title:    string
  language: string
  code:     string
  tags:     string[]
  createdAt: string
}

const LANGUAGES = [
  'TypeScript', 'JavaScript', 'Python', 'Go', 'Rust', 'PHP', 'Java',
  'CSS', 'HTML', 'SQL', 'Bash', 'JSON', 'YAML', 'Markdown', 'Other'
]

const STORAGE_KEY = 'devforge:snippets'

function load(): Snippet[] {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') } catch { return [] }
}
function save(snippets: Snippet[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(snippets))
}

export default function SnippetsPage() {
  const { t } = useI18n()
  const [snippets, setSnippets]   = useState<Snippet[]>(load)
  const [selected, setSelected]   = useState<string | null>(null)
  const [search,   setSearch]     = useState('')
  const [copied,   setCopied]     = useState(false)
  const [dirty,    setDirty]      = useState(false)

  // Editable fields
  const [title,    setTitle]    = useState('')
  const [language, setLanguage] = useState('TypeScript')
  const [code,     setCode]     = useState('')
  const [tags,     setTags]     = useState('')

  useEffect(() => { save(snippets) }, [snippets])

  function selectSnippet(s: Snippet) {
    setSelected(s.id)
    setTitle(s.title)
    setLanguage(s.language)
    setCode(s.code)
    setTags(s.tags.join(', '))
    setDirty(false)
  }

  function newSnippet() {
    const s: Snippet = {
      id: crypto.randomUUID(),
      title: 'New Snippet',
      language: 'TypeScript',
      code: '',
      tags: [],
      createdAt: new Date().toISOString()
    }
    const updated = [s, ...snippets]
    setSnippets(updated)
    selectSnippet(s)
  }

  function saveSnippet() {
    setSnippets(prev => prev.map(s =>
      s.id === selected
        ? { ...s, title, language, code, tags: tags.split(',').map(t => t.trim()).filter(Boolean) }
        : s
    ))
    setDirty(false)
  }

  function deleteSnippet() {
    if (!selected) return
    const updated = snippets.filter(s => s.id !== selected)
    setSnippets(updated)
    setSelected(null)
    setTitle(''); setCode(''); setTags('')
  }

  function copyCode() {
    navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  function markDirty() { setDirty(true) }

  const filtered = snippets.filter(s => {
    const q = search.toLowerCase()
    return s.title.toLowerCase().includes(q) || s.language.toLowerCase().includes(q) || s.tags.some(t => t.toLowerCase().includes(q))
  })

  const current = snippets.find(s => s.id === selected)

  return (
    <div className={styles.page}>
      {/* ── Sidebar ── */}
      <div className={styles.listPanel}>
        <div className={styles.listHeader}>
          <div className={styles.searchBar}>
            <Search size={13} className={styles.searchIcon} />
            <input className={styles.searchInput} value={search} onChange={e => setSearch(e.target.value)} placeholder={t.snippets.search} />
          </div>
          <button className={styles.newBtn} onClick={newSnippet}>{t.snippets.newSnippet}</button>
        </div>

        <div className={styles.list}>
          {filtered.length === 0 ? (
            <div className={styles.empty}>{search ? t.snippets.noMatch : t.snippets.noSnippets}</div>
          ) : filtered.map(s => (
            <button
              key={s.id}
              className={`${styles.listItem} ${selected === s.id ? styles.activeItem : ''}`}
              onClick={() => selectSnippet(s)}
            >
              <div className={styles.listItemTitle}>{s.title}</div>
              <div className={styles.listItemMeta}>
                <span className={styles.langBadge}>{s.language}</span>
                {s.tags.slice(0, 2).map(tag => <span key={tag} className={styles.tag}>{tag}</span>)}
              </div>
            </button>
          ))}
        </div>

        <div className={styles.listFooter}>
          <span>{t.snippets.subtitle.replace('{n}', String(snippets.length)).replace('{s}', snippets.length !== 1 ? 's' : '')}</span>
        </div>
      </div>

      {/* ── Editor ── */}
      <div className={styles.editorPanel}>
        {!current ? (
          <div className={styles.editorEmpty}>
            <p>{t.snippets.noSnippets}</p>
            <button className={styles.btn} onClick={newSnippet}>{t.snippets.newSnippet}</button>
          </div>
        ) : (
          <>
            <div className={styles.editorHeader}>
              <input
                className={styles.titleInput}
                value={title}
                onChange={e => { setTitle(e.target.value); markDirty() }}
                placeholder={t.snippets.titlePlaceholder}
              />
              <div className={styles.editorActions}>
                {dirty && <span className={styles.unsaved}>{t.snippets.unsaved}</span>}
                <button className={styles.iconBtn} title={t.snippets.copy} onClick={copyCode}>
                  {copied ? <Check size={14} /> : <Copy size={14} />}
                </button>
                <button className={styles.iconBtn} title={t.snippets.delete} onClick={deleteSnippet} style={{ color: 'var(--danger)' }}>
                  <Trash2 size={14} />
                </button>
                <button className={styles.btn} onClick={saveSnippet}>{t.snippets.save}</button>
              </div>
            </div>

            <div className={styles.editorMeta}>
              <div className={styles.field}>
                <label className={styles.label}>{t.snippets.labelLang}</label>
                <select className={styles.select} value={language} onChange={e => { setLanguage(e.target.value); markDirty() }}>
                  {LANGUAGES.map(l => <option key={l}>{l}</option>)}
                </select>
              </div>
              <div className={styles.field} style={{ flex: 1 }}>
                <label className={styles.label}>{t.snippets.labelTags}</label>
                <input className={styles.input} value={tags} onChange={e => { setTags(e.target.value); markDirty() }} placeholder={t.snippets.tagsPlaceholder} />
              </div>
            </div>

            <div className={styles.codeWrap}>
              <label className={styles.label}>{t.snippets.labelCode}</label>
              <textarea
                className={styles.codeEditor}
                value={code}
                onChange={e => { setCode(e.target.value); markDirty() }}
                spellCheck={false}
              />
            </div>
          </>
        )}
      </div>
    </div>
  )
}
