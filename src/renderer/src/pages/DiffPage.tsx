import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import { useI18n } from '../i18n/I18nContext'
import styles from './DiffPage.module.css'

type DiffType = 'equal' | 'add' | 'remove'
interface DiffLine { type: DiffType; text: string }

function computeDiff(a: string, b: string): DiffLine[] {
  const aLines = a.split('\n')
  const bLines = b.split('\n')
  const m = aLines.length
  const n = bLines.length

  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0))
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = aLines[i - 1] === bLines[j - 1] ? dp[i - 1][j - 1] + 1 : Math.max(dp[i - 1][j], dp[i][j - 1])

  const result: DiffLine[] = []
  let i = m, j = n
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && aLines[i - 1] === bLines[j - 1]) {
      result.unshift({ type: 'equal', text: aLines[i - 1] }); i--; j--
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      result.unshift({ type: 'add', text: bLines[j - 1] }); j--
    } else {
      result.unshift({ type: 'remove', text: aLines[i - 1] }); i--
    }
  }
  return result
}

export default function DiffPage() {
  const { t } = useI18n()
  const [left,  setLeft]  = useState('')
  const [right, setRight] = useState('')

  const diff   = left || right ? computeDiff(left, right) : []
  const added   = diff.filter(d => d.type === 'add').length
  const removed = diff.filter(d => d.type === 'remove').length

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>{t.diff.title}</h1>
          <p className={styles.subtitle}>{t.diff.subtitle}</p>
        </div>
        {(left || right) && (
          <button className={styles.clearBtn} onClick={() => { setLeft(''); setRight('') }}>
            <Trash2 size={13} /> {t.diff.clear}
          </button>
        )}
      </div>

      {/* ── Input panels ── */}
      <div className={styles.inputs}>
        <div className={styles.inputPanel}>
          <div className={styles.panelLabel}>{t.diff.original}</div>
          <textarea className={styles.textarea} value={left}  onChange={e => setLeft(e.target.value)}  spellCheck={false} placeholder="Paste original text here..." />
        </div>
        <div className={styles.inputPanel}>
          <div className={styles.panelLabel}>{t.diff.modified}</div>
          <textarea className={styles.textarea} value={right} onChange={e => setRight(e.target.value)} spellCheck={false} placeholder="Paste modified text here..." />
        </div>
      </div>

      {/* ── Result ── */}
      <div className={styles.resultPanel}>
        <div className={styles.resultHeader}>
          <span className={styles.panelLabel}>{t.diff.result}</span>
          {diff.length > 0 && (
            <div className={styles.stats}>
              <span className={styles.statAdd}>+{added} {t.diff.added}</span>
              <span className={styles.statRemove}>-{removed} {t.diff.removed}</span>
            </div>
          )}
        </div>
        <div className={styles.diffOutput}>
          {diff.length === 0 ? (
            <span className={styles.empty}>{t.diff.noInput}</span>
          ) : diff.map((line, i) => (
            <div key={i} className={`${styles.diffLine} ${styles[line.type]}`}>
              <span className={styles.linePrefix}>
                {line.type === 'add' ? '+' : line.type === 'remove' ? '-' : ' '}
              </span>
              <span className={styles.lineText}>{line.text || ' '}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
