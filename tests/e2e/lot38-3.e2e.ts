import { expect, test } from '@playwright/test'
import { execFileSync } from 'child_process'
import { mkdirSync, writeFileSync } from 'fs'
import { join } from 'path'
import { launch, type Launched } from './launch'
import { settledAxeIssues as settledAxe } from './axe'

/** v3.8 lot 3: the Activity page (piste A), read from real Git repositories */
let run: Launched
test.afterEach(async () => {
  expect(run.errors, 'uncaught page errors').toEqual([])
  await run.close()
})

const DAY = 24 * 3600
const commit = (cwd: string, email: string, daysAgo: number, file: string) => {
  writeFileSync(join(cwd, file), `${file} ${daysAgo}\n`)
  const date = `${Math.floor(Date.now() / 1000) - daysAgo * DAY} +0000`
  execFileSync('git', ['add', '.'], { cwd })
  execFileSync('git', ['-c', 'user.name=Test', '-c', `user.email=${email}`, 'commit', '-q', '-m', file], { cwd, env: { ...process.env, GIT_AUTHOR_DATE: date, GIT_COMMITTER_DATE: date } })
}

test('commits per week, the most active, those asleep and the branches to push; mine or everyone', async () => {
  run = await launch({
    seed: dir => {
      writeFileSync(join(dir, 'gitconfig'), '[user]\n\temail = me@example.invalid\n')
      const repo = (name: string) => {
        const p = join(dir, name)
        mkdirSync(p, { recursive: true })
        execFileSync('git', ['init', '-q', '-b', 'main'], { cwd: p })
        return p
      }
      const shop = repo('shop'), blog = repo('blog'), old = repo('old-site')
      for (let i = 0; i < 4; i++) commit(shop, 'me@example.invalid', i * 3 + 1, `a${i}.txt`)
      commit(shop, 'friend@example.invalid', 2, 'f.txt')
      commit(blog, 'me@example.invalid', 20, 'b.txt')
      commit(old, 'me@example.invalid', 200, 'o.txt')
      // shop has a remote one commit behind: 1 to push
      const remote = join(dir, 'remote.git')
      execFileSync('git', ['clone', '-q', '--bare', shop, remote])
      execFileSync('git', ['remote', 'add', 'origin', remote], { cwd: shop })
      execFileSync('git', ['fetch', '-q', 'origin'], { cwd: shop })
      execFileSync('git', ['branch', '-q', '-u', 'origin/main'], { cwd: shop })
      commit(shop, 'me@example.invalid', 0, 'new.txt')
      const p = (id: string, name: string, path: string) => ({ id, name, path, framework: 'other', packageManager: 'npm', favorite: false, createdAt: '', lastOpenedAt: null })
      writeFileSync(join(dir, 'projects.json'), JSON.stringify([p('s', 'shop', shop), p('b', 'blog', blog), p('o', 'old-site', old)]))
    },
    settings: { homeWidgets: [{ id: 'commits', size: 'half' }] },
    env: { GIT_CONFIG_GLOBAL: '{userData}/gitconfig' }
  })
  const { page } = run
  // Home: this week's commits (mine) and the branch to push
  const widget = page.getByTestId('commits-widget')
  await expect(widget).toContainText('commits cette semaine')
  await expect(widget).toContainText('shop')
  await expect(widget).toContainText('1 à pousser')
  await page.getByRole('button', { name: 'Activité', exact: true }).click()
  await expect(page.locator('main h1')).toHaveText('Activité')

  // Mine: 5 in shop + 1 in blog; the friend's is left out
  await expect(page.getByTestId('activity-chart')).toHaveAttribute('aria-label', /6 en tout/)
  const active = page.getByTestId('most-active')
  await expect(active.getByRole('listitem').first()).toContainText('shop')
  await expect(active.getByRole('listitem').first()).toContainText('5 commit(s)')
  await expect(active).toContainText('blog')
  await page.getByRole('group', { name: 'Auteur des commits' }).getByRole('button', { name: 'Tout le monde' }).click()
  await expect(page.getByTestId('activity-chart')).toHaveAttribute('aria-label', /7 en tout/)
  await expect(active.getByRole('listitem').first()).toContainText('6 commit(s)')

  await expect(page.getByTestId('asleep')).toContainText('old-site')
  await expect(page.getByTestId('asleep')).not.toContainText('blog')
  await expect(page.getByTestId('to-follow')).toContainText('shop · main')
  await expect(page.getByTestId('to-follow')).toContainText('1 à pousser')
  expect(await settledAxe(page)).toEqual([])

  // A project opens its page
  await page.getByTestId('to-follow').getByRole('button', { name: /shop/ }).click()
  await expect(page).toHaveURL(/\/project\/s\?tab=git/)
})
