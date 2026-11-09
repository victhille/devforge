import type { Framework } from '@shared/types'

/**
 * What the new project wizard says will be made, for each technology: the main
 * folders and files of the starter (not every file), and the tool that makes it.
 * The root folder's name is added by the page (the name typed, or a placeholder).
 */
export const PROJECT_TREES: Partial<Record<Framework, { entries: string[]; tool: string }>> = {
  react: { entries: ['src/', '  App.tsx', '  main.tsx', 'public/', 'index.html', 'package.json', 'vite.config.ts', 'README.md'], tool: 'create-vite' },
  nextjs: { entries: ['app/', '  layout.tsx', '  page.tsx', 'public/', 'package.json', 'tsconfig.json', 'README.md'], tool: 'create-next-app' },
  vue: { entries: ['src/', '  App.vue', '  main.ts', '  components/', 'index.html', 'package.json', 'vite.config.ts'], tool: 'create-vite' },
  nodejs: { entries: ['src/', '  index.ts', 'package.json', 'tsconfig.json', '.gitignore', 'README.md'], tool: 'npm init' },
  symfony: { entries: ['bin/', 'config/', 'public/', '  index.php', 'src/', '  Controller/', 'templates/', 'composer.json', '.env'], tool: 'symfony/skeleton' },
  laravel: { entries: ['app/', 'config/', 'database/', 'public/', 'resources/', 'routes/', 'artisan', 'composer.json', '.env'], tool: 'laravel/laravel' },
  empty: { entries: ['README.md', '.gitignore'], tool: 'git init' }
}

/** The tree drawn as text: ├─ and └─ for each entry, │ under an open folder */
export function drawTree(root: string, entries: string[]): string {
  const lines = [`${root}/`]
  entries.forEach((entry, i) => {
    const child = entry.startsWith('  ')
    const name = entry.trim()
    // The last of its level: no entry of the same level after it, before a shallower one
    const rest = entries.slice(i + 1)
    const nextSame = child ? rest.findIndex(e => e.startsWith('  ')) : rest.findIndex(e => !e.startsWith('  '))
    const nextUp = child ? rest.findIndex(e => !e.startsWith('  ')) : -1
    const last = nextSame === -1 || (child && nextUp !== -1 && nextUp < nextSame)
    if (child) {
      // The folder above it: is it the last of the top level?
      const parentLast = !entries.slice(i + 1).some(e => !e.startsWith('  '))
      lines.push(`${parentLast ? '   ' : '│  '}${last ? '└─' : '├─'} ${name}`)
    } else {
      lines.push(`${last ? '└─' : '├─'} ${name}`)
    }
  })
  return lines.join('\n')
}
