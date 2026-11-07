/**
 * v3.8.1: a project's notes are formatted text (HTML from the editor). Notes
 * written before, in Markdown, are converted the first time they are opened.
 */

/** HTML from the editor, or Markdown from v3.8.0 */
export const isHtmlNotes = (notes: string) => /^\s*</.test(notes)

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/** Bold, italics, code, inline */
const inline = (s: string) => esc(s)
  .replace(/`([^`]+)`/g, '<code>$1</code>')
  .replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>')
  .replace(/(^|[^*])\*([^*\s][^*]*)\*/g, '$1<i>$2</i>')
  .replace(/~~([^~]+)~~/g, '<s>$1</s>')

/** The Markdown the notes used: headings, lists, quotes, code blocks, paragraphs */
export function markdownToHtml(md: string): string {
  const out: string[] = []
  const lines = md.replace(/\r\n?/g, '\n').split('\n')
  let list: 'ul' | 'ol' | null = null
  const close = () => { if (list) { out.push(`</${list}>`); list = null } }
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (/^```/.test(line)) {
      close()
      const code: string[] = []
      while (++i < lines.length && !/^```/.test(lines[i])) code.push(lines[i])
      out.push(`<pre>${esc(code.join('\n'))}</pre>`)
      continue
    }
    const h = /^(#{1,3})\s+(.*)$/.exec(line)
    const ul = /^\s*[-*+]\s+(?:\[[ xX]\]\s+)?(.*)$/.exec(line)
    const ol = /^\s*\d+[.)]\s+(.*)$/.exec(line)
    if (h) { close(); out.push(`<h${h[1].length}>${inline(h[2])}</h${h[1].length}>`) }
    else if (ul || ol) {
      const kind = ul ? 'ul' : 'ol'
      if (list !== kind) { close(); out.push(`<${kind}>`); list = kind }
      out.push(`<li>${inline((ul ?? ol)![1])}</li>`)
    } else if (/^>\s?/.test(line)) { close(); out.push(`<blockquote>${inline(line.replace(/^>\s?/, ''))}</blockquote>`) }
    else if (!line.trim()) close()
    else { close(); out.push(`<p>${inline(line)}</p>`) }
  }
  close()
  return out.join('')
}

/** The notes as plain text (Forgy, searches): line breaks kept, headings and lists marked */
export function notesToText(notes: string): string {
  if (!isHtmlNotes(notes)) return notes
  return notes
    .replace(/<h([1-3])[^>]*>/gi, (_m, n: string) => `\n${'#'.repeat(Number(n))} `)
    .replace(/<li[^>]*>/gi, '\n- ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|h[1-6]|blockquote|pre|ul|ol)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&')
    .replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim()
}

/** What the editor keeps: these tags, and on them only these attributes */
export const NOTES_TAGS: Record<string, string[]> = {
  p: [], div: [], br: [], b: [], strong: [], i: [], em: [], u: [], s: [], strike: [], del: [],
  h1: [], h2: [], h3: [], ul: [], ol: [], li: [], blockquote: [], pre: [], code: [], hr: [],
  font: ['size', 'color'], span: ['style'], mark: []
}

/** In a style, only the colors and the size the editor sets */
export const cleanStyle = (style: string) => style.split(';').map(s => s.trim())
  .filter(s => /^(color|background-color|font-size)\s*:\s*[#\w(),.%\s-]+$/i.test(s) && !/url|expression/i.test(s)).join('; ')
