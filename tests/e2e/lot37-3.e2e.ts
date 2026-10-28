import { expect, test } from '@playwright/test'
import { execFileSync } from 'child_process'
import { mkdirSync, rmSync, writeFileSync } from 'fs'
import { join } from 'path'
import { goTo, launch, type Launched } from './launch'
import { settledAxeIssues as settledAxe } from './axe'

/** v3.7 lot 3: Git in the file tree (piste A): colours and letters, a dot on folders, "Modified only", the diff */
let run: Launched
test.afterEach(async () => {
  expect(run.errors, 'uncaught page errors').toEqual([])
  await run.close()
})

const file = (path: string, content: string) => { mkdirSync(join(path, '..'), { recursive: true }); writeFileSync(path, content) }
const git = (cwd: string, ...args: string[]) => execFileSync('git', ['-c', 'user.name=Test', '-c', 'user.email=test@example.invalid', ...args], { cwd })

test('changed files are marked in the tree, the tree reduces to them, a change shows as a diff', async () => {
  run = await launch({
    seed: dir => {
      const shop = join(dir, 'shop')
      file(join(shop, 'package.json'), '{}\n')
      file(join(shop, 'src', 'cart', 'total.ts'), 'export function total(items) {\n  let sum = 0\n  for (const i of items) sum += i.price\n  return sum\n}\n')
      file(join(shop, 'src', 'api', 'legacy.ts'), 'export const legacy = true\n')
      file(join(shop, 'README.md'), '# shop\n')
      git(shop, 'init', '-q', '-b', 'main')
      git(shop, 'add', '-A')
      git(shop, 'commit', '-q', '-m', 'first')
      file(join(shop, 'src', 'cart', 'total.ts'), 'export function total(items) {\n  let sum = 0\n  for (const i of items) sum += i.price * i.qty\n  return sum\n}\n')
      file(join(shop, 'src', 'cart', 'coupon.ts'), 'export const coupon = 10\n')
      rmSync(join(shop, 'src', 'api', 'legacy.ts'))
      writeFileSync(join(dir, 'projects.json'), JSON.stringify([{ id: 'p', name: 'shop', path: shop, framework: 'react', packageManager: 'npm', favorite: false, createdAt: '', lastOpenedAt: null }]))
    }
  })
  const { page } = run
  await goTo(page, '/project/p?tab=files')

  // The folder holding changes has its dot; open it: letters and colours
  const src = page.getByRole('button', { name: 'src', exact: true })
  await expect(src.getByTestId('dir-changed')).toBeVisible()
  await expect(page.getByRole('button', { name: 'README.md' }).getByTestId('dir-changed')).toHaveCount(0)
  await src.click()
  await page.getByRole('button', { name: 'cart', exact: true }).click()
  await expect(page.getByRole('button', { name: /^total\.ts/ }).getByLabel('modifié')).toHaveText('M')
  await expect(page.getByRole('button', { name: /^coupon\.ts/ }).getByLabel('nouveau, pas encore dans Git')).toHaveText('A')
  await page.getByRole('button', { name: 'api', exact: true }).click()
  // Deleted: still in the tree, struck through
  await expect(page.getByRole('button', { name: /^legacy\.ts/ }).getByLabel('supprimé')).toHaveText('D')

  // A modified file: the file, then its changes
  await page.getByRole('button', { name: /^total\.ts/ }).click()
  await page.getByRole('button', { name: 'Changements' }).click()
  const diff = page.getByTestId('diff-view')
  // Old line 3 removed, new line 3 added
  await expect(diff.locator('[data-kind="del"]')).toHaveText([/^3\s*−\s*for \(const i of items\) sum \+= i\.price$/])
  await expect(diff.locator('[data-kind="add"]')).toContainText('sum += i.price * i.qty')
  expect(await settledAxe(page)).toEqual([])

  // Modified only: the three changes, each opening on its diff
  await page.getByRole('button', { name: 'Modifiés seulement · 3' }).click()
  await expect(page.getByRole('button', { name: /^(total|coupon|legacy)\.ts/ })).toHaveCount(3)
  await expect(page.getByRole('button', { name: 'README.md' })).toHaveCount(0)
  await page.getByRole('button', { name: /^coupon\.ts/ }).click()
  await expect(page.getByTestId('diff-view').locator('[data-kind="add"]')).toContainText('export const coupon = 10')
  await page.getByRole('button', { name: /^legacy\.ts/ }).click()
  await expect(page.getByTestId('diff-view').locator('[data-kind="del"]')).toContainText('export const legacy = true')
})
