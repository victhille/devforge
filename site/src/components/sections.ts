/** The site's sections, shown as tabs under the header of every documentation page */
export const SECTIONS = [
  { id: 'docs', path: 'getting-started/installation/', fr: 'Documentation', en: 'Documentation' },
  { id: 'guides', path: 'guides/deploy-site/', fr: 'Guides', en: 'Guides' },
  { id: 'news', path: 'news/', fr: 'Nouveautés', en: "What's new" },
  { id: 'compare', path: 'compare/', fr: 'Sans ou avec DevForge', en: 'Without or with DevForge' },
  { id: 'privacy', path: 'privacy/', fr: 'Vie privée', en: 'Privacy' },
  { id: 'contribute', path: 'contribute/', fr: 'Contribuer', en: 'Contribute' }
] as const

/** The section of a page, from its id (« guides/sqlite », « en/privacy »…) */
export function sectionOf(id: string): string {
  const slug = id.replace(/^en(\/|$)/, '')
  if (slug.startsWith('guides/')) return 'guides'
  return SECTIONS.find(s => s.id !== 'docs' && s.path === `${slug}/`)?.id ?? 'docs'
}
