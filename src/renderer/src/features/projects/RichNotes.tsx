import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Bold, Code, Eraser, Highlighter, Italic, List, ListOrdered, Minus, Quote, Strikethrough, Underline } from 'lucide-react'
import { cleanStyle, isHtmlNotes, markdownToHtml, NOTES_TAGS } from '@shared/lib/notesFormat'
import { useI18n } from '@renderer/i18n/I18nContext'
import { cn } from '@renderer/lib/cn'

/** Only the editor's own tags and attributes: anything else (scripts, handlers, links) is dropped */
function sanitize(html: string): string {
  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html')
  const walk = (node: Element) => {
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
      }
      walk(child)
    }
  }
  walk(doc.body)
  return doc.body.innerHTML
}

/** The notes as the editor shows them: Markdown from before is converted */
export const toEditorHtml = (notes: string) => sanitize(isHtmlNotes(notes) ? notes : markdownToHtml(notes))

const COLORS = ['#E5484D', '#F5A524', '#3FCF8E', '#5B9BFF', '#B07CFF']
const HIGHLIGHTS = ['#F5A52455', '#3FCF8E44', '#5B9BFF44', '#E5484D44']

/**
 * v3.8.1: a project's notes as formatted text: bold, italics, underline,
 * headings, sizes, colours, lists. Saved as clean HTML.
 */
