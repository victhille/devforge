import { describe, expect, it } from 'vitest'
import { cleanStyle, isHtmlNotes, markdownToHtml, notesToText } from '@shared/lib/notesFormat'

/** v3.8.1: notes as formatted text */
describe('notes format', () => {
  it('converts the Markdown of v3.8.0: headings, lists, quotes, code, inline formats', () => {
    expect(markdownToHtml('# Mise en ligne\n\nVider le **cache** et *relancer*\n- un\n- [x] deux\n1. a\n> attention\n```\nnpm run build\n```'))
      .toBe('<h1>Mise en ligne</h1><p>Vider le <b>cache</b> et <i>relancer</i></p><ul><li>un</li><li>deux</li></ul><ol><li>a</li></ol><blockquote>attention</blockquote><pre>npm run build</pre>')
    expect(markdownToHtml('<script>alert(1)</script> & `x < y`')).toBe('<p>&lt;script&gt;alert(1)&lt;/script&gt; &amp; <code>x &lt; y</code></p>')
  })

  it('tells HTML from Markdown', () => {
    expect(isHtmlNotes('<h1>a</h1>')).toBe(true)
    expect(isHtmlNotes('  <p>a</p>')).toBe(true)
    expect(isHtmlNotes('# a')).toBe(false)
    expect(isHtmlNotes('')).toBe(false)
  })

  it('gives Forgy plain text, headings and lists marked', () => {
    expect(notesToText('<h1>Mise en ligne</h1><p>vider le <b>cache</b> &amp; <u>relancer</u></p><ul><li>un</li><li>deux</li></ul>'))
      .toBe('# Mise en ligne\nvider le cache & relancer\n\n- un\n- deux')
    expect(notesToText('# déjà du texte')).toBe('# déjà du texte')
  })

  it('keeps only colors and sizes in a style', () => {
    expect(cleanStyle('color: #E5484D; background-color: rgba(1,2,3,0.4); position: fixed; background: url(x)')).toBe('color: #E5484D; background-color: rgba(1,2,3,0.4)')
  })
})
