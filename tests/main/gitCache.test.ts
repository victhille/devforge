import { execFileSync } from 'child_process'
import { writeFileSync } from 'fs'
import { join } from 'path'
import { describe, expect, it } from 'vitest'
import { forgetRepo, getRepoDetails, gitCommit } from '../../src/main/services/git/gitRepo'
import { tempDir } from '../helpers'

const git = (cwd: string, ...args: string[]) => execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', ...args], { cwd })

describe('repository details cache', () => {
  it('reuses recent details, re-reads when asked or after an action', async () => {
    const repo = tempDir('repo')
    git(repo, 'init', '-q')
    // DevForge's own commit uses the repository identity: CI machines have no global one
    git(repo, 'config', 'user.name', 't'); git(repo, 'config', 'user.email', 't@t')
    writeFileSync(join(repo, 'a.txt'), 'a')
    git(repo, 'add', '.'); git(repo, 'commit', '-qm', 'first')

    expect((await getRepoDetails(repo)).changes).toBe(0)
    writeFileSync(join(repo, 'b.txt'), 'b')
    // Within a few seconds the cached value comes back…
    expect((await getRepoDetails(repo)).changes).toBe(0)
    // …unless a fresh read is asked (refresh button)
    expect((await getRepoDetails(repo, true)).changes).toBe(1)

    // An action from DevForge forgets the cache
    await gitCommit(repo, 'second', ['b.txt'])
    expect((await getRepoDetails(repo)).changes).toBe(0)
    forgetRepo(repo)
    expect((await getRepoDetails(repo)).lastCommit?.message).toBe('second')
  })

  it('reads many repositories without failing (6 at a time)', async () => {
    const repos = Array.from({ length: 14 }, () => { const r = tempDir('many'); git(r, 'init', '-q'); return r })
    const all = await Promise.all(repos.map(r => getRepoDetails(r, true)))
    expect(all.every(d => d.isRepo)).toBe(true)
  })
})
