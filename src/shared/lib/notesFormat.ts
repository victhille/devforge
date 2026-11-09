/**
 * v3.8.1: a project's notes are formatted text (HTML from the editor). Notes
 * written in Markdown (before v3.8.1, or by hand in the project's folder) are
 * converted when they are opened.
 *
 * Checklists: `<ul data-checklist><li data-checked="true|false">…</li></ul>`.
 * Everything here works on strings, so the main process (no DOM) uses it too.
 *
 * A note can come from a cloned repository, written by anyone: every pattern
 * here runs in linear time (a tag is `[^<>]*`, never `[^>]*` that runs to the
 * end of the text from each `<`), and the blocks and lines are cut by hand.
 */

/** HTML from the editor, or Markdown */
export const isHtmlNotes = (notes: string) => /^\s*</.test(notes)

export const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/** Bold, italics, code, inline */
const inline = (s: string) => escapeHtml(s)
  .replace(/`([^`]+)`/g, '<code>$1</code>')
  .replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>')
  .replace(/(^|[^*])\*([^*\s][^*]*)\*/g, '$1<i>$2</i>')
  .replace(/~~([^~]+)~~/g, '<s>$1</s>')

type ListKind = 'ul' | 'ol' | 'check'
const OPEN_LIST: Record<ListKind, string> = { ul: '<ul>', ol: '<ol>', check: '<ul data-checklist>' }

/** Markdown: headings, lists (`- [ ]` ones become checkboxes), quotes, code blocks, paragraphs */
export function markdownToHtml(md: string): string {
  const out: string[] = []
  const lines = md.replace(/\r\n?/g, '\n').split('\n')
  let list: ListKind | null = null
  const close = () => { if (list) { out.push(list === 'ol' ? '</ol>' : '</ul>'); list = null } }
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (/^```/.test(line)) {
      close()
      const code: string[] = []
      while (++i < lines.length && !/^```/.test(lines[i])) code.push(lines[i])
      out.push(`<pre>${escapeHtml(code.join('\n'))}</pre>`)
      continue
    }
    const h = /^(#{1,3})\s+(.*)$/.exec(line)
    const check = /^\s*[-*+]\s+\[([ xX])\]\s+(.*)$/.exec(line)
    const ul = /^\s*[-*+]\s+(.*)$/.exec(line)
    const ol = /^\s*\d+[.)]\s+(.*)$/.exec(line)
    if (h) { close(); out.push(`<h${h[1].length}>${inline(h[2])}</h${h[1].length}>`) }
    else if (check || ul || ol) {
      const kind: ListKind = check ? 'check' : ul ? 'ul' : 'ol'
      if (list !== kind) { close(); out.push(OPEN_LIST[kind]); list = kind }
      if (check) out.push(`<li data-checked="${check[1] !== ' '}">${inline(check[2])}</li>`)
      else out.push(`<li>${inline((ul ?? ol)![1])}</li>`)
    } else if (/^>\s?/.test(line)) { close(); out.push(`<blockquote>${inline(line.replace(/^>\s?/, ''))}</blockquote>`) }
    else if (!line.trim()) close()
    else { close(); out.push(`<p>${inline(line)}</p>`) }
  }
  close()
  return out.join('')
}

/** A note's body as HTML, whatever it was written in */
export const toHtmlBody = (body: string) => (isHtmlNotes(body) ? body : markdownToHtml(body))

const decode = (s: string) => s.replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&')

/**
 * The text cut around its code blocks (`<pre>…</pre>`, the odd parts), found
 * with plain searches: an unclosed `<pre` ends the cutting.
 */
export function splitPre(html: string): string[] {
  const out: string[] = []
  const open = /<pre\b/gi, close = /<\/pre>/gi
  let at = 0
  for (;;) {
    open.lastIndex = at
    const o = open.exec(html)
    if (!o) break
    close.lastIndex = o.index
    const c = close.exec(html)
    if (!c) break
    out.push(html.slice(at, o.index), html.slice(o.index, c.index + c[0].length))
    at = c.index + c[0].length
  }
  out.push(html.slice(at))
  return out
}

/**
 * Line breaks of the file's HTML (one block per line) are not text: between two
 * tags they go, elsewhere they become a space, blank lines with them.
 */
function joinLines(part: string): string {
  if (!part.includes('\n')) return part
  const lines = part.split('\n')
  const last = lines.length - 1
  const out: string[] = []
  let prevEnd = ''
  lines.forEach((raw, i) => {
    let line = i > 0 ? raw.trimStart() : raw
    if (i < last) line = line.trimEnd()
    if (i === 0) { out.push(line); prevEnd = line.slice(-1); return }
    if (!line && i < last) return
    out.push(prevEnd === '>' && line.startsWith('<') ? '' : ' ', line)
    if (line) prevEnd = line.slice(-1)
  })
  return out.join('')
}

/** The notes as plain text (Forgy, searches): line breaks kept, headings, lists and checkboxes marked */
export function notesToText(notes: string): string {
  if (!isHtmlNotes(notes)) return notes
  // Outside code blocks a line break of the HTML is a space (the file keeps one block per line)
  const text = splitPre(notes).map((part, i) => (i % 2 ? part : joinLines(part))).join('')
    .replace(/<h([1-3])[^<>]*>/gi, (_m, n: string) => `\n${'#'.repeat(Number(n))} `)
    .replace(/<li\b([^<>]*)>/gi, (_m, attrs: string) => {
      const state = /\bdata-checked\s*=\s*["']?(true|false)/i.exec(attrs)?.[1]
      return state ? `\n- [${state.toLowerCase() === 'true' ? 'x' : ' '}] ` : '\n- '
    })
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|h[1-6]|blockquote|pre|ul|ol)>/gi, '\n')
    .replace(/<[^<>]+>/g, '')
  return decode(text).split('\n').map(l => l.trimEnd()).join('\n').replace(/\n{3,}/g, '\n\n').trim()
}

/** What the editor keeps: these tags, and on them only these attributes */
export const NOTES_TAGS: Record<string, string[]> = {
  p: [], div: [], br: [], b: [], strong: [], i: [], em: [], u: [], s: [], strike: [], del: [],
  h1: [], h2: [], h3: [], ul: ['data-checklist'], ol: [], li: ['data-checked'], blockquote: [], pre: [], code: [], hr: [],
  font: ['size', 'color'], span: ['style'], mark: []
}

/** The attributes a tag keeps, when the editor keeps it (its own key only: `constructor` must not find Object's) */
export const notesTagAttrs = (tag: string): string[] | undefined => (Object.prototype.hasOwnProperty.call(NOTES_TAGS, tag) ? NOTES_TAGS[tag] : undefined)

/** In a style, only the colors and the size the editor sets (the value's class takes the spaces: no \\s* before it to backtrack over) */
export const cleanStyle = (style: string) => style.split(';').map(s => s.trim())
  .filter(s => /^(color|background-color|font-size)\s*:[#\w(),.%\s-]+$/i.test(s) && !/url|expression/i.test(s)).join('; ')

// ─── Checklists ──────────────────────────────────────────────────────────────

export interface ChecklistItem {
  checked: boolean
  /** Its words, without the tags */
  text: string
  /** Where the <li> starts and ends in the HTML (end: after </li>) */
  start: number
  end: number
  /** Where its opening tag ends */
  tagEnd: number
}

const CHECKED_ATTR = /\bdata-checked\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/i
/** Deeper than any list the editor makes: items nested further are not boxes (each would read all the ones inside it again) */
const MAX_DEPTH = 32
/** An item's words are read from this many characters at most */
const MAX_ITEM_TEXT = 2000

/** The checkboxes of an HTML body, in their order (a nested list is followed) */
export function checklistItems(html: string): ChecklistItem[] {
  const items: ChecklistItem[] = []
  const lists: boolean[] = []
  const open: ({ start: number; tagEnd: number; checked: boolean; inChecklist: boolean } | null)[] = []
  const re = /<(\/?)(ul|ol|li)\b([^<>]*)>/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(html))) {
    const [tag, closing, rawName, attrs] = m
    const name = rawName.toLowerCase()
    if (name === 'li') {
      if (!closing) {
        const value = CHECKED_ATTR.exec(attrs)?.[1].replace(/["']/g, '').toLowerCase()
        open.push(open.length >= MAX_DEPTH ? null : { start: m.index, tagEnd: m.index + tag.length, checked: value === 'true', inChecklist: !!lists[lists.length - 1] })
      } else {
        const li = open.pop()
        if (li?.inChecklist) {
          const words = html.slice(li.tagEnd, Math.min(m.index, li.tagEnd + MAX_ITEM_TEXT)).replace(/<[^<>]+>/g, ' ')
          items.push({ checked: li.checked, text: decode(words).replace(/\s+/g, ' ').trim(), start: li.start, end: m.index + tag.length, tagEnd: li.tagEnd })
        }
      }
    } else if (!closing) lists.push(name === 'ul' && /\bdata-checklist\b/i.test(attrs))
    else lists.pop()
  }
  return items.sort((a, b) => a.start - b.start)
}

/** The boxes left to check in a body (HTML or Markdown) */
export const countOpen = (body: string) => checklistItems(toHtmlBody(body)).filter(i => !i.checked).length

/** The body with this box checked or not */
export function setItemChecked(html: string, item: ChecklistItem, checked: boolean): string {
  const tag = html.slice(item.start, item.tagEnd)
  const next = CHECKED_ATTR.test(tag) ? tag.replace(CHECKED_ATTR, `data-checked="${checked}"`) : tag.replace(/^<li\b/i, `<li data-checked="${checked}"`)
  return html.slice(0, item.start) + next + html.slice(item.tagEnd)
}

/** The body without this box (and without its list once empty) */
export function removeItem(html: string, item: ChecklistItem): string {
  return (html.slice(0, item.start) + html.slice(item.end).replace(/^\n/, '')).replace(/<ul\b([^<>]*)>\s*<\/ul>\n?/gi, (m, attrs: string) => (/\bdata-checklist\b/i.test(attrs) ? '' : m))
}

export const itemHtml = (text: string, checked = false) => `<li data-checked="${checked}">${escapeHtml(text)}</li>`

/** A list of boxes */
export const checklistHtml = (items: { text: string; checked: boolean }[]) => `<ul data-checklist>${items.map(i => itemHtml(i.text, i.checked)).join('')}</ul>`

/**
 * `li` (an item's HTML) put back as the body's `index`-th box: before the box
 * there now, or after the last one (a new list when the body has none).
 */
export function insertItem(html: string, li: string, index = Infinity): string {
  const items = checklistItems(html)
  if (index < items.length) return html.slice(0, items[index].start) + li + html.slice(items[index].start)
  const last = items[items.length - 1]
  if (last) return html.slice(0, last.end) + li + html.slice(last.end)
  return `${html}<ul data-checklist>${li}</ul>`
}

/**
 * The body written one block per line, so the file reads well in Git and on
 * GitHub (which shows a Markdown file's HTML); code blocks are left as they are.
 */
export function blocksOnLines(html: string): string {
  return splitPre(html).map((part, i) => (i % 2
    ? part
    : part.replace(/<ul data-checklist="">/g, '<ul data-checklist>')
      .replace(/(<\/(?:p|div|h[1-6]|ul|ol|li|blockquote)>|<(?:ul|ol)\b[^<>]*>|<hr\s*\/?>)(?!\n)/gi, '$1\n'))).join('').replace(/(<\/pre>)(?!\n)/gi, '$1\n')
}
