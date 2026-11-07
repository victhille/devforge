import { useMemo, useState, type ReactNode } from 'react'
import Badge from '@renderer/components/ui/Badge'
import { Input } from '@renderer/components/ui/Input'
import { useI18n } from '@renderer/i18n/I18nContext'
import ToolHelp from '@renderer/components/ui/ToolHelp'
import { REGEX_MODELS, type RegexModel } from '../../examples'
import { IoGrid, IoPanel, IO_TEXTAREA, type ToolboxT } from '../IoPanel'

type Result = { count: number; nodes: ReactNode[] } | { error: true }

/** Split `text` into plain and highlighted parts for each match. */
function highlight(text: string, pattern: string, flags: string): Result {
  try {
    const global = flags.includes('g')
    const re = new RegExp(pattern, global ? flags : flags + 'g')
    const nodes: ReactNode[] = []
    let last = 0
    let count = 0
    for (const m of text.matchAll(re)) {
      if (m[0] === '') continue
      const start = m.index ?? 0
      nodes.push(text.slice(last, start))
      nodes.push(<mark key={start} className="rounded-sm bg-warning/30 text-fg">{m[0]}</mark>)
      last = start + m[0].length
      count++
      if (!global) break
    }
    nodes.push(text.slice(last))
    return { count, nodes }
  } catch {
    return { error: true }
  }
}

export default function RegexTool({ t }: { t: ToolboxT }) {
  const [pattern, setPattern] = useState('')
  const [flags, setFlags]     = useState('g')
  const [text, setText]       = useState('')
  const h = useI18n().t.toolHelp
  const pickModel = (m: RegexModel) => { setPattern(REGEX_MODELS[m].pattern); setFlags(REGEX_MODELS[m].flags); setText(REGEX_MODELS[m].text) }

  // Live result, updated on every keystroke
  const result = useMemo(() => (pattern ? highlight(text, pattern, flags) : null), [text, pattern, flags])

  return (
    <>
      <ToolHelp id="regex" what={h.regex.what} how={h.regex.how}
        examples={(Object.keys(REGEX_MODELS) as RegexModel[]).map(m => ({ label: h.regex.models[m], onPick: () => pickModel(m) }))} />
      <div className="flex shrink-0 items-center gap-1 font-mono">
        <span className="text-lg text-fg-muted">/</span>
        <Input value={pattern} onChange={e => setPattern(e.target.value)} placeholder={h.regex.patternHint} aria-label={t.pattern} spellCheck={false} className="font-mono" />
        <span className="text-lg text-fg-muted">/</span>
        <Input value={flags} onChange={e => setFlags(e.target.value)} placeholder="gi" aria-label={t.flags} spellCheck={false} className="w-20 font-mono" />
      </div>
      <IoGrid>
        <IoPanel label={t.input}>
          <textarea className={IO_TEXTAREA} value={text} onChange={e => setText(e.target.value)} placeholder={h.regex.textHint} aria-label={t.input} spellCheck={false} />
        </IoPanel>
        <IoPanel
          label={t.output}
          actions={result && !('error' in result) && <Badge color="accent">{result.count} {t.matches}</Badge>}
        >
          <div className="flex-1 overflow-auto p-3 font-mono text-sm leading-relaxed whitespace-pre-wrap break-all text-fg-secondary">
            {!result ? <span className="text-fg-muted">{t.noMatch}</span>
              : 'error' in result ? <span className="text-danger">{t.invalid}</span>
              : result.nodes}
          </div>
        </IoPanel>
      </IoGrid>
    </>
  )
}
