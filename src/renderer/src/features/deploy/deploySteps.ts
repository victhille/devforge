import type { DeployStatus, DeployTarget } from '@shared/types'

/**
 * The steps of a deploy as the mock-up shows them: one per line of the script
 * (and the `git push` first when asked), named by what the command does, each
 * done, running, failed or still to come from the log of the run.
 */

export type StepKind = 'push' | 'pull' | 'install' | 'build' | 'images' | 'migrate' | 'cache' | 'restart' | 'clean' | 'check' | 'command'
export type StepState = 'done' | 'running' | 'failed' | 'pending'
export interface DeployStep { kind: StepKind; cmd: string }

/** The script's lines that run, as the main process reads them (no blank line, no comment) */
export const scriptLines = (script: string) => script.split(/\r?\n/).map(l => l.trim()).filter(l => l && !l.startsWith('#'))

const KINDS: [StepKind, RegExp][] = [
  ['images', /\bdocker[ -]compose\b.*\bpull\b/],
  ['pull', /^git (pull|fetch|checkout|reset)\b/],
  ['install', /\b(npm (ci|install|i)|pnpm (install|i)|yarn( install)?$|composer install|pip3? install|bundle install|poetry install)\b/],
  ['build', /\b(npm run build|pnpm( run)? build|yarn build|docker[ -]compose\b.*\bbuild$|go build|cargo build|mvn package)\b/],
  ['migrate', /\b(migrate|doctrine:migrations)\b/],
  ['cache', /\b(cache:clear|config:cache|route:cache|view:cache|optimize)\b/],
  ['restart', /\b(pm2 (restart|reload|start)|systemctl (restart|reload)|docker[ -]compose\b.*\b(up|restart)\b|supervisorctl restart|service \S+ restart)\b/],
  ['clean', /\bprune\b/],
  ['check', /^(curl|wget)\b/]
]

export function stepKind(cmd: string): StepKind {
  return KINDS.find(([, re]) => re.test(cmd))?.[0] ?? 'command'
}

export function deploySteps(target: Pick<DeployTarget, 'script' | 'pushFirst' | 'projectPath'>): DeployStep[] {
  return [
    ...(target.pushFirst && target.projectPath ? [{ kind: 'push' as const, cmd: 'git push' }] : []),
    ...scriptLines(target.script).map(cmd => ({ kind: stepKind(cmd), cmd }))
  ]
}

/** Where each step stands: the main process prints « $ command » before each line, « ▸ git push » before the push */
export function stepStates(log: string, steps: DeployStep[], status: DeployStatus): StepState[] {
  const lines = log.split('\n').map(l => l.trim())
  let started = 0
  let from = 0
  for (const s of steps) {
    const i = lines.findIndex((l, k) => k >= from && (s.kind === 'push' ? l.startsWith('▸ git push') : l === `$ ${s.cmd}`))
    if (i < 0) break
    started++
    from = i + 1
  }
  const last = status === 'running' ? 'running' : status === 'success' ? 'done' : 'failed'
  return steps.map((_, i) => (i < started - 1 ? 'done' : i === started - 1 ? last : status === 'success' ? 'done' : 'pending'))
}

/** How it deploys, read in its script: the ready-made scripts of the editor, else a plain script */
export type DeployMethod = 'compose' | 'pm2' | 'laravel' | 'symfony' | 'static' | 'script'
export function deployMethod(script: string): DeployMethod {
  if (/\bdocker[ -]compose\b/.test(script)) return 'compose'
  if (/\bpm2\b/.test(script)) return 'pm2'
  if (/\bartisan\b/.test(script)) return 'laravel'
  if (/\bbin\/console\b/.test(script)) return 'symfony'
  if (/\b(npm run build|pnpm( run)? build|yarn build)\b/.test(script)) return 'static'
  return 'script'
}

/** « 1 min 12 », « 38 s » */
export function shortDuration(ms: number, units: { min: string; s: string }): string {
  const s = Math.max(0, Math.round(ms / 1000))
  return s < 60 ? `${s} ${units.s}` : `${Math.floor(s / 60)} ${units.min} ${String(s % 60).padStart(2, '0')}`
}
