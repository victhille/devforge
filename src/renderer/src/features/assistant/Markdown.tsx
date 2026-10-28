import type { ReactNode } from 'react'
import CopyButton from '@renderer/components/ui/CopyButton'

/**
 * Small Markdown renderer for assistant answers: headings, lists, quotes,
 * tables, fenced code, inline code, bold, italic, links. Builds React
 * elements only (no HTML injection).
 */

function inline(text: string, key = 0): ReactNode[] {
  const out: ReactNode[] = []
  const re = /`([^`]+)`|\*\*(.+?)\*\*|\*([^*\s][^*]*?)\*|_([^_\s][^_]*?)_|\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g
  let last = 0
  for (const m of text.matchAll(re)) {
    if (m.index > last) out.push(text.slice(last, m.index))
    const k = `${key}-${m.index}`
    if (m[1] !== undefined) out.push(<code key={k} className="rounded bg-active px-1 py-px font-mono text-[0.85em] text-fg">{m[1]}</code>)
    else if (m[2] !== undefined) out.push(<strong key={k} className="font-semibold text-fg">{inline(m[2], key + 1)}</strong>)
    else if (m[3] !== undefined || m[4] !== undefined) out.push(<em key={k}>{m[3] ?? m[4]}</em>)
    else {
      const url = m[6]
      out.push(<button key={k} onClick={() => window.devforge.openExternal(url)} className="text-accent hover:underline">{m[5]}</button>)
    }
    last = m.index + m[0].length
  }
  if (last < text.length) out.push(text.slice(last))
  return out
}

const isTableSep = (l: string) => /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(l)
const cells = (l: string) => l.trim().replace(/^\||\|$/g, '').split('|').map(c => c.trim())

/** `asDocument`: a project's .md file (v3.5.1), with real, larger headings */
export default function Markdown({ text, asDocument = false }: { text: string; asDocument?: boolean }) {
  const lines = text.split('\n')
  const blocks: ReactNode[] = []
  let i = 0
  while (i < lines.length) {
    const line = lines[i]

    // Fenced code (an unclosed fence while streaming renders as code too)
    const fence = line.match(/^\s*```(\S*)/)
    if (fence) {
      const code: string[] = []
      i++
      while (i < lines.length && !/^\s*```\s*$/.test(lines[i])) code.push(lines[i++])
      i++
      const body = code.join('\n')
      blocks.push(
        <div key={blocks.length} className="overflow-hidden rounded-lg border border-line-subtle bg-console">
          <div className="flex items-center justify-between border-b border-line-subtle px-3 py-1 text-2xs text-fg-muted">
            <span className="font-mono">{fence[1] || 'code'}</span>
            <CopyButton text={body} />
          </div>
          <pre className="overflow-x-auto p-3 font-mono text-xs leading-relaxed text-fg-secondary">{body}</pre>
        </div>
      )
      continue
    }

    const heading = line.match(/^(#{1,6})\s+(.*)$/)
    if (heading && asDocument) {
      // A file read as a document: real headings, sized by level
      const level = Math.min(heading[1].length, 4) as 1 | 2 | 3 | 4
      const Tag = `h${level}` as const
      const size = { 1: 'mt-2 border-b border-line-subtle pb-1.5 text-2xl', 2: 'mt-3 border-b border-line-subtle pb-1 text-xl', 3: 'mt-2 text-lg', 4: 'mt-1 text-md' }[level]
      blocks.push(<Tag key={blocks.length} className={`${size} font-semibold text-fg`}>{inline(heading[2])}</Tag>)
      i++
      continue
    }
    if (heading) {
      const size = heading[1].length <= 2 ? 'text-md' : 'text-sm'
      blocks.push(<p key={blocks.length} className={`${size} mt-1 font-semibold text-fg`}>{inline(heading[2])}</p>)
      i++
      continue
    }

    // Table: header row + separator
    if (line.includes('|') && i + 1 < lines.length && isTableSep(lines[i + 1])) {
      const head = cells(line)
      const rows: string[][] = []
      i += 2
      while (i < lines.length && lines[i].includes('|') && lines[i].trim()) rows.push(cells(lines[i++]))
      blocks.push(
        <div key={blocks.length} className="overflow-x-auto rounded-lg border border-line-subtle">
          <table className="w-full border-collapse text-xs">
            <thead className="bg-elevated"><tr>{head.map((h, j) => <th key={j} className="border-b border-line-subtle px-2.5 py-1.5 text-left font-semibold text-fg">{inline(h)}</th>)}</tr></thead>
            <tbody>{rows.map((r, ri) => <tr key={ri}>{r.map((c, j) => <td key={j} className="border-b border-line-subtle px-2.5 py-1.5 align-top text-fg-secondary">{inline(c)}</td>)}</tr>)}</tbody>
          </table>
        </div>
      )
      continue
    }

    // Lists (bullets or numbers), consecutive lines
    if (/^\s*([-*•]|\d+[.)])\s+/.test(line)) {
      const ordered = /^\s*\d/.test(line)
      const items: { indent: number; text: string }[] = []
      while (i < lines.length && /^\s*([-*•]|\d+[.)])\s+/.test(lines[i])) {
        const m = lines[i].match(/^(\s*)([-*•]|\d+[.)])\s+(.*)$/)!
        items.push({ indent: m[1].length, text: m[3] })
        i++
      }
      const Tag = ordered ? 'ol' : 'ul'
      blocks.push(
        <Tag key={blocks.length} className={`${ordered ? 'list-decimal' : 'list-disc'} flex flex-col gap-1 pl-5 marker:text-fg-muted`}>
          {items.map((it, j) => <li key={j} style={{ marginLeft: it.indent * 6 }}>{inline(it.text)}</li>)}
        </Tag>
      )
      continue
    }

    if (line.startsWith('>')) {
      const quote: string[] = []
      while (i < lines.length && lines[i].startsWith('>')) quote.push(lines[i++].replace(/^>\s?/, ''))
      blocks.push(<blockquote key={blocks.length} className="border-l-2 border-accent pl-3 text-fg-muted">{inline(quote.join(' '))}</blockquote>)
      continue
    }

    if (!line.trim()) { i++; continue }

    // Paragraph: until a blank line or another block
    const para: string[] = []
    while (i < lines.length && lines[i].trim() && !/^\s*(```|#{1,6}\s|[-*•]\s|\d+[.)]\s|>)/.test(lines[i])) para.push(lines[i++])
    if (!para.length) para.push(lines[i++])
    blocks.push(<p key={blocks.length}>{inline(para.join(' '))}</p>)
  }
  return <div className="flex flex-col gap-2.5 text-sm leading-relaxed text-fg-secondary">{blocks}</div>
}
