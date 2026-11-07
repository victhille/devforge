import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import ErrorState from '@renderer/components/ui/ErrorState'
import Notice from '@renderer/components/ui/Notice'
import StatusDot from '@renderer/components/ui/StatusDot'
import LogBox from '@renderer/components/ui/LogBox'
import Tabs from '@renderer/components/ui/Tabs'
import SplitPane from '@renderer/components/ui/SplitPane'
import Badge from '@renderer/components/ui/Badge'
import Modal from '@renderer/components/ui/Modal'
import { QuestionDialog } from '@renderer/app/ConfirmContext'
import { isPale, paleClass } from '@renderer/lib/brand'

/** v4.3: the shared components that replace the patterns each page copied (the design review) */
const html = (el: ReturnType<typeof h>) => renderToStaticMarkup(el)

describe('ErrorState', () => {
  it('says the reading failed, with the error and a way to try again only when one is given', () => {
    const out = html(h(ErrorState, { error: 'EACCES', onRetry: () => {} }))
    expect(out).toContain('role="alert"')
    expect(out).toContain('Could not read it')
    expect(out).toContain('EACCES')
    expect(out).toContain('Retry')
    expect(html(h(ErrorState, { title: 'Scan failed' }))).not.toContain('Retry')
  })
})

describe('Notice', () => {
  it('a static message is not announced; one that comes after an action is, as an alert when it is an error', () => {
    expect(html(h(Notice, { tone: 'warning' }, 'Stale'))).not.toContain('role=')
    expect(html(h(Notice, { tone: 'danger', live: true }, 'Failed'))).toContain('role="alert"')
    expect(html(h(Notice, { tone: 'success', live: true }, 'Done'))).toContain('role="status"')
    // The tone is shown by an icon as well as the color
    expect(html(h(Notice, { tone: 'warning' }, 'Stale'))).toContain('<svg')
  })
})

describe('StatusDot', () => {
  it('decoration unless labelled; a pulse only for something known to run', () => {
    expect(html(h(StatusDot, { state: 'on' }))).toContain('aria-hidden="true"')
    const labelled = html(h(StatusDot, { state: 'error', label: 'Down' }))
    expect(labelled).toContain('role="img"')
    expect(labelled).toContain('aria-label="Down"')
    expect(html(h(StatusDot, { state: 'on', live: true }))).toContain('df-ping')
    expect(html(h(StatusDot, { state: 'unknown', live: true }))).not.toContain('df-ping')
  })
})

describe('LogBox', () => {
  it('a placeholder while empty, a header only when it has a title', () => {
    expect(html(h(LogBox, { text: '' }))).toContain('…')
    expect(html(h(LogBox, { text: 'a' }))).not.toContain('border-b')
    expect(html(h(LogBox, { text: 'a', title: 'Install' }))).toContain('Install')
  })
})

describe('Tabs', () => {
  it('one tab reachable by Tab (the chosen one), the others by the arrows; two looks', () => {
    const items = [{ value: 'a', label: 'A' }, { value: 'b', label: 'B' }]
    const out = html(h(Tabs<string>, { items, value: 'b', onChange: () => {}, variant: 'underline', label: 'Views' }))
    expect(out).toContain('aria-label="Views"')
    expect(out.match(/tabindex="0"/g)).toHaveLength(1)
    expect(out).toMatch(/aria-selected="true"[^>]*tabindex="0"/)
    expect(out).toContain('border-b-2')
    expect(html(h(Tabs<string>, { items, value: 'a', onChange: () => {} }))).toContain('rounded-control')
  })
})

describe('SplitPane', () => {
  it('follows the width of its container, the side its chosen width once there is room', () => {
    const out = html(h(SplitPane, { side: 'list', width: 'lg', label: 'Projects', children: 'content' }))
    expect(out).toContain('@container')
    expect(out).toContain('@min-[720px]:w-72')
    expect(out).toContain('max-h-56')
    expect(out).toContain('aria-label="Projects"')
  })
})

describe('Badge', () => {
  it('a dot in the badge’s own color when asked', () => {
    expect(html(h(Badge, { color: 'success', dot: true, children: 'running' }))).toContain('bg-current')
    expect(html(h(Badge, { children: 'x' }))).not.toContain('bg-current')
  })
})

describe('Modal', () => {
  it('its close button speaks the app’s language', () => {
    expect(html(h(Modal, { title: 'T', onClose: () => {}, children: 'body' }))).toContain('title="Close"')
  })
})

describe('confirm dialog', () => {
  const ask = (waited: boolean) => html(h(QuestionDialog, {
    question: { id: 1, message: 'Delete it?', options: { danger: true }, resolve: () => {}, waited },
    onAnswer: () => {}
  }))

  it('asks in the app’s dialog, the confirm button ready at once', () => {
    const markup = ask(false)
    expect(markup).toContain('role="dialog"')
    expect(markup).toContain('Delete it?')
    expect(markup).not.toContain('disabled=""')
  })

  it('a question that waited behind another keeps its confirm button off for a moment', () => {
    expect(ask(true)).toContain('disabled=""')
  })
})

describe('pale brand colors', () => {
  it('yellow and light gray are pale; the strong ones are not', () => {
    expect(isPale('#F7DF1E')).toBe(true)
    expect(isPale('#E2E8F0')).toBe(true)
    expect(isPale('#3178C6')).toBe(false)
    expect(isPale('#DD0031')).toBe(false)
    expect(isPale('not a color')).toBe(false)
    expect(paleClass('#ECD53F')).toBe('df-pale')
    expect(paleClass(undefined)).toBe('')
  })
})
