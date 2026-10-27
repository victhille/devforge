import { existsSync } from 'fs'
import { join } from 'path'
import { describe, expect, it } from 'vitest'
import { HOME, LISTED_PAGES, PAGES, docsOf } from '@renderer/app/navigation'
import { docsUrl } from '@renderer/lib/docs'

/** v3.2 lot 2: every page of the menu leads to a documentation page that exists on the site, in both languages */
const DOCS = join(__dirname, '..', '..', 'site', 'src', 'content', 'docs')
const exists = (slug: string, lang: '' | 'en/') => ['.md', '.mdx'].some(ext => existsSync(join(DOCS, `${lang}${slug}${ext}`)))

describe('help links', () => {
  it('gives every listed page and the detail pages a documentation page, in French and English', () => {
    for (const page of [HOME, ...LISTED_PAGES, ...PAGES.filter(p => p.route)]) {
      expect(page.docs, page.path).toBeTruthy()
      expect(exists(page.docs!, ''), `${page.path} → ${page.docs}`).toBe(true)
      expect(exists(page.docs!, 'en/'), `${page.path} → en/${page.docs}`).toBe(true)
    }
    expect(exists('getting-started/first-launch', '')).toBe(true)
    expect(exists('getting-started/connections', 'en/')).toBe(true)
  })

  it('finds the page of an address, detail pages included', () => {
    expect(docsOf('/')).toBe('getting-started/interface')
    expect(docsOf('/vpn')).toBe('online/vpn')
    expect(docsOf('/project/p1')).toBe('dev/projects')
    expect(docsOf('/vps/c1')).toBe('servers/ssh')
    expect(docsOf('/nowhere')).toBe('getting-started/interface')
  })

  it('builds the address in the interface language', () => {
    expect(docsUrl('online/vpn', 'fr')).toBe('https://example.github.io/devforge/online/vpn/')
    expect(docsUrl('online/vpn', 'en')).toBe('https://example.github.io/devforge/en/online/vpn/')
  })
})
