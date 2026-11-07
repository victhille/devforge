import { mkdirSync, writeFileSync } from 'fs'
import { join } from 'path'
import { describe, expect, it } from 'vitest'
import { buildPattern, fileFilter, findInText } from '../../src/shared/lib/projectSearch'
import { searchProject } from '../../src/main/services/system/projectSearch'
import { saveProject } from '../../src/main/services/projects/projectStorage'
import { fileArgs } from '../../src/main/services/system/ides'
import { tempDir } from '../helpers'

/** v3.6 lot 5: searching a whole project */
const file = (path: string, content: string | Buffer) => { mkdirSync(join(path, '..'), { recursive: true }); writeFileSync(path, content) }
const opts = { regex: false, caseSensitive: false, wholeWord: false, include: '' }

describe('v3.6 lot 5: the pattern, the filter, the lines', () => {
  it('escapes plain text, keeps a regex, says why one is invalid', () => {
    expect((buildPattern('a.b(c)', opts) as RegExp).test('xa.b(c)y')).toBe(true)
    expect((buildPattern('a.b(c)', opts) as RegExp).test('axb(c)')).toBe(false)
    expect((buildPattern('use[A-Z]\\w+', { ...opts, regex: true, caseSensitive: true }) as RegExp).test('useState')).toBe(true)
    expect(buildPattern('(', { ...opts, regex: true })).toHaveProperty('error')
    const word = buildPattern('id', { ...opts, wholeWord: true }) as RegExp
    expect(['id = 1', 'width', 'user_id'].map(s => { word.lastIndex = 0; return word.test(s) })).toEqual([true, false, false])
  })

  it('filters files by name or path, with exclusions', () => {
    const f = fileFilter('*.ts, src/**, !*.test.ts')
    expect(['a.ts', 'deep/x/b.ts', 'src/app.vue', 'README.md', 'src/x.test.ts', 'c.test.ts'].map(f)).toEqual([true, true, true, false, false, false])
    expect(fileFilter('')('anything.bin')).toBe(true)
  })

  it('numbers lines from 1, finds every match, cuts long lines around the match', () => {
    const found = findInText('const a = useState()\r\nfoo\nuseState(); useState()', /useState/g, 10)
    expect(found.map(m => [m.line, m.column])).toEqual([[1, 10], [3, 0], [3, 12]])
    const long = `${'x'.repeat(500)}needle${'y'.repeat(500)}`
    const [m] = findInText(long, /needle/g, 10)
    expect(m.text.slice(m.column, m.column + m.length)).toBe('needle')
    expect(m.text.length).toBe(240)
    expect(findInText('a a a a', /a/g, 2)).toHaveLength(2)
  })
})

describe('v3.6 lot 5: a saved project searched', () => {
  it('looks in its files, never in dependencies, builds or binaries; refuses a folder that is not a project', async () => {
    const root = tempDir('search')
    file(join(root, 'src', 'App.tsx'), 'export function App() {\n  return useAuth()\n}\n')
    file(join(root, 'src', 'auth.ts'), 'export const useAuth = () => null\n')
    file(join(root, 'node_modules', 'lib', 'index.js'), 'useAuth')
    file(join(root, 'dist', 'bundle.js'), 'useAuth')
    file(join(root, 'logo.png'), Buffer.from([0x89, 0x50, 0, 0, 0x75, 0x73, 0x65]))
    saveProject({ id: 's', name: 'search', path: root, framework: 'react', packageManager: 'npm', createdAt: '', lastOpenedAt: null, favorite: false })

    const r = await searchProject(root, 'useAuth', opts)
    expect(r.files.map(f => [f.path, f.matches.map(m => m.line)])).toEqual([['src/App.tsx', [2]], ['src/auth.ts', [1]]])
    expect(r.total).toBe(2)
    expect((await searchProject(root, 'useAuth', { ...opts, include: 'auth.*' })).files.map(f => f.path)).toEqual(['src/auth.ts'])
    expect((await searchProject(tempDir('other'), 'x', opts)).error).toBe('Not a saved project')
  })
})

describe('v3.6 lot 5: a file opened in the IDE at a line', () => {
  const f = 'C:\\p\\src\\a.ts'
  it('says the line each IDE\'s way', () => {
    expect(fileArgs('vscode', f, 'C:\\p', 12)).toEqual(['C:\\p', '-g', 'C:\\p\\src\\a.ts:12'])
    expect(fileArgs('zed', f, 'C:\\p', 12)).toEqual(['C:\\p', 'C:\\p\\src\\a.ts:12'])
    expect(fileArgs('phpstorm', f, 'C:\\p', 12)).toEqual(['--line', '12', f])
    expect(fileArgs('notepadpp', f, null, 12)).toEqual(['-n12', f])
    expect(fileArgs('visualstudio', f, null, 12)).toEqual([f])
    expect(fileArgs('vscode', f, 'C:\\p')).toEqual(['C:\\p', f])
  })
})
