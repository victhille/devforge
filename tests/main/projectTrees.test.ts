import { describe, expect, it } from 'vitest'
import { PROJECT_TREES, drawTree } from '../../src/shared/data/projectTrees'

/** The tree the new project wizard shows, drawn as text */
describe('drawTree', () => {
  it('draws folders, their files and the last entry of each level', () => {
    expect(drawTree('shop', ['app/', '  layout.tsx', '  page.tsx', 'public/', 'README.md'])).toBe([
      'shop/',
      '├─ app/',
      '│  ├─ layout.tsx',
      '│  └─ page.tsx',
      '├─ public/',
      '└─ README.md'
    ].join('\n'))
  })

  it('ends on a folder\'s files', () => {
    expect(drawTree('x', ['README.md', 'src/', '  index.ts'])).toBe(['x/', '├─ README.md', '└─ src/', '   └─ index.ts'].join('\n'))
  })

  it('has a tree for every technology of the wizard', () => {
    for (const id of ['react', 'nextjs', 'vue', 'nodejs', 'symfony', 'laravel', 'empty'] as const) expect(PROJECT_TREES[id]?.entries.length).toBeGreaterThan(0)
  })
})
