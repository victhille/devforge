import type { DetectedDeploy } from '@shared/types'
import { connectSsh, shQuote, sshRun } from '../ssh/sshClient'
import { loadProjects } from '../projects/projectStorage'
import { git } from '../git/gitRepo'

/**
 * Read-only scan: git repositories in the usual web roots (with their origin
 * and top-level files) and PM2 processes with their working directory.
 */
const SCRIPT = `
for d in $(find /var/www /srv /opt "$HOME" -maxdepth 4 -name .git -type d 2>/dev/null | head -60); do
  r=$(dirname "$d")
  echo "R|$r|$(git -C "$r" remote get-url origin 2>/dev/null)|$(git -C "$r" rev-parse --abbrev-ref HEAD 2>/dev/null)|$(ls -A "$r" 2>/dev/null | tr '\\n' ',')"
done
command -v pm2 >/dev/null 2>&1 && pm2 jlist 2>/dev/null | tr -d '\\n' | sed 's/^/P|/'
echo
`

/** git@github.com:me/app.git, https://github.com/me/app → github.com/me/app */
export function normalizeRemote(url: string): string {
  return url.trim().toLowerCase()
    .replace(/^git@([^:]+):/, '$1/')
    .replace(/^(https?|ssh|git):\/\/([^@/]+@)?/, '')
    .replace(/\/+$/, '')
    .replace(/\.git$/, '')
}

interface Pm2App { name: string; pm2_env?: { pm_cwd?: string } }

function pickScript(files: string[], branch: string, pm2App?: string): { preset: string; script: string } {
  const has = (f: string) => files.includes(f)
  const pull = branch && branch !== 'HEAD' ? `git pull origin ${branch}` : 'git pull'
  if (has('docker-compose.yml') || has('docker-compose.yaml') || has('compose.yml') || has('compose.yaml')) {
    return { preset: 'Docker Compose', script: `${pull}\ndocker compose pull\ndocker compose up -d --build\ndocker image prune -f` }
  }
  if (has('artisan')) {
    return { preset: 'Laravel', script: `${pull}\ncomposer install --no-dev --optimize-autoloader\nphp artisan migrate --force\nphp artisan config:cache\nphp artisan route:cache` }
  }
  if (has('composer.json') && has('bin')) {
    return { preset: 'Symfony', script: `${pull}\ncomposer install --no-dev --optimize-autoloader\nphp bin/console doctrine:migrations:migrate --no-interaction\nphp bin/console cache:clear --env=prod` }
  }
  if (has('package.json')) {
    const install = has('pnpm-lock.yaml') ? 'pnpm install --frozen-lockfile' : has('yarn.lock') ? 'yarn install --frozen-lockfile' : 'npm ci'
    const build = has('pnpm-lock.yaml') ? 'pnpm build' : has('yarn.lock') ? 'yarn build' : 'npm run build'
    const restart = pm2App ? `\npm2 restart ${pm2App} --update-env` : ''
    return { preset: pm2App ? 'Node.js + PM2' : 'Node.js', script: `${pull}\n${install}\n${build}${restart}` }
  }
  return { preset: 'git pull', script: pull }
}

export async function detectDeploys(sshConnectionId: string): Promise<DetectedDeploy[]> {
  const client = await connectSsh(sshConnectionId)
  let output: string
  try {
    output = (await sshRun(client, `bash -lc ${shQuote(SCRIPT)}`, 30_000)).output
  } finally {
    client.end()
  }

  let pm2: Pm2App[] = []
  const pm2Line = output.split('\n').find(l => l.startsWith('P|'))
  if (pm2Line) { try { pm2 = JSON.parse(pm2Line.slice(2)) } catch { /* not JSON */ } }

  // Local projects by normalized origin, to link remote checkouts to them
  const locals = await Promise.all(loadProjects().map(async p => {
    const r = await git(p.path, ['remote', 'get-url', 'origin'], 4000)
    return { project: p, remote: r.ok ? normalizeRemote(r.stdout) : '' }
  }))

  const found: DetectedDeploy[] = []
  for (const line of output.split('\n')) {
    if (!line.startsWith('R|')) continue
    const [, remotePath, origin, branch, filesRaw] = line.split('|')
    if (!remotePath) continue
    const files = (filesRaw ?? '').split(',').filter(Boolean)
    const pm2App = pm2.find(a => a.pm2_env?.pm_cwd?.replace(/\/$/, '') === remotePath)?.name
    const local = origin ? locals.find(l => l.remote && l.remote === normalizeRemote(origin)) : undefined
    const { preset, script } = pickScript(files, branch ?? '', pm2App)
    found.push({
      remotePath,
      origin: origin || null,
      branch: branch || null,
      pm2App: pm2App ?? null,
      preset,
      script,
      projectPath: local?.project.path ?? null,
      projectName: local?.project.name ?? null
    })
  }
  // Linked to a local project first
  return found.sort((a, b) => Number(!!b.projectPath) - Number(!!a.projectPath) || a.remotePath.localeCompare(b.remotePath))
}