export default function RichNotes({ value, onChange }: { value: string; onChange: (html: string) => void }) {
  const { t } = useI18n()
  const k = t.notes.editor
  const ref = useRef<HTMLDivElement>(null)
  const [, setTick] = useState(0)
  const [palette, setPalette] = useState<'color' | 'mark' | null>(null)

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

  // Emptied: nothing kept (the editor leaves a <br>)
  const emit = () => onChange(ref.current?.textContent?.trim() ? ref.current.innerHTML : '')
  const run = (cmd: string, arg?: string) => {
    ref.current?.focus()
    document.execCommand(cmd, false, arg)
    emit()
    setTick(n => n + 1)
  }
  const on = (cmd: string) => { try { return document.queryCommandState(cmd) } catch { return false } }
  const block = (() => { try { return String(document.queryCommandValue('formatBlock') || 'p').toLowerCase() } catch { return 'p' } })()
  const size = (() => { try { return String(document.queryCommandValue('fontSize') || '3') } catch { return '3' } })()

  const Btn = ({ cmd, label, children, active }: { cmd: string; label: string; children: ReactNode; active?: boolean }) => (
    <button type="button" title={label} aria-label={label} aria-pressed={active ?? on(cmd)} onMouseDown={e => e.preventDefault()} onClick={() => run(cmd)}
      className={cn('flex size-7 items-center justify-center rounded-md transition-colors', (active ?? on(cmd)) ? 'bg-active text-fg' : 'text-fg-secondary hover:bg-hover hover:text-fg')}>
      {children}
    </button>
  )
  const sep = <span className="mx-1 h-5 w-px bg-line" aria-hidden />

  return (
    <div className="flex flex-col">
      <div role="toolbar" aria-label={k.toolbar} className="flex flex-wrap items-center gap-0.5 border-b border-line-subtle px-3 py-1.5">
        <select aria-label={k.block} value={['h1', 'h2', 'h3'].includes(block) ? block : 'p'} onMouseDown={e => e.stopPropagation()}
          onChange={e => run('formatBlock', e.target.value)}
          className="h-7 rounded-md border border-line bg-canvas px-1.5 text-xs text-fg outline-none">
          <option value="p">{k.paragraph}</option>
          <option value="h1">{k.h1}</option>
          <option value="h2">{k.h2}</option>
          <option value="h3">{k.h3}</option>
        </select>
        <select aria-label={k.size} value={['2', '3', '5', '6'].includes(size) ? size : '3'} onChange={e => run('fontSize', e.target.value)}
          className="ml-1 h-7 rounded-md border border-line bg-canvas px-1.5 text-xs text-fg outline-none">
          <option value="2">{k.small}</option>
          <option value="3">{k.normal}</option>
          <option value="5">{k.large}</option>
          <option value="6">{k.huge}</option>
        </select>
        {sep}
        <Btn cmd="bold" label={k.bold}><Bold size={14} /></Btn>
        <Btn cmd="italic" label={k.italic}><Italic size={14} /></Btn>
        <Btn cmd="underline" label={k.underline}><Underline size={14} /></Btn>
        <Btn cmd="strikeThrough" label={k.strike}><Strikethrough size={14} /></Btn>
        <span className="relative flex">
          <button type="button" title={k.color} aria-label={k.color} aria-expanded={palette === 'color'} onMouseDown={e => e.preventDefault()} onClick={() => setPalette(p => (p === 'color' ? null : 'color'))}
            className="flex size-7 flex-col items-center justify-center rounded-md text-fg-secondary hover:bg-hover hover:text-fg">
            <span className="text-[13px] leading-none font-semibold">A</span>
            <span className="mt-0.5 h-[3px] w-3.5 rounded-full bg-gradient-to-r from-[#E5484D] via-[#F5A524] to-[#5B9BFF]" />
          </button>
          <button type="button" title={k.highlight} aria-label={k.highlight} aria-expanded={palette === 'mark'} onMouseDown={e => e.preventDefault()} onClick={() => setPalette(p => (p === 'mark' ? null : 'mark'))}
            className="flex size-7 items-center justify-center rounded-md text-fg-secondary hover:bg-hover hover:text-fg">
            <Highlighter size={14} />
          </button>
          {palette && (
            <span role="group" aria-label={palette === 'color' ? k.color : k.highlight} className="absolute top-8 left-0 z-10 flex gap-1 rounded-lg border border-line bg-elevated p-1.5 shadow-pop">
              {(palette === 'color' ? COLORS : HIGHLIGHTS).map(c => (
                <button key={c} type="button" aria-label={c} onMouseDown={e => e.preventDefault()} onClick={() => { run(palette === 'color' ? 'foreColor' : 'hiliteColor', c); setPalette(null) }}
                  className="size-5 rounded-full border border-line" style={{ background: c }} />
              ))}
              <button type="button" aria-label={k.noColor} title={k.noColor} onMouseDown={e => e.preventDefault()}
                onClick={() => { run(palette === 'color' ? 'foreColor' : 'hiliteColor', palette === 'color' ? 'inherit' : 'transparent'); setPalette(null) }}
                className="flex size-5 items-center justify-center rounded-full border border-line text-fg-muted"><Minus size={10} /></button>
            </span>
          )}
        </span>
        {sep}
        <Btn cmd="insertUnorderedList" label={k.bullets}><List size={14} /></Btn>
        <Btn cmd="insertOrderedList" label={k.numbers}><ListOrdered size={14} /></Btn>
        <button type="button" title={k.quote} aria-label={k.quote} aria-pressed={block === 'blockquote'} onMouseDown={e => e.preventDefault()} onClick={() => run('formatBlock', block === 'blockquote' ? 'p' : 'blockquote')}
          className={cn('flex size-7 items-center justify-center rounded-md', block === 'blockquote' ? 'bg-active text-fg' : 'text-fg-secondary hover:bg-hover hover:text-fg')}><Quote size={14} /></button>
        <button type="button" title={k.code} aria-label={k.code} aria-pressed={block === 'pre'} onMouseDown={e => e.preventDefault()} onClick={() => run('formatBlock', block === 'pre' ? 'p' : 'pre')}
          className={cn('flex size-7 items-center justify-center rounded-md', block === 'pre' ? 'bg-active text-fg' : 'text-fg-secondary hover:bg-hover hover:text-fg')}><Code size={14} /></button>
        {sep}
        <Btn cmd="removeFormat" label={k.clear} active={false}><Eraser size={14} /></Btn>
      </div>
      <div ref={ref} role="textbox" aria-multiline="true" aria-label={t.notes.notes} contentEditable suppressContentEditableWarning spellCheck
        data-placeholder={k.placeholder} data-testid="notes-editor"
        onInput={emit} onBlur={emit}
        onKeyDown={e => {
          // Ctrl+B is also the menu's shortcut: here it means bold
          const cmd = e.ctrlKey && !e.shiftKey && !e.altKey ? { b: 'bold', i: 'italic', u: 'underline' }[e.key.toLowerCase()] : undefined
          if (cmd) { e.preventDefault(); e.stopPropagation(); run(cmd) }
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
          'min-h-[320px] px-5 py-4 text-[14px] leading-relaxed text-fg outline-none',
          'empty:before:pointer-events-none empty:before:text-fg-muted empty:before:content-[attr(data-placeholder)]',
          '[&_h1]:mt-3 [&_h1]:mb-1.5 [&_h1]:text-2xl [&_h1]:font-semibold [&_h2]:mt-3 [&_h2]:mb-1 [&_h2]:text-xl [&_h2]:font-semibold [&_h3]:mt-2 [&_h3]:mb-1 [&_h3]:text-base [&_h3]:font-semibold',
          '[&_ul]:my-1 [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:my-1 [&_ol]:list-decimal [&_ol]:pl-6 [&_p]:my-1',
          '[&_blockquote]:my-2 [&_blockquote]:border-l-2 [&_blockquote]:border-accent [&_blockquote]:pl-3 [&_blockquote]:text-fg-secondary',
          '[&_pre]:my-2 [&_pre]:rounded-lg [&_pre]:bg-canvas [&_pre]:p-3 [&_pre]:font-mono [&_pre]:text-[12.5px] [&_code]:rounded [&_code]:bg-canvas [&_code]:px-1 [&_code]:font-mono [&_code]:text-[12.5px]'
        )} />
    </div>
  )
}
