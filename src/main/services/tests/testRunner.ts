import { spawn, type ChildProcess } from 'child_process'
import { createHash } from 'crypto'
import { existsSync, mkdirSync, readdirSync, readFileSync, realpathSync, rmSync } from 'fs'
import { join } from 'path'
import { app } from 'electron'
import type { TestFile, TestRun, TestRunner, TestRunnerInfo } from '@shared/types'
import { parseCargoTest, parseGoTest, parseJestJson, parseJunit, parsePlaywrightJson, rebase, stripAnsi, totalsOf } from '@shared/lib/testReports'
import { quote } from '../../lib/exec'
import { killTree } from '../../lib/killTree'
import { findExecutable, isInsideProject } from '../../lib/safe'
import { writeJsonFile } from '../../lib/jsonFile'
import { venvPython } from '../packages/otherUpdates'

/**
 * v3.7: a project's tests: the tools it has, run with a report the app can
 * read (written in DevForge's data, never in the project), the output
 * streamed while they run, the last run kept per folder and tool.
 */

const OUTPUT_KEPT = 200_000
const read = (p: string) => { try { return readFileSync(p, 'utf-8') } catch { return null } }
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const readJson = (p: string): Record<string, any> | null => { try { return JSON.parse(readFileSync(p, 'utf-8')) } catch { return null } }

function hasGoTests(dir: string, depth = 3): boolean {
  let entries
  try { entries = readdirSync(dir, { withFileTypes: true }) } catch { return false }
  if (entries.some(e => e.isFile() && e.name.endsWith('_test.go'))) return true
  return depth > 0 && entries.some(e => e.isDirectory() && !e.name.startsWith('.') && e.name !== 'vendor' && hasGoTests(join(dir, e.name), depth - 1))
}

/** PHPUnit's script: vendor/bin/phpunit, or Symfony's bin/phpunit */
const phpunitScript = (dir: string) => ['vendor/bin/phpunit', 'bin/phpunit'].find(p => existsSync(join(dir, p))) ?? null

function usesPytest(dir: string): boolean {
  if (['pytest.ini', 'conftest.py', 'tests/conftest.py'].some(f => existsSync(join(dir, f)))) return true
  const texts = [read(join(dir, 'pyproject.toml')), read(join(dir, 'setup.cfg')), read(join(dir, 'tox.ini')), ...readdirSafe(dir).filter(f => /^requirements.*\.txt$/i.test(f)).map(f => read(join(dir, f)))]
  return texts.some(t => !!t && /\bpytest\b/.test(t))
}
function readdirSafe(dir: string): string[] { try { return readdirSync(dir) } catch { return [] } }

/** The test tools of a folder, in the order they are offered */
export async function detectRunners(dir: string): Promise<TestRunnerInfo[]> {
  if (!isInsideProject(dir)) return []
  const out: TestRunnerInfo[] = []
  const pkg = readJson(join(dir, 'package.json'))
  const deps = { ...(pkg?.dependencies ?? {}), ...(pkg?.devDependencies ?? {}) } as Record<string, string>
  const node = (runner: TestRunner, bin: string) => {
    const installed = existsSync(join(dir, 'node_modules', '.bin', bin)) || existsSync(join(dir, 'node_modules', '.bin', `${bin}.cmd`))
    out.push(installed ? { runner } : { runner, missing: { name: bin, install: 'npm install' } })
  }
  if (deps.vitest) node('vitest', 'vitest')
  if (deps.jest) node('jest', 'jest')
  if (deps['@playwright/test']) node('playwright', 'playwright')
  if (phpunitScript(dir)) out.push((await findExecutable('php')) ? { runner: 'phpunit' } : { runner: 'phpunit', missing: { name: 'php', install: 'winget install PHP.PHP.8.4' } })
  else if (existsSync(join(dir, 'phpunit.xml')) || existsSync(join(dir, 'phpunit.xml.dist'))) out.push({ runner: 'phpunit', missing: { name: 'vendor/bin/phpunit', install: 'composer install' } })
  if (usesPytest(dir)) out.push(venvPython(dir) ? { runner: 'pytest' } : { runner: 'pytest', missing: { name: '.venv', install: 'python -m venv .venv' } })
  if (existsSync(join(dir, 'go.mod')) && hasGoTests(dir)) out.push((await findExecutable('go')) ? { runner: 'go' } : { runner: 'go', missing: { name: 'go', install: 'winget install GoLang.Go' } })
  if (existsSync(join(dir, 'Cargo.toml'))) out.push((await findExecutable('cargo')) ? { runner: 'cargo' } : { runner: 'cargo', missing: { name: 'cargo', install: 'winget install Rustlang.Rustup' } })
  return out
}

// ─── Running ──────────────────────────────────────────────────────────────────

const storeDir = () => { const d = join(app.getPath('userData'), 'tests'); mkdirSync(d, { recursive: true }); return d }
const keyOf = (dir: string, runner: TestRunner) => `${createHash('sha1').update(dir.toLowerCase()).digest('hex').slice(0, 16)}-${runner}`

/** Only plain relative paths reach the command line */
const SAFE_FILE = /^[\w./@+-]+$/

interface Plan { command: string; report?: string; env?: Record<string, string>; fromOutput?: boolean }

