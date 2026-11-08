import { describe, expect, it } from 'vitest'
import { blocksOnLines, checklistHtml, checklistItems, cleanStyle, countOpen, insertItem, isHtmlNotes, itemHtml, markdownToHtml, notesToText, removeItem, setItemChecked } from '@shared/lib/notesFormat'

/** v3.8.1: notes as formatted text; their checklists */
describe('notes format', () => {
  it('converts Markdown: headings, lists, checkboxes, quotes, code, inline formats', () => {
    expect(markdownToHtml('# Mise en ligne\n\nVider le **cache** et *relancer*\n- un\n- [x] deux\n- [ ] trois\n1. a\n> attention\n```\nnpm run build\n```'))
      .toBe('<h1>Mise en ligne</h1><p>Vider le <b>cache</b> et <i>relancer</i></p><ul><li>un</li></ul><ul data-checklist><li data-checked="true">deux</li><li data-checked="false">trois</li></ul><ol><li>a</li></ol><blockquote>attention</blockquote><pre>npm run build</pre>')
    expect(markdownToHtml('<script>alert(1)</script> & `x < y`')).toBe('<p>&lt;script&gt;alert(1)&lt;/script&gt; &amp; <code>x &lt; y</code></p>')
  })

  it('tells HTML from Markdown', () => {
    expect(isHtmlNotes('<h1>a</h1>')).toBe(true)
    expect(isHtmlNotes('  <p>a</p>')).toBe(true)
    expect(isHtmlNotes('# a')).toBe(false)
    expect(isHtmlNotes('')).toBe(false)
  })

  it('gives Forgy plain text, headings, lists and boxes marked', () => {
    expect(notesToText('<h1>Mise en ligne</h1><p>vider le <b>cache</b> &amp; <u>relancer</u></p><ul><li>un</li><li>deux</li></ul>'))
      .toBe('# Mise en ligne\nvider le cache & relancer\n\n- un\n- deux')
    expect(notesToText('<ul data-checklist><li data-checked="true">DNS</li><li data-checked="false">TLS</li></ul>')).toBe('- [x] DNS\n- [ ] TLS')
    expect(notesToText('# déjà du texte')).toBe('# déjà du texte')
  })

  it('keeps only colors and sizes in a style', () => {
    expect(cleanStyle('color: #E5484D; background-color: rgba(1,2,3,0.4); position: fixed; background: url(x)')).toBe('color: #E5484D; background-color: rgba(1,2,3,0.4)')
  })
})

describe('checklists', () => {
  const html = '<p>avant</p><ul data-checklist><li data-checked="true">Garder le <b>panier</b></li><li data-checked="false">Arrondi &amp; TVA</li><li>sans état</li></ul><ul><li data-checked="false">pas une case</li></ul>'

  it('finds the boxes, their state and their words', () => {
    expect(checklistItems(html).map(i => [i.checked, i.text])).toEqual([[true, 'Garder le panier'], [false, 'Arrondi & TVA'], [false, 'sans état']])
    expect(countOpen(html)).toBe(2)
    expect(countOpen('- [ ] a\n- [x] b\n- c')).toBe(1)
    // A nested list is followed
    expect(checklistItems('<ul data-checklist><li data-checked="false">a<ul data-checklist><li data-checked="true">b</li></ul></li></ul>').map(i => [i.checked, i.text])).toEqual([[false, 'a b'], [true, 'b']])
  })

  it('checks, removes and puts back a box', () => {
    const [first, second, third] = checklistItems(html)
    expect(setItemChecked(html, second, true)).toContain('<li data-checked="true">Arrondi &amp; TVA</li>')
    expect(setItemChecked(html, third, true)).toContain('<li data-checked="true">sans état</li>')
    expect(setItemChecked(html, first, false)).toContain('<li data-checked="false">Garder')
    const without = removeItem(html, second)
    expect(checklistItems(without).map(i => i.text)).toEqual(['Garder le panier', 'sans état'])
    expect(insertItem(without, html.slice(second.start, second.end), 1)).toBe(html)
    // The last box gone: its list too
    expect(removeItem('<ul data-checklist><li data-checked="false">x</li></ul><p>y</p>', checklistItems('<ul data-checklist><li data-checked="false">x</li></ul><p>y</p>')[0])).toBe('<p>y</p>')
  })

  it('adds a box after the last one, or in a new list', () => {
    expect(insertItem('<p>x</p>', itemHtml('a <b>'))).toBe('<p>x</p><ul data-checklist><li data-checked="false">a &lt;b&gt;</li></ul>')
    expect(insertItem(checklistHtml([{ text: 'a', checked: true }]), itemHtml('b'))).toBe('<ul data-checklist><li data-checked="true">a</li><li data-checked="false">b</li></ul>')
  })

  it('writes one block per line, code blocks left as they are', () => {
    expect(blocksOnLines('<h3>T</h3><ul data-checklist><li data-checked="false">a</li></ul><pre>x</div>\n</pre><p>b</p>'))
      .toBe('<h3>T</h3>\n<ul data-checklist>\n<li data-checked="false">a</li>\n</ul>\n<pre>x</div>\n</pre>\n<p>b</p>\n')
    expect(blocksOnLines(blocksOnLines('<p>a</p><p>b</p>'))).toBe('<p>a</p>\n<p>b</p>\n')
    // As the editor writes it
    expect(blocksOnLines('<ul data-checklist=""><li data-checked="true">a</li></ul>')).toBe('<ul data-checklist>\n<li data-checked="true">a</li>\n</ul>\n')
  })
})
