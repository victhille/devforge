import type { CustomCommand } from '@shared/types'
import type { DocEntry, DocSection, DocTech } from './data'

/** A command of the page; one added by the user carries its own */
export type Entry = DocEntry & { custom?: CustomCommand }
export type Tech = Omit<DocTech, 'sections'> & { sections: (Omit<DocSection, 'entries'> & { entries: Entry[] })[] }

const key = (s: string) => s.trim().toLowerCase()
const owns = (d: DocTech, category: string) => key(category) === key(d.name) || key(category) === key(d.id)

/** The reference a category goes to: one of the page's, or one of its own */
export function techIdFor(docs: DocTech[], category: string): string {
  return docs.find(d => owns(d, category))?.id ?? `custom:${key(category)}`
}

/**
 * v3.5 lot 5: the page's references with the user's commands: in their
 * reference's "My commands" section, first, or in a reference of their own.
 */
export function withCustom(docs: DocTech[], custom: CustomCommand[], mine: string): Tech[] {
  const toEntry = (c: CustomCommand): Entry => ({ cmd: c.cmd, desc: c.desc, custom: c })
  const known = docs.map(d => {
    const own = custom.filter(c => owns(d, c.category))
    return own.length ? { ...d, sections: [{ title: mine, entries: own.map(toEntry) }, ...d.sections] } : d
  })
  // A new category, named as first typed (vps and VPS are one)
  const others = new Map<string, string>()
  for (const c of custom) if (!docs.some(d => owns(d, c.category)) && !others.has(key(c.category))) others.set(key(c.category), c.category.trim())
  return [
    ...known,
    ...[...others.values()].map(name => ({
      id: `custom:${key(name)}`, name, color: 'var(--color-accent)',
      sections: [{ title: mine, entries: custom.filter(c => key(c.category) === key(name)).map(toEntry) }]
    }))
  ]
}
