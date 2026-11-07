import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import Badge from '@renderer/components/ui/Badge'
import Kbd from '@renderer/components/ui/Kbd'
import EmptyState from '@renderer/components/ui/EmptyState'
import Switch from '@renderer/components/ui/Switch'
import { PageHeader } from '@renderer/components/ui/Page'

/** Forge, the shared components: the look of the mock-up, the same behavior */
const html = (el: ReturnType<typeof h>) => renderToStaticMarkup(el)

describe('Badge', () => {
  it('a state in words, a technical value in the code font', () => {
    expect(html(h(Badge, { color: 'success', children: 'à jour' }))).not.toContain('font-mono')
    expect(html(h(Badge, { mono: true, children: 'npm' }))).toContain('font-mono')
    expect(html(h(Badge, { color: 'info', children: 'x' }))).toContain('text-info')
  })
})

describe('Kbd', () => {
  it('a key is a kbd element', () => {
    expect(html(h(Kbd, null, 'Ctrl K'))).toMatch(/^<kbd[^>]*>Ctrl K<\/kbd>$/)
  })
})

describe('PageHeader', () => {
  it('one title per page, in the display font, its actions beside it', () => {
    const out = html(h(PageHeader, { title: 'Projets', subtitle: '4 enregistrés', actions: h('button', null, 'Nouveau') }))
    expect(out).toMatch(/<h1[^>]*font-display[^>]*>Projets<\/h1>/)
    expect(out).toContain('4 enregistrés')
    expect(out).toContain('<button>Nouveau</button>')
  })
})

describe('EmptyState', () => {
  it('one line: what is missing, then what to do', () => {
    const out = html(h(EmptyState, { title: 'Aucun projet', description: 'Ajoute un dossier.', action: h('button', null, 'Ajouter') }))
    expect(out.indexOf('Aucun projet')).toBeLessThan(out.indexOf('Ajouter'))
    expect(out).toContain('Ajoute un dossier.')
    expect(out).toContain('border-dashed')
  })
})

describe('Switch', () => {
  it('says whether it is on', () => {
    expect(html(h(Switch, { checked: true, onChange: () => {}, label: 'Thème' }))).toContain('aria-checked="true"')
    expect(html(h(Switch, { checked: false, onChange: () => {}, label: 'Thème' }))).toContain('aria-checked="false"')
  })
})
