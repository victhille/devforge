/** A page of the documentation site in the interface language (French at the root, English under en/); null without a site */
export function docsUrl(slug: string, lang: string): string | null {
  if (!__DOCS_URL__) return null
  return `${__DOCS_URL__}${lang === 'en' ? 'en/' : ''}${slug}/`
}

/** Opens a documentation page in the browser */
export function openDocs(slug: string, lang: string): void {
  const url = docsUrl(slug, lang)
  if (url) void window.devforge.openExternal(url)
}
