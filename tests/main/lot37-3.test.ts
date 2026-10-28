import { execFileSync } from 'child_process'
import { mkdirSync, rmSync, writeFileSync } from 'fs'
import { join } from 'path'
import { describe, expect, it } from 'vitest'
import { newFileDiff, parseUnifiedDiff } from '../../src/shared/lib/unifiedDiff'
import { getFileDiff, getFileStates } from '../../src/main/services/git/gitRepo'
import { saveProject } from '../../src/main/services/projects/projectStorage'
import { tempDir } from '../helpers'

/** v3.7 lot 3: Git in the file tree */
const file = (path: string, content: string) => { mkdirSync(join(path, '..'), { recursive: true }); writeFileSync(path, content) }
const git = (cwd: string, ...args: string[]) => execFileSync('git', ['-c', 'user.name=Test', '-c', 'user.email=test@example.invalid', ...args], { cwd })

describe('v3.7 lot 3: a unified diff read', () => {
  it('numbers old and new lines, counts what changed', () => {
    const d = parseUnifiedDiff([
      'diff --git a/src/total.ts b/src/total.ts', 'index 1..2 100644', '--- a/src/total.ts', '+++ b/src/total.ts',
      '@@ -12,4 +12,5 @@ export function total()', '   let sum = 0', '-  return sum', '+  sum = round(sum)', '+  return sum', ' }', '\\ No newline at end of file'
    ].join('\n'))
    expect(d).toMatchObject({ added: 2, removed: 1, binary: false })
    expect(d.hunks[0].lines.map(l => [l.kind, l.oldNo, l.newNo])).toEqual([['context', 12, 12], ['del', 13, null], ['add', null, 13], ['add', null, 14], ['context', 14, 15]])
    expect(parseUnifiedDiff('Binary files a/logo.png and b/logo.png differ').binary).toBe(true)
    expect(parseUnifiedDiff(newFileDiff('a\nb\n')).hunks[0].lines.map(l => [l.kind, l.newNo, l.text])).toEqual([['add', 1, 'a'], ['add', 2, 'b']])
  })
})

describe('v3.7 lot 3: a project\'s changed files', () => {
  it('lists them relative to the project (a sub-folder of the repository too), and gives each one\'s diff', async () => {
    const repo = tempDir('gitrepo')
    git(repo, 'init', '-q', '-b', 'main')
    file(join(repo, 'front', 'src', 'total.ts'), 'let sum = 0\nreturn sum\n')
    file(join(repo, 'front', 'src', 'old.ts'), 'gone\n')
    file(join(repo, 'front', 'README.md'), '# front\n')
    file(join(repo, 'back', 'app.py'), 'print(1)\n')
    git(repo, 'add', '-A')
    git(repo, 'commit', '-q', '-m', 'first')
    // Modified, new (not added), staged new, deleted; and a change outside the project
    file(join(repo, 'front', 'src', 'total.ts'), 'let sum = 0\nsum = round(sum)\nreturn sum\n')
    file(join(repo, 'front', 'src', 'coupon.ts'), 'export const coupon = 1\n')
    file(join(repo, 'front', 'staged.ts'), 'x\n')
    git(repo, 'add', 'front/staged.ts')
    rmSync(join(repo, 'front', 'src', 'old.ts'))
    file(join(repo, 'back', 'app.py'), 'print(2)\n')
    const front = join(repo, 'front')
    saveProject({ id: 'f', name: 'front', path: front, framework: 'react', packageManager: 'npm', createdAt: '', lastOpenedAt: null, favorite: false })

    expect(await getFileStates(front)).toEqual({ inRepo: true, files: {
      'src/total.ts': 'modified', 'src/coupon.ts': 'untracked', 'staged.ts': 'added', 'src/old.ts': 'deleted'
    } })

    const modified = parseUnifiedDiff((await getFileDiff(front, 'src/total.ts')).diff)
    expect(modified.hunks[0].lines.filter(l => l.kind === 'add').map(l => l.text)).toEqual(['sum = round(sum)'])
    expect((await getFileDiff(front, 'src/coupon.ts')).diff).toContain('+export const coupon = 1')
    expect((await getFileDiff(front, 'src/old.ts')).diff).toContain('-gone')
    await expect(getFileDiff(front, '../back/app.py')).rejects.toThrow()

    const outside = tempDir('nogit')
    saveProject({ id: 'n', name: 'nogit', path: outside, framework: 'react', packageManager: 'npm', createdAt: '', lastOpenedAt: null, favorite: false })
    expect(await getFileStates(outside)).toEqual({ inRepo: false, files: {} })
  })
})
