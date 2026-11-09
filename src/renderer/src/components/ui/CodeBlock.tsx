import type { CodeLanguage } from '@shared/lib/codeLanguage'
import { cn } from '@renderer/lib/cn'
import { useHighlighted } from '@renderer/lib/useHighlighted'

/** Code on the console's dark background, in the IDE's colours (as the file preview shows it) */
export default function CodeBlock({ code, language, label, className }: { code: string; language: CodeLanguage | null; label?: string; className?: string }) {
  const html = useHighlighted(code, language)
  return (
    <pre role="region" aria-label={label} tabIndex={0} data-language={language ?? undefined}
      className={cn('df-code overflow-auto rounded-card bg-console p-5 font-mono text-sm leading-relaxed text-fg', className)}>
      {/* highlight.js escapes the code: only its own <span> tags are added */}
      {html !== null ? <code dangerouslySetInnerHTML={{ __html: html }} /> : <code>{code}</code>}
    </pre>
  )
}