export function planFor(dir: string, runner: TestRunner, files: string[], report: string): Plan {
  const list = files.filter(f => SAFE_FILE.test(f) && !f.includes('..')).map(quote)
  const extra = list.length ? ` ${list.join(' ')}` : ''
  switch (runner) {
    case 'vitest': return { command: `npx vitest run --reporter=default --reporter=json --outputFile.json=${quote(report)}${extra}`, report }
    case 'jest': return { command: `npx jest --json --outputFile=${quote(report)} --testLocationInResults${extra}`, report }
    case 'playwright': return { command: `npx playwright test --reporter=list,json${extra}`, report, env: { PLAYWRIGHT_JSON_OUTPUT_NAME: report } }
    case 'phpunit': return { command: `php ${phpunitScript(dir) ?? 'vendor/bin/phpunit'} --log-junit ${quote(report)}${extra}`, report }
    case 'pytest': return { command: `${quote(venvPython(dir) ?? 'python')} -m pytest -o junit_family=xunit1 --junitxml=${quote(report)}${extra}`, report }
    case 'go': {
      // A file's tests: its package (folder)
      const pkgs = [...new Set(files.filter(f => SAFE_FILE.test(f) && !f.includes('..')).map(f => (f === '.' ? '.' : `./${f.replace(/\/[^/]*\.go$/, '')}`)))]
      return { command: `go test -json ${pkgs.length ? pkgs.map(quote).join(' ') : './...'}`, fromOutput: true }
    }
    case 'cargo': {
      // src/… is the library; tests/x.rs is the target "x"
      const targets = files.flatMap(f => (f.startsWith('tests/') ? ['--test', f.slice(6).replace(/\.rs$/, '')] : f.startsWith('src/') ? ['--lib'] : []))
      return { command: `cargo test --no-fail-fast${targets.length ? ` ${[...new Set(targets)].join(' ')}` : ''}`, fromOutput: true }
    }
  }
}

function parseRun(runner: TestRunner, dir: string, report: string | undefined, output: string): TestFile[] | null {
  const files = parseReport(runner, dir, report, output)
  // The tool may spell the folder its own way (long or short names on Windows)
  let real = dir
  try { real = realpathSync.native(dir) } catch { /* as it is */ }
  return files && real !== dir ? rebase(files, real) : files
}

function parseReport(runner: TestRunner, dir: string, report: string | undefined, output: string): TestFile[] | null {
  const text = report ? read(report) : null
  switch (runner) {
    case 'vitest': case 'jest': return text ? parseJestJson(text, dir) : null
    case 'playwright': return text ? parsePlaywrightJson(text, dir) : null
    case 'phpunit': case 'pytest': return text ? parseJunit(text, dir) : null
    case 'go': return parseGoTest(output, read(join(dir, 'go.mod'))?.match(/^module\s+(\S+)/m)?.[1] ?? '', dir)
    case 'cargo': return parseCargoTest(output, dir)
  }
}

let running: { child: ChildProcess; stopped: boolean } | null = null

export async function runTests(dir: string, runner: TestRunner, files: string[] | undefined, onOutput: (line: string) => void): Promise<TestRun> {
  if (!isInsideProject(dir)) throw new Error('Not a saved project')
  if (running) throw new Error('Tests are already running')
  const report = join(storeDir(), `${keyOf(dir, runner)}.report`)
  rmSync(report, { force: true })
  const plan = planFor(dir, runner, files ?? [], report)
  const started = Date.now()
  onOutput(`> ${plan.command}`)

  let output = ''
  let partial = ''
  const child = spawn(plan.command, {
    cwd: dir, shell: true, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'],
    // No watch mode, no colours, nothing waiting for a key
    env: { ...process.env, CI: '1', FORCE_COLOR: '0', NO_COLOR: '1', ...plan.env }
  })
  running = { child, stopped: false }
  const take = (data: Buffer) => {
    const text = data.toString('utf-8')
    if (output.length < 20_000_000) output += text
    const lines = (partial + text).split(/\r?\n/)
    partial = lines.pop() ?? ''
    for (const l of lines) {
      // go test -json: the readable part of each event
      if (plan.fromOutput && runner === 'go') { try { const e = JSON.parse(l); if (e.Output) onOutput(stripAnsi(e.Output).replace(/\n$/, '')) } catch { onOutput(l) } }
      else onOutput(stripAnsi(l))
    }
  }
  child.stdout?.on('data', take)
  child.stderr?.on('data', take)
  const exitCode = await new Promise<number | null>(res => { child.on('close', code => res(code)); child.on('error', () => res(null)) })
  if (partial) onOutput(stripAnsi(partial))
  const stopped = running?.stopped ?? false
  running = null

  const parsed = parseRun(runner, dir, plan.report, output)
  const fileList = parsed ?? []
  const run: TestRun = {
    runner, startedAt: new Date(started).toISOString(), durationMs: Date.now() - started,
    totals: totalsOf(fileList), files: fileList, output: stripAnsi(output).slice(-OUTPUT_KEPT), command: plan.command, exitCode,
    ...(stopped ? { cancelled: true } : {}), ...(!parsed && !stopped ? { error: 'NO_REPORT' } : {})
  }
  // Only a whole run is kept as "the last one"
  if (!stopped && !files?.length) writeJsonFile(join(storeDir(), `${keyOf(dir, runner)}.json`), run, false)
  rmSync(report, { force: true })
  return run
}

export async function stopTests(): Promise<void> {
  if (!running) return
  running.stopped = true
  await killTree(running.child)
}

export function lastRun(dir: string, runner: TestRunner): TestRun | null {
  if (!isInsideProject(dir)) return null
  return readJson(join(storeDir(), `${keyOf(dir, runner)}.json`)) as TestRun | null
}
