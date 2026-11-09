import { useEffect, useState } from 'react'
import type { CodeLanguage } from '@shared/lib/codeLanguage'

/** Past this size the code is shown without colours: highlighting it would stall the page */
export const HIGHLIGHT_LIMIT = 300 * 1024

/**
 * Code in the IDE's colours: highlight.js's HTML (the code escaped, only its
 * own spans added), loaded with the first block; null until then, without a
 * language, or for a code too big.
 */
export function useHighlighted(code: string, language: CodeLanguage | null): string | null {
  const [html, setHtml] = useState<string | null>(null)
  useEffect(() => {
    let alive = true
    setHtml(null)
    if (language && code.length <= HIGHLIGHT_LIMIT) import('./highlighter').then(m => { if (alive) setHtml(m.highlight(code, language)) }).catch(() => {})
    return () => { alive = false }
  }, [code, language])
  return html
}
