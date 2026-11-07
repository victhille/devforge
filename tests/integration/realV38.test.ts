import { existsSync, readdirSync, readFileSync, writeFileSync } from 'fs'
import { basename, join } from 'path'
import { execFileSync } from 'child_process'
import { describe, expect, it } from 'vitest'
import { asleep, commitsByWeek, mostActive, toFollow } from '@shared/lib/activity'
import { latestByWorkflow } from '@shared/lib/ciAlerts'
import { DEFAULT_EXCLUDE } from '@shared/lib/userTemplates'
import { getActivity } from '../../src/main/services/git/activity'
import { latestRuns } from '../../src/main/services/github/githubService'
import { extractTemplate, removeTemplate, saveTemplate } from '../../src/main/services/projects/userTemplates'
import { tempDir } from '../helpers'

/**
 * v3.8 lot 6: on this PC's real projects, read only. Opt-in:
 *   DEVFORGE_REAL_V38="<projects folder>;<another folder>"  the activity of every folder in them
 *   DEVFORGE_REAL_V38_TEMPLATE=<a project>                    saved as a template, then a renamed copy that installs
 * The CI check reads this repository's GitHub Actions (GitHub CLI connected).
 */
const dirs = (process.env.DEVFORGE_REAL_V38 ?? '').split(';').filter(Boolean)
const source = process.env.DEVFORGE_REAL_V38_TEMPLATE ?? ''

describe.skipIf(!dirs.length)('v3.8 on real projects', () => {
  it('reads the activity of every project of the folders in under two seconds', async () => {
    const paths = dirs.flatMap(d => readdirSync(d, { withFileTypes: true }).filter(e => e.isDirectory() && !e.name.startsWith('.')).map(e => join(d, e.name)))
    writeFileSync(join(process.env.DEVFORGE_TEST_USERDATA!, 'projects.json'), JSON.stringify(paths.map((path, i) => ({
      id: `p${i}`, name: basename(path), path, framework: 'other', packageManager: 'npm', favorite: false, createdAt: '', lastOpenedAt: null
    }))))
    const start = Date.now()
    const data = await getActivity(true)
    const ms = Date.now() - start
    const now = Math.floor(Date.now() / 1000)
    const repos = data.projects.filter(p => p.lastCommitAt !== null)
    const weeks = commitsByWeek(data.projects, now, c => !data.me || c.email === data.me)
    console.info(`${paths.length} folders, ${repos.length} repositories in ${ms} ms; ${weeks.reduce((n, w) => n + w.total, 0)} commits of mine in 12 weeks, `
      + `${mostActive(data.projects, now).length} active this month, ${asleep(data.projects, now).length} asleep, ${toFollow(data.projects).length} to push or pull`)
    expect(repos.length).toBeGreaterThan(0)
    expect(ms).toBeLessThan(2000)
  })

  it("reads this repository's last GitHub Actions run per workflow", async () => {
    const runs = await latestRuns(process.cwd())
    expect(runs).not.toBeNull()
    const latest = latestByWorkflow(runs!)
    console.info(Object.entries(latest).map(([w, r]) => `${w}: ${r.outcome} (${r.branch})`).join(', '))
    expect(Object.keys(latest).length).toBeGreaterThan(0)
  })
})

describe.skipIf(!source)('v3.8: a template from a real project', () => {
  it('gives a renamed copy without .env, node_modules or Git history, which installs', async () => {
    const tpl = await saveTemplate({ projectPath: source, name: 'real', description: '', framework: 'nodejs', packageManager: 'npm', exclude: DEFAULT_EXCLUDE })
    const dest = join(tempDir('real-tpl'), 'copy-of-real')
    try {
      await extractTemplate(tpl.id, dest, 'copy-of-real')
      for (const gone of ['.env', '.env.local', 'node_modules', '.git']) expect(existsSync(join(dest, gone)), gone).toBe(false)
      if (existsSync(join(dest, 'package.json'))) {
        // Replaced only where the project named itself
        const named = JSON.parse(readFileSync(join(source, 'package.json'), 'utf-8')).name !== undefined
        expect(JSON.parse(readFileSync(join(dest, 'package.json'), 'utf-8')).name).toBe(named ? 'copy-of-real' : undefined)
        execFileSync('npm', ['install', '--ignore-scripts', '--no-audit', '--no-fund'], { cwd: dest, shell: true, stdio: 'ignore', timeout: 240_000 })
        expect(existsSync(join(dest, 'node_modules'))).toBe(true)
      }
      console.info(`${tpl.files} files, ${Math.round(tpl.bytes / 1024)} KB`)
    } finally { removeTemplate(tpl.id) }
  }, 300_000)
})
