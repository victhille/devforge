import { describe, expect, it } from 'vitest'
import { deployMethod, deploySteps, scriptLines, shortDuration, stepKind, stepStates } from '../../src/renderer/src/features/deploy/deploySteps'

const COMPOSE = 'git pull\nCOMMIT=$(git rev-parse --short HEAD) docker compose build\ndocker compose up -d\ndocker image prune -f\ncurl -fsS --retry 5 http://127.0.0.1:8090/health'

describe('deploy steps', () => {
  it('reads the lines that run, as the main process does', () => {
    expect(scriptLines('git pull\n\n  # a comment\nnpm ci  \r\nnpm run build')).toEqual(['git pull', 'npm ci', 'npm run build'])
  })

  it('sees a build through run with every package manager, as a detected deploy writes it', () => {
    expect(['npm run build', 'pnpm run build', 'yarn run build', 'pnpm build', 'yarn build'].map(stepKind)).toEqual(['build', 'build', 'build', 'build', 'build'])
    expect(['git pull\npnpm install --frozen-lockfile\npnpm run build', 'git pull\nyarn install --frozen-lockfile\nyarn run build'].map(deployMethod)).toEqual(['static', 'static'])
  })

  it('names each line by what it does', () => {
    expect(['git pull', 'npm ci', 'composer install --no-dev', 'npm run build', 'docker compose pull', 'php artisan migrate --force',
      'php artisan config:cache', 'pm2 reload ecosystem.config.js', 'docker compose up -d', 'docker image prune -f', 'curl -fsS http://x', 'echo hi'].map(stepKind))
      .toEqual(['pull', 'install', 'install', 'build', 'images', 'migrate', 'cache', 'restart', 'restart', 'clean', 'check', 'command'])
    expect(deploySteps({ script: COMPOSE, pushFirst: true, projectPath: 'C:/code/demo' }).map(s => s.kind))
      .toEqual(['push', 'pull', 'build', 'restart', 'clean', 'check'])
    // No local project: no push, even asked
    expect(deploySteps({ script: 'git pull', pushFirst: true }).map(s => s.kind)).toEqual(['pull'])
  })

  it('follows the run in its log: done, running, failed, to come', () => {
    const steps = deploySteps({ script: 'git pull\nnpm ci\nnpm run build', pushFirst: false })
    const log = '▸ ssh alex@203.0.113.10\n$ git pull\nAlready up to date.\n$ npm ci\nadded 12 packages\n'
    expect(stepStates(log, steps, 'running')).toEqual(['done', 'running', 'pending'])
    expect(stepStates(log, steps, 'failed')).toEqual(['done', 'failed', 'pending'])
    expect(stepStates(`${log}$ npm run build\nok\n`, steps, 'success')).toEqual(['done', 'done', 'done'])
    // Refused before the first line (no SSH): nothing started
    expect(stepStates('▸ ssh alex@203.0.113.10\n✗ connect ECONNREFUSED\n', steps, 'failed')).toEqual(['pending', 'pending', 'pending'])
    // An output that looks like a step does not count: only « $ command » lines
    expect(stepStates('git pull\nnpm ci\n', steps, 'running')).toEqual(['pending', 'pending', 'pending'])
  })

  it('sees the push before the script', () => {
    const steps = deploySteps({ script: 'git pull', pushFirst: true, projectPath: 'C:/code/demo' })
    expect(stepStates('▸ git push (C:/code/demo)\nEverything up-to-date\n', steps, 'running')).toEqual(['running', 'pending'])
  })

  it('tells the method from the script', () => {
    expect([COMPOSE, 'git pull\npm2 restart all', 'php artisan migrate', 'php bin/console cache:clear', 'npm run build', 'make deploy'].map(deployMethod))
      .toEqual(['compose', 'pm2', 'laravel', 'symfony', 'static', 'script'])
  })

  it('says a duration short', () => {
    const u = { min: 'min', s: 's' }
    expect([38_000, 72_000, 160_400].map(ms => shortDuration(ms, u))).toEqual(['38 s', '1 min 12', '2 min 40'])
  })
})
