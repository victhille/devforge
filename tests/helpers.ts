import { mkdirSync, mkdtempSync, writeFileSync } from 'fs'
import { join } from 'path'

/** userData folder of the current test file (see setup.ts) */
export const userData = () => process.env.DEVFORGE_TEST_USERDATA!

/** New empty folder inside the test userData */
export function tempDir(name = 'dir'): string {
  const base = join(userData(), 'tmp')
  mkdirSync(base, { recursive: true })
  return mkdtempSync(join(base, `${name}-`))
}

/** Register folders as saved DevForge projects */
export function saveProjects(projects: { name: string; path: string; framework?: string }[]): void {
  writeFileSync(join(userData(), 'projects.json'), JSON.stringify(projects.map((p, i) => ({
    id: `p${i}`, name: p.name, path: p.path, type: 'node', favorite: false, createdAt: '', lastOpened: null, ...(p.framework ? { framework: p.framework } : {})
  }))))
}
