import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { dirname, join } from 'path'
import { createServer } from 'net'
import { randomBytes, randomUUID } from 'crypto'
import type { CommandResult, LogLine, ProjectCreationOptions, SetupStep } from '@shared/types'
import { composeName, oldVolumes, planSetup, stepCommand } from '@shared/lib/projectSetup'
import { commandRunner } from '../system/commandRunner'
import { saveDbConnection } from '../database/dbStorage'
import { runFile } from '../../lib/exec'

/** Same green as the Database page's second color */
const DB_COLOR = '#3DD68C'

type LogCb = (log: LogLine) => void
type ResultCb = (result: CommandResult) => void

/** True when nothing listens on this port of 127.0.0.1 */
function portFree(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const srv = createServer()
    srv.once('error', () => resolve(false))
    srv.listen(port, '127.0.0.1', () => srv.close(() => resolve(true)))
  })
}

export async function freePort(start: number): Promise<number> {
  const first = Number.isInteger(start) && start > 0 && start < 65536 ? start : 5432
  for (let p = first; p < Math.min(first + 50, 65536); p++) if (await portFree(p)) return p
  return first
}

/** Docker volumes of an earlier database of this project's name (empty when Docker is off) */
export async function previousVolumes(name: string): Promise<string[]> {
  const r = await runFile('docker', ['volume', 'ls', '--format', '{{.Name}}'], { timeout: 15_000 })
  return r.ok ? oldVolumes(name, r.stdout.split(/\r?\n/).map(l => l.trim()).filter(Boolean)) : []
}

/** GitHub CLI's account (the one `gh repo create` uses), null when gh is missing or logged out */
export async function githubLogin(): Promise<string | null> {
  const r = await runFile('gh', ['api', 'user', '--jq', '.login'], { timeout: 10_000 })
  const login = r.stdout.trim()
  return r.ok && /^[\w-]+$/.test(login) ? login : null
}

/** Sets or replaces KEY=value lines, keeps the rest of the file */
export function mergeEnv(text: string, vars: Record<string, string>): string {
  const lines = text ? text.replace(/\r\n/g, '\n').replace(/\n$/, '').split('\n') : []
  for (const [key, value] of Object.entries(vars)) {
    const line = `${key}="${value}"`
    const i = lines.findIndex(l => new RegExp(`^\\s*${key}\\s*=`).test(l))
    if (i >= 0) lines[i] = line; else lines.push(line)
  }
  return lines.join('\n') + '\n'
}

