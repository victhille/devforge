import { mkdirSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { saveProjects, tempDir } from '../helpers'

const vercel = await import('../../src/main/services/vercel/vercelService')
const account = await import('../../src/main/services/vercel/vercelAccount')

/** The Vercel page: every project of the account or a team, and its three writes */
describe('Vercel account page', () => {
  const requests: { url: string; method: string }[] = []
  let linked: string
  let free: string

  beforeEach(async () => {
    requests.length = 0
    linked = tempDir('shop')
    free = tempDir('docs')
    mkdirSync(join(linked, '.vercel'))
    writeFileSync(join(linked, '.vercel', 'project.json'), JSON.stringify({ projectId: 'prj_shop', orgId: 'team_9' }))
    writeFileSync(join(free, '.gitignore'), 'node_modules')
    saveProjects([
      { name: 'shop', path: linked },
      { name: 'docs', path: free }
    ])
    vi.stubGlobal('fetch', async (input: URL, init: RequestInit) => {
      const url = String(input)
      requests.push({ url, method: init.method ?? 'GET' })
      const json = (o: unknown) => new Response(JSON.stringify(o), { status: 200 })
      const path = new URL(url).pathname
      if (path === '/v2/user') return json({ user: { id: 'usr_1', username: 'vic' } })
      if (path === '/v2/teams')
        return json({
          teams: [
            { id: 'team_9', name: 'Client', slug: 'client' },
            { id: 'bad id', slug: 'x' }
          ]
        })
      if (path === '/v9/projects')
        return json({
          projects: [
            {
              id: 'prj_shop',
              name: 'shop',
              framework: 'nextjs',
              targets: { production: { id: 'dpl_live', alias: ['shop.vercel.app'] } },
              latestDeployments: [
                { uid: 'dpl_old', readyState: 'READY', createdAt: 1, meta: {} },
                {
                  uid: 'dpl_live',
                  readyState: 'READY',
                  createdAt: 5,
                  target: 'production',
                  meta: { githubCommitRef: 'main', githubCommitMessage: 'feat: cart\n\nbody' }
                }
              ]
            },
            { id: 'prj_docs', name: 'docs', framework: null }
          ]
        })
      if (path === '/v9/projects/prj_docs') return json({ id: 'prj_docs', name: 'docs' })
      if (path === '/v6/deployments')
        return json({
          deployments: [
            { uid: 'dpl_new', url: 'shop-new.vercel.app', name: 'shop', state: 'BUILDING', created: 9, meta: {} },
            { uid: 'dpl_live', url: 'shop-live.vercel.app', name: 'shop', projectId: 'prj_shop', state: 'READY', target: 'production', created: 5, meta: {} }
          ]
        })
      if (path === '/v5/domains') return json({ domains: [{ name: 'shop.example.com', verified: true, boughtAt: 3, expiresAt: 10 }] })
      if (path.startsWith('/v6/domains/')) return json({ misconfigured: true })
      if (path === '/v3/deployments/dpl_new/events')
        return json([{ payload: { text: 'Connecting to postgres://app:hunter2@db.example.com/shop' } }, { text: 'Error: build failed' }])
      return json({})
    })
    await vercel.saveToken('good')
  })
  afterEach(() => vi.unstubAllGlobals())

  it('lists the teams, the projects with their DevForge folder, the deployments and the domains', async () => {
    expect(await account.scopes()).toEqual({ username: 'vic', teams: [{ id: 'team_9', name: 'Client', slug: 'client' }] })

    const projects = await account.accountProjects('team_9')
    expect(requests.at(-1)?.url).toContain('teamId=team_9')
    expect(projects[0]).toMatchObject({
      id: 'prj_shop',
      productionUrl: 'https://shop.vercel.app',
      latest: { id: 'dpl_live', branch: 'main', commitMessage: 'feat: cart' },
      local: { id: 'p0', name: 'shop' }
    })
    expect(projects[1]).toMatchObject({ id: 'prj_docs', latest: null, local: null })

    const deps = await account.accountDeployments(null)
    // The project id comes from the project list when the deployment does not carry it
    expect(deps.map(d => [d.id, d.projectId, d.current])).toEqual([
      ['dpl_new', 'prj_shop', false],
      ['dpl_live', 'prj_shop', true]
    ])

    expect(await account.accountDomains(null)).toEqual([{ name: 'shop.example.com', verified: true, misconfigured: true, boughtAtVercel: true, expiresAt: 10 }])
  })

  it('reads a build log with its secrets masked, since it is shown and can go to Forgy', async () => {
    const text = await account.accountBuildLogs('team_9', 'dpl_new')
    expect(text).toBe('Connecting to postgres://app:***@db.example.com/shop\nError: build failed')
    expect(requests.at(-1)?.url).toContain('teamId=team_9')
  })

  it('cancels and promotes in the chosen scope only, with ids it checked', async () => {
    await account.cancelDeployment('team_9', 'dpl_new')
    expect(requests.at(-1)).toEqual({ url: 'https://api.vercel.com/v12/deployments/dpl_new/cancel?teamId=team_9', method: 'PATCH' })
    await account.promoteIn(null, 'prj_shop', 'dpl_live')
    expect(requests.at(-1)).toEqual({ url: 'https://api.vercel.com/v10/projects/prj_shop/promote/dpl_live', method: 'POST' })

    const before = requests.length
    await expect(account.cancelDeployment('team_9', '../v2/user')).rejects.toThrow('Invalid deployment')
    await expect(account.promoteIn('usr_1', 'prj_shop', 'dpl_live')).rejects.toThrow('Invalid team')
    await expect(account.accountProjects('team_9?x=1' as string)).rejects.toThrow('Invalid team')
    expect(requests.length).toBe(before)
  })

  it('links a free folder like `vercel link`, and leaves a folder linked elsewhere alone', async () => {
    await account.linkProject('p1', null, 'prj_docs')
    expect(JSON.parse(readFileSync(join(free, '.vercel', 'project.json'), 'utf-8'))).toEqual({ projectId: 'prj_docs', orgId: 'usr_1', projectName: 'docs' })
    expect(readFileSync(join(free, '.gitignore'), 'utf-8')).toBe('node_modules\n.vercel\n')
    // Twice: the .gitignore keeps one line
    await account.linkProject('p1', null, 'prj_docs')
    expect(readFileSync(join(free, '.gitignore'), 'utf-8')).toBe('node_modules\n.vercel\n')

    await expect(account.linkProject('p0', null, 'prj_docs')).rejects.toThrow('ALREADY_LINKED')
    expect(JSON.parse(readFileSync(join(linked, '.vercel', 'project.json'), 'utf-8')).projectId).toBe('prj_shop')
    await expect(account.linkProject('nope', null, 'prj_docs')).rejects.toThrow('Unknown project')
  })
})
