import { useEffect, useRef, useState, type ReactNode } from 'react'
import { ListChecks } from 'lucide-react'
import { cleanStyle, NOTES_TAGS, toHtmlBody } from '@shared/lib/notesFormat'
import { useI18n } from '@renderer/i18n/I18nContext'
import { cn } from '@renderer/lib/cn'

/** Only the editor's own tags and attributes: anything else (scripts, handlers, links) is dropped */
export function sanitize(html: string): string {
  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html')
  const walk = (node: Element) => {
    for (const child of [...node.childNodes]) {
      // The file keeps one block per line: those line breaks between blocks are not text
      if (child.nodeType === Node.TEXT_NODE && /^\s*\n\s*$/.test(child.textContent ?? '') && ['BODY', 'UL', 'OL'].includes(node.tagName)) child.remove()
    }
    for (const child of [...node.children]) {
      const tag = child.tagName.toLowerCase()
      const allowed = NOTES_TAGS[tag]
      if (!allowed) {
        // Unknown wrapper (a pasted <a>, <table>…): its text stays, script and style go
        if (['script', 'style', 'iframe', 'object', 'embed', 'img', 'svg', 'link', 'meta'].includes(tag)) child.remove()
        else { walk(child); child.replaceWith(...child.childNodes) }
        continue
      }
      for (const attr of [...child.attributes]) {
        if (!allowed.includes(attr.name)) child.removeAttribute(attr.name)
        else if (attr.name === 'style') child.setAttribute('style', cleanStyle(attr.value))
        else if (attr.name === 'color' && !/^#?[\w]+$/.test(attr.value)) child.removeAttribute('color')
        else if (attr.name === 'data-checklist') child.setAttribute('data-checklist', '')
        else if (attr.name === 'data-checked') child.setAttribute('data-checked', attr.value === 'true' ? 'true' : 'false')
      }
      walk(child)
    }
  }
  walk(doc.body)
  return doc.body.innerHTML
}

/** The note as the editor shows it: Markdown (written by hand, or before v3.8.1) is converted */
export const toEditorHtml = (body: string) => sanitize(toHtmlBody(body))

/** The checklist line holding `node` (the caret, a click), if it is one */
function lineOf(node: Node | null, root: HTMLElement): HTMLLIElement | null {
  const el = node instanceof Element ? node : node?.parentElement
  const li = el?.closest('li')
  return li && root.contains(li) && li.parentElement?.matches('ul[data-checklist]') ? li : null
}

/** The node at the caret: a selection on an element (a list just made) means the first place inside its child there */
function caretNode(): Node | null {
  const sel = document.getSelection()
  let n = sel?.anchorNode ?? null
  if (!(n instanceof Element) || !n.childNodes.length) return n
  // After its last child: the end of that one
  const after = sel!.anchorOffset >= n.childNodes.length
  n = n.childNodes[Math.min(sel!.anchorOffset, n.childNodes.length - 1)]
  while (n instanceof Element && n.firstChild) n = after ? n.lastChild! : n.firstChild
  return n
}

/** Every line of a checklist says whether it is checked (a line just made does not yet) */
function settleLines(root: HTMLElement): void {
  for (const li of root.querySelectorAll('ul[data-checklist] > li')) {
    const v = li.getAttribute('data-checked')
    if (v !== 'true' && v !== 'false') li.setAttribute('data-checked', 'false')
  }
}

const anchorEl = () => {
  const n = caretNode()
  return n instanceof Element ? n : n?.parentElement ?? null
}

/**
 * A note's text: bold, italics, headings, checklists and code, as in the
 * mock-up's toolbar. Saved as clean HTML; the checkboxes are drawn by CSS
 * (.df-note in index.css) on `li[data-checked]`.
 */
export default function RichNotes({ value, onChange, header, aside }: {
  value: string
  onChange: (html: string) => void
  /** Above the text, inside the editor's frame (the note's title) */
  header?: ReactNode
  /** At the right of the toolbar */
  aside?: ReactNode
}) {
  const { t } = useI18n()
  const k = t.notes.editor
  const ref = useRef<HTMLDivElement>(null)
  const [, setTick] = useState(0)

  // Filled once: after that the editor holds the text (React would move the caret)
  useEffect(() => {
    if (ref.current) ref.current.innerHTML = toEditorHtml(value)
    document.execCommand('styleWithCSS', false, 'false')
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // The buttons show the format under the caret
  useEffect(() => {
    const onSel = () => { if (ref.current?.contains(document.getSelection()?.anchorNode ?? null)) setTick(n => n + 1) }
    document.addEventListener('selectionchange', onSel)
    return () => document.removeEventListener('selectionchange', onSel)
  }, [])

  const on = (cmd: string) => { try { return document.queryCommandState(cmd) } catch { return false } }
  const block = (() => { try { return String(document.queryCommandValue('formatBlock') || 'p').toLowerCase() } catch { return 'p' } })()
  const inside = ref.current?.contains(document.getSelection()?.anchorNode ?? null) ?? false
  const inChecklist = inside && !!ref.current && !!lineOf(caretNode(), ref.current)
  const inCode = inside && (block === 'pre' || !!anchorEl()?.closest('code'))

  // Emptied: nothing kept (the editor leaves a <br>)
  const emit = () => {
    const root = ref.current
    if (!root) return
    settleLines(root)
    onChange(root.textContent?.trim() || root.querySelector('li') ? root.innerHTML : '')
  }
  const done = () => { emit(); setTick(n => n + 1) }
  const run = (cmd: string, arg?: string) => {
    ref.current?.focus()
    document.execCommand(cmd, false, arg)
    done()
  }

  const toggleLine = (li: HTMLLIElement) => {
    li.setAttribute('data-checked', li.getAttribute('data-checked') === 'true' ? 'false' : 'true')
    done()
  }

  /** Lines into a checklist, or a checklist back into text */
  const checklist = () => {
    const root = ref.current
    if (!root) return
    root.focus()
    if (lineOf(caretNode(), root)) { run('insertUnorderedList'); return }
    const plain = anchorEl()?.closest('ul')
    if (plain && root.contains(plain)) plain.setAttribute('data-checklist', '')
    else {
      // The list made now (or the one the line joined) becomes a checklist
      const before = new Set(root.querySelectorAll('ul'))
      document.execCommand('insertUnorderedList')
      for (const ul of root.querySelectorAll('ul')) if (!before.has(ul)) ul.setAttribute('data-checklist', '')
      const ul = anchorEl()?.closest('ul')
      if (ul && root.contains(ul)) ul.setAttribute('data-checklist', '')
    }
    done()
  }

  /** Inline code on a selection (taken off when the caret is in some), a code block otherwise */
  const code = () => {
    const root = ref.current
    if (!root) return
    root.focus()
    const sel = document.getSelection()
    const inline = anchorEl()?.closest('code')
    // The browser's own commands have no inline code: the words are wrapped (or unwrapped) here
    const caretAfter = (node: Node) => {
      const r = document.createRange()
      r.setStartAfter(node)
      r.collapse(true)
      sel?.removeAllRanges()
      sel?.addRange(r)
    }
    if (sel && inline && root.contains(inline)) {
      const text = document.createTextNode(inline.textContent ?? '')
      inline.replaceWith(text)
      caretAfter(text)
      done()
      return
    }
    const picked = sel && !sel.isCollapsed ? sel.toString() : ''
    if (sel && picked.trim() && !picked.includes('\n')) {
      const range = sel.getRangeAt(0)
      const el = document.createElement('code')
      el.textContent = picked
      range.deleteContents()
      range.insertNode(el)
      caretAfter(el)
      done()
    } else run('formatBlock', block === 'pre' ? 'p' : 'pre')
  }

  // The mock-up's toolbar: 30 × 28 buttons, 7 px corners, in a 10 px frame
  const Btn = ({ label, hint, active, onClick, children, className }: { label: string; hint: string; active: boolean; onClick: () => void; children: ReactNode; className?: string }) => (
    <button type="button" title={hint} aria-label={label} aria-pressed={active} onMouseDown={e => e.preventDefault()} onClick={onClick}
      className={cn('flex h-7 w-7.5 items-center justify-center rounded-[7px] text-md font-bold transition-colors',
        active ? 'bg-accent-soft text-accent' : 'text-fg-secondary hover:bg-elevated hover:text-fg', className)}>
      {children}
    </button>
  )

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex flex-wrap items-center gap-2.5">
        <div role="toolbar" aria-label={k.toolbar} className="flex w-fit gap-0.5 rounded-[10px] border border-line-subtle p-1">
          <Btn label={k.bold} hint={k.boldHint} active={inside && on('bold')} onClick={() => run('bold')}>B</Btn>
          <Btn label={k.italic} hint={k.italicHint} active={inside && on('italic')} onClick={() => run('italic')} className="italic">I</Btn>
          <Btn label={k.heading} hint={k.heading} active={inside && block === 'h3'} onClick={() => run('formatBlock', block === 'h3' ? 'p' : 'h3')}>H</Btn>
          <Btn label={k.checklist} hint={k.checklistHint} active={inChecklist} onClick={checklist}><ListChecks size={15} strokeWidth={2.2} aria-hidden /></Btn>
          <Btn label={k.code} hint={k.codeHint} active={inCode} onClick={code} className="font-mono text-sm">{'{}'}</Btn>
        </div>
        <span className="min-w-0 flex-1" />
        {aside}
      </div>
      <div className="df-note">
        {header}
        {/* What a screen reader says for a box (the words come from the translations) */}
        <style>{`.df-note ul[data-checklist] > li::before { content: '' / ${JSON.stringify(`${k.todo} `)}; } .df-note ul[data-checklist] > li[data-checked='true']::before { content: '' / ${JSON.stringify(`${k.done} `)}; }`}</style>
        <div ref={ref} role="textbox" aria-multiline="true" aria-label={t.notes.body} aria-keyshortcuts="Control+Enter" contentEditable suppressContentEditableWarning spellCheck
          data-placeholder={k.placeholder} data-testid="notes-editor"
          onInput={e => {
            // Enter at the end of a checked line: the new one starts unchecked
            if ((e.nativeEvent as InputEvent).inputType === 'insertParagraph' && ref.current) {
              const li = lineOf(caretNode(), ref.current)
              if (li && !li.textContent?.trim()) li.setAttribute('data-checked', 'false')
            }
            emit()
          }}
          onBlur={emit}
          onMouseDown={e => {
            // A click on a line's box checks it (the caret stays where it was)
            const root = ref.current
            const li = root && lineOf(e.target as Node, root)
            if (!li) return
            const r = li.getBoundingClientRect()
            const line = parseFloat(getComputedStyle(li).lineHeight) || 24
            if (e.clientX - r.left < 20 && e.clientY - r.top < line) { e.preventDefault(); toggleLine(li) }
          }}
          onKeyDown={e => {
            // Ctrl+B is also the menu's shortcut: here it means bold
            const cmd = e.ctrlKey && !e.shiftKey && !e.altKey ? { b: 'bold', i: 'italic', u: 'underline' }[e.key.toLowerCase()] : undefined
            if (cmd) { e.preventDefault(); e.stopPropagation(); run(cmd); return }
            // Ctrl+Enter checks the line the caret is on
            if (e.ctrlKey && e.key === 'Enter' && ref.current) {
              const li = lineOf(caretNode(), ref.current)
              if (li) { e.preventDefault(); e.stopPropagation(); toggleLine(li) }
            }
          }}
          onPaste={e => {
            // Pasted from a page or a document: its formatting kept, cleaned
            e.preventDefault()
            const html = e.clipboardData.getData('text/html')
            if (html) document.execCommand('insertHTML', false, sanitize(html))
            else document.execCommand('insertText', false, e.clipboardData.getData('text/plain'))
            emit()
          }}
          className={cn(
            'min-h-[320px] text-md leading-[1.7] text-fg outline-none',
            'empty:before:pointer-events-none empty:before:text-fg-muted empty:before:content-[attr(data-placeholder)]',
            '[&_h1]:mt-3 [&_h1]:mb-1.5 [&_h1]:font-display [&_h1]:text-2xl [&_h1]:font-bold [&_h2]:mt-3 [&_h2]:mb-1.5 [&_h2]:font-display [&_h2]:text-xl [&_h2]:font-bold',
            '[&_h3]:mt-3 [&_h3]:mb-1.5 [&_h3]:font-display [&_h3]:text-xl [&_h3]:font-bold [&_h3]:tracking-[-.01em]',
            '[&_ul:not([data-checklist])]:my-1.5 [&_ul:not([data-checklist])]:list-disc [&_ul:not([data-checklist])]:pl-6 [&_ol]:my-1.5 [&_ol]:list-decimal [&_ol]:pl-6 [&_p]:my-1.5',
            '[&_blockquote]:my-2 [&_blockquote]:border-l-2 [&_blockquote]:border-accent [&_blockquote]:pl-3 [&_blockquote]:text-fg-secondary',
            '[&_pre]:my-2 [&_pre]:rounded-lg [&_pre]:bg-canvas [&_pre]:p-3 [&_pre]:font-mono [&_pre]:text-sm [&_code]:font-mono [&_code]:text-[0.9em] [&_code]:text-fg'
          )} />
      </div>
    </div>
  )
}