/** Adds the lines .gitignore does not have yet */
export function mergeIgnore(text: string, add: string[]): string {
  const have = new Set(text.split(/\r?\n/).map(l => l.trim()))
  const missing = add.filter(l => !have.has(l) && !have.has(l.replace(/^\//, '')))
  if (!missing.length) return text
  return (text && !text.endsWith('\n') ? text + '\n' : text) + missing.join('\n') + '\n'
}

/** {app} and {src}: where Next.js keeps its app folder */
function resolvePath(projPath: string, p: string): string {
  const src = existsSync(join(projPath, 'src', 'app')) ? 'src/' : ''
  return p.replaceAll('{app}', `${src}app`).replaceAll('{src}', src)
}

/** The step with {app} and {src} resolved, as it runs and as the log shows it */
function resolveStep(step: SetupStep, projPath: string): SetupStep {
  const r = (p: string) => resolvePath(projPath, p)
  switch (step.kind) {
    case 'run':    return { ...step, args: step.args.map(r) }
    case 'write':  return { ...step, files: step.files.map(f => ({ ...f, path: r(f.path) })) }
    case 'ignore': return { ...step, lines: step.lines.map(r) }
    default:       return step
  }
}

/** Adds Tailwind's Vite plugin to a vite.config: its import, then first in plugins: [...] */
export function withVitePlugin(text: string): string {
  if (text.includes('@tailwindcss/vite')) return text
  if (!/plugins:\s*\[/.test(text)) throw new Error('vite.config : liste « plugins » introuvable')
  const lines = text.split('\n')
  const last = lines.reduce((at, l, i) => /^import\s/.test(l) ? i : at, -1)
  lines.splice(last + 1, 0, "import tailwindcss from '@tailwindcss/vite'")
  return lines.join('\n').replace(/plugins:\s*\[/, m => `${m}tailwindcss(), `)
}

/** Stylesheets the templates load first (Vite React, Vite Vue, Next.js) */
const MAIN_CSS = ['src/index.css', 'src/style.css', 'src/app/globals.css', 'app/globals.css']

const firstFile = (projPath: string, names: string[]) => names.map(n => join(projPath, n)).find(existsSync)

function setUpTailwind(projPath: string, via: 'vite' | 'postcss'): void {
  if (via === 'vite') {
    const config = firstFile(projPath, ['vite.config.ts', 'vite.config.js', 'vite.config.mts', 'vite.config.mjs'])
    if (!config) throw new Error('vite.config introuvable')
    writeText(config, withVitePlugin(readText(config)))
  } else if (!firstFile(projPath, ['postcss.config.mjs', 'postcss.config.js', 'postcss.config.cjs'])) {
    writeText(join(projPath, 'postcss.config.mjs'), "export default {\n  plugins: { '@tailwindcss/postcss': {} }\n}\n")
  }
  const css = firstFile(projPath, MAIN_CSS)
  if (!css) return
  const text = readText(css)
  if (!/@import\s+["']tailwindcss["']/.test(text)) writeText(css, `@import "tailwindcss";\n\n${text}`)
}

function writeText(file: string, content: string): void {
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, content)
}

const readText = (file: string) => existsSync(file) ? readFileSync(file, 'utf-8') : ''

/** The runner's own messages */
const MESSAGES = {
  fr: {
    done: 'déjà en place', none: (f: string) => `sans objet (pas de ${f})`, failed: 'échec, la suite continue',
    docker: 'Docker ne répond pas. Lance Docker Desktop, puis « docker compose up -d » dans le projet ; la suite continue.'
  },
  en: {
    done: 'already in place', none: (f: string) => `not needed (no ${f})`, failed: 'failed, carrying on',
    docker: 'Docker is not responding. Start Docker Desktop, then "docker compose up -d" in the project; carrying on.'
  }
}

/** Runs one non-command step; throws on failure */
function applyStep(step: Exclude<SetupStep, { kind: 'run' }>, projPath: string, password: string, name: string): void {
  switch (step.kind) {
    case 'write':
      for (const f of step.files) writeText(join(projPath, f.path), f.content)
      return
    case 'env': {
      const file = join(projPath, step.file)
      writeText(file, mergeEnv(readText(file), step.vars))
      return
    }
    case 'ignore': {
      const file = join(projPath, '.gitignore')
      writeText(file, mergeIgnore(readText(file), step.lines))
      return
    }
    case 'drop-lines': {
      const file = join(projPath, step.file)
      writeText(file, readText(file).split('\n').filter(l => !l.includes(step.match)).join('\n'))
      return
    }
    case 'scripts': {
      const file = join(projPath, 'package.json')
      const pkg = JSON.parse(readFileSync(file, 'utf-8')) as { scripts?: Record<string, string> }
      pkg.scripts = { ...pkg.scripts, ...step.scripts }
      writeFileSync(file, JSON.stringify(pkg, null, 2) + '\n')
      return
    }
    case 'tailwind':
      setUpTailwind(projPath, step.via)
      return
    case 'connection':
      saveDbConnection({
        id: randomUUID(), name, type: step.type, color: DB_COLOR,
        ...(step.type === 'sqlite'
          ? { file: join(projPath, step.file ?? '') }
          : { host: '127.0.0.1', port: step.port, user: step.user, database: step.database, password })
      })
  }
}

/**
 * Runs the setup plan in the new project, one step after the other.
 * Only the final result is sent, so the console sees a single task end.
 */
export function runSetup(options: ProjectCreationOptions, projPath: string, taskId: string, onLog: LogCb, onResult: ResultCb): void {
  if (!options.setup) { onResult({ taskId, exitCode: 0, status: 'success' }); return }
  const password = randomBytes(12).toString('hex')
  const secret = randomBytes(32).toString('base64')
  const steps = planSetup({ ...options, setup: options.setup }, { password, secret, lang: options.lang ?? 'fr', composeName: composeName(options.name, randomBytes(3).toString('hex')) })
  const m = MESSAGES[options.lang ?? 'fr']
  const log = (type: LogLine['type'], text: string) => onLog({ taskId, type, text, timestamp: new Date().toISOString() })

  const next = (i: number): void => {
    if (i >= steps.length) { onResult({ taskId, exitCode: 0, status: 'success' }); return }
    const step = resolveStep(steps[i], projPath)
    log('info', `▸ [${i + 1}/${steps.length}] ${step.label}`)
    if (step.kind !== 'run') {
      try {
        applyStep(step, projPath, password, options.name)
        if (step.kind !== 'connection') log('stdout', stepCommand(step))
      } catch (err) {
        log('error', err instanceof Error ? err.message : String(err))
        onResult({ taskId, exitCode: 1, status: 'failed' })
        return
      }
      next(i + 1)
      return
    }
    if (step.skipIf && existsSync(join(projPath, step.skipIf))) {
      log('stdout', `${stepCommand(step)} — ${m.done}`)
      next(i + 1)
      return
    }
    if (step.onlyIf && !existsSync(join(projPath, step.onlyIf))) {
      log('stdout', `${stepCommand(step)} — ${m.none(step.onlyIf)}`)
      next(i + 1)
      return
    }
    // docker compose with Docker Desktop off: a clear message instead of a pipe error
    if (step.exe === 'docker') {
      void runFile('docker', ['info', '--format', '{{.ServerVersion}}'], { timeout: 20_000 }).then(r => {
        if (r.ok) { runStep(i, step); return }
        log('error', `⚠ ${step.label} : ${m.docker}`)
        next(i + 1)
      })
      return
    }
    runStep(i, step)
  }

  const runStep = (i: number, step: Extract<SetupStep, { kind: 'run' }>): void => {
    commandRunner.run({
      executable: step.exe, args: step.args, cwd: projPath, onLog,
      onResult: r => {
        if (r.status === 'success') { next(i + 1); return }
        if (r.status === 'cancelled') { onResult({ ...r, taskId }); return }
        if (step.optional) { log('error', `⚠ ${step.label} : ${m.failed}`); next(i + 1); return }
        onResult({ taskId, exitCode: r.exitCode, status: 'failed' })
      }
    })
  }
  next(0)
}
